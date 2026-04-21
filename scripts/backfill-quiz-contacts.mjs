// Backfill: cria contatos para quiz_participantes que ficaram sem contact_id.
// Causa: bug antigo descartava o contato se quiz/evento não tinham pipeline_id,
// ou não setava event_id ao criar. Essa rotina completa o histórico.
//
// Usage: node scripts/backfill-quiz-contacts.mjs

const SUPABASE_URL = 'https://edwkdrgferjbitxwlwrf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkd2tkcmdmZXJqYml0eHdsd3JmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDcxMjA3OSwiZXhwIjoyMDg2Mjg4MDc5fQ.KILRshoC8XLuoJyx9Xrlz_Ve8-W9LOxYtsvWndyXfdc';

const HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function sb(path, init = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, { ...init, headers: { ...HEADERS, ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits || null;
}

async function main() {
  console.log('🔄 Backfilling quiz_participantes → contacts...\n');

  const pendentes = await sb(`/quiz_participantes?contact_id=is.null&select=id,organization_id,quiz_config_id,nome,empresa,telefone,dia_feira,created_at&order=created_at.asc`);
  console.log(`📋 Participantes sem contato: ${pendentes.length}\n`);
  if (pendentes.length === 0) {
    console.log('Nada para fazer.');
    return;
  }

  // Cache quiz configs + events
  const quizIds = [...new Set(pendentes.map(p => p.quiz_config_id))];
  const quizzes = await sb(`/quiz_configuracoes?id=in.(${quizIds.join(',')})&select=id,pipeline_id,event_id`);
  const quizMap = new Map(quizzes.map(q => [q.id, q]));

  const eventIds = [...new Set(quizzes.map(q => q.event_id).filter(Boolean))];
  let eventMap = new Map();
  if (eventIds.length > 0) {
    const events = await sb(`/events?id=in.(${eventIds.join(',')})&select=id,pipeline_id`);
    eventMap = new Map(events.map(e => [e.id, e]));
  }

  // Cache first pipeline + admin user per org (fallback)
  const orgIds = [...new Set(pendentes.map(p => p.organization_id))];
  const orgPipelineMap = new Map();
  const orgAdminMap = new Map();
  for (const orgId of orgIds) {
    const pipes = await sb(`/pipelines?organization_id=eq.${orgId}&select=id&order=position.asc&limit=1`);
    if (pipes[0]) orgPipelineMap.set(orgId, pipes[0].id);
    const admins = await sb(`/profiles?organization_id=eq.${orgId}&role=eq.admin&select=user_id&limit=1`);
    if (admins[0]) {
      orgAdminMap.set(orgId, admins[0].user_id);
    } else {
      const anyUser = await sb(`/profiles?organization_id=eq.${orgId}&select=user_id&limit=1`);
      if (anyUser[0]) orgAdminMap.set(orgId, anyUser[0].user_id);
    }
  }

  // Cache first stage per pipeline
  const stageCache = new Map();
  async function getFirstStage(pipelineId) {
    if (stageCache.has(pipelineId)) return stageCache.get(pipelineId);
    const stages = await sb(`/pipeline_stages?pipeline_id=eq.${pipelineId}&select=id&order=position.asc&limit=1`);
    const id = stages[0]?.id || null;
    stageCache.set(pipelineId, id);
    return id;
  }

  let created = 0;
  let linkedExisting = 0;
  let skipped = 0;

  for (const p of pendentes) {
    const quiz = quizMap.get(p.quiz_config_id);
    const event = quiz?.event_id ? eventMap.get(quiz.event_id) : null;
    const phoneNormalized = normalizePhone(p.telefone);

    let pipelineId = quiz?.pipeline_id || event?.pipeline_id || orgPipelineMap.get(p.organization_id);
    if (!pipelineId) {
      console.log(`⏭️  [${p.id}] sem pipeline disponível — pulando`);
      skipped++;
      continue;
    }

    const stageId = await getFirstStage(pipelineId);
    if (!stageId) {
      console.log(`⏭️  [${p.id}] pipeline ${pipelineId} sem stages — pulando`);
      skipped++;
      continue;
    }

    const eventId = quiz?.event_id || null;

    let contactId = null;
    if (phoneNormalized) {
      const existing = await sb(
        `/contacts?organization_id=eq.${p.organization_id}&phone_normalized=eq.${phoneNormalized}&select=id,event_id&limit=1`
      );
      if (existing[0]) {
        contactId = existing[0].id;
        if (eventId && !existing[0].event_id) {
          await sb(`/contacts?id=eq.${contactId}`, {
            method: 'PATCH',
            body: JSON.stringify({ event_id: eventId }),
          });
        }
        linkedExisting++;
        console.log(`🔗 [${p.id}] reusando contato ${contactId} (${p.nome})`);
      }
    }

    if (!contactId) {
      const createdBy = orgAdminMap.get(p.organization_id);
      if (!createdBy) {
        console.log(`⏭️  [${p.id}] org sem admin para creditar contato — pulando`);
        skipped++;
        continue;
      }
      const base = {
        organization_id: p.organization_id,
        name: (p.nome || '').trim(),
        name_normalized: (p.nome || '').trim().toLowerCase(),
        phone: (p.telefone || '').trim(),
        phone_normalized: phoneNormalized,
        whatsapp: (p.telefone || '').trim(),
        company: (p.empresa || '').trim(),
        pipeline_id: pipelineId,
        stage_id: stageId,
        tipo: [],
        created_by_user_id: createdBy,
      };
      if (eventId) base.event_id = eventId;

      // Tenta com origem/temperatura; se colunas opcionais não existirem, reenvia sem.
      let inserted;
      try {
        inserted = await sb(`/contacts`, {
          method: 'POST',
          body: JSON.stringify({ ...base, origem: 'FEIRA', temperatura: 'MORNO' }),
        });
      } catch (err) {
        console.log(`   ⚠️  retry sem campos opcionais: ${err.message}`);
        inserted = await sb(`/contacts`, {
          method: 'POST',
          body: JSON.stringify(base),
        });
      }
      contactId = inserted[0].id;
      created++;
      console.log(`✨ [${p.id}] criado contato ${contactId} (${p.nome} / ${p.empresa})`);
    }

    await sb(`/quiz_participantes?id=eq.${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ contact_id: contactId }),
    });
  }

  console.log(`\n✅ Resumo:`);
  console.log(`   Contatos criados: ${created}`);
  console.log(`   Contatos existentes reusados: ${linkedExisting}`);
  console.log(`   Pulados: ${skipped}`);
  console.log(`   Total processado: ${pendentes.length}`);
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
