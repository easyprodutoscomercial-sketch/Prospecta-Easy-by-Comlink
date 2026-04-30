// Transfere TUDO que ainda esta sob Josimar Mariano no evento atual (Agrishow
// 2026) para Mario Sergio Assumpcao. Cobre 3 lados:
//   1. contacts.created_by_user_id (= "via QR" no ranking)
//   2. contacts.assigned_to_user_id (= dono do lead, "Meus contatos")
//   3. booth_visits.user_id + user_name (= "via stand" no ranking)
//
// READ-ONLY por padrao — passe --apply pra escrever.
// Uso: node scripts/transfer-josimar-to-assumpcao.mjs --apply

import { loadSupabaseEnv } from './_lib/env.mjs';

const { SB_URL, SB_KEY, HEADERS } = loadSupabaseEnv();
const APPLY = process.argv.includes('--apply');

async function q(table, params = '') {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers: HEADERS });
  if (!res.ok) {
    console.error(`[GET ERR ${res.status}] ${table}?${params}`, await res.text().catch(() => ''));
    return [];
  }
  return res.json();
}

async function patch(table, filter, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`[PATCH ERR ${res.status}] ${table}?${filter}`, await res.text().catch(() => ''));
    return [];
  }
  return res.json();
}

function shortId(id) {
  return id ? String(id).slice(0, 8) : '—';
}

async function main() {
  console.log(`=== TRANSFER JOSIMAR MARIANO → MARIO SERGIO ASSUMPCAO ${APPLY ? '(APLICANDO)' : '(DRY RUN)'} ===\n`);

  // 1. Evento ATIVO
  const events = await q('events', 'select=id,name,status,organization_id&status=eq.ATIVO&order=created_at.desc');
  if (!events.length) { console.log('Nenhum evento ATIVO.'); return; }
  const event = events[0];
  console.log(`📍 Evento: ${event.name} [${shortId(event.id)}] org=${shortId(event.organization_id)}\n`);

  // 2. Profiles
  const profiles = await q(
    'profiles',
    `select=user_id,name,role&organization_id=eq.${event.organization_id}&limit=200`
  );
  const josimar = profiles.find((p) => /josimar.*mariano/i.test(p.name || ''));
  const mario = profiles.find((p) => /mario.*ass/i.test(p.name || '') || /assump/i.test(p.name || ''));
  if (!josimar) { console.log('Josimar Mariano nao encontrado.'); return; }
  if (!mario) { console.log('Mario Sergio Assumpcao nao encontrado.'); return; }
  console.log(`👤 De:   ${josimar.name} [${shortId(josimar.user_id)}]`);
  console.log(`👤 Para: ${mario.name} [${shortId(mario.user_id)}]\n`);

  // 2b. IDs de contatos que vieram do QUIZ (publicos) — NAO transferir.
  // Quiz e captacao coletiva, deve ficar com created_by_user_id = NULL.
  // O backfill SQL no Dashboard cuida disso. Aqui so excluimos do transfer.
  const quizPart = await q(
    'quiz_participantes',
    `select=contact_id&organization_id=eq.${event.organization_id}&contact_id=not.is.null&limit=5000`
  );
  const quizIds = new Set(quizPart.map((p) => p.contact_id).filter(Boolean));
  console.log(`🎯 Contatos do quiz (excluidos do transfer): ${quizIds.size}\n`);

  // 3. Contatos do Josimar no evento (created_by_user_id)
  const contactsByCreatedRaw = await q(
    'contacts',
    `select=id,name,company,assigned_to_user_id&organization_id=eq.${event.organization_id}&event_id=eq.${event.id}&created_by_user_id=eq.${josimar.user_id}&is_draft=eq.false&inexistente=eq.false&limit=2000`
  );
  const contactsByCreated = contactsByCreatedRaw.filter((c) => !quizIds.has(c.id));
  const skippedFromQuiz = contactsByCreatedRaw.length - contactsByCreated.length;
  console.log(`📋 Contatos com created_by=Josimar no evento: ${contactsByCreatedRaw.length} (${skippedFromQuiz} do quiz pulados, ${contactsByCreated.length} reais a transferir)`);
  contactsByCreated.forEach((c) => console.log(`   - ${c.name || '(sem nome)'} | empresa=${c.company || '—'} | assigned=${shortId(c.assigned_to_user_id)}`));

  // 4. Contatos atribuidos a Josimar (assigned_to_user_id) que talvez NAO estao no set de cima.
  // Tambem exclui contatos do quiz — esses ficam com assigned=NULL (backfill SQL no Dashboard).
  const contactsByAssignedRaw = await q(
    'contacts',
    `select=id,name,company,created_by_user_id&organization_id=eq.${event.organization_id}&event_id=eq.${event.id}&assigned_to_user_id=eq.${josimar.user_id}&is_draft=eq.false&inexistente=eq.false&limit=2000`
  );
  const idsAlreadyCovered = new Set(contactsByCreated.map((c) => c.id));
  const extraAssigned = contactsByAssignedRaw
    .filter((c) => !idsAlreadyCovered.has(c.id))
    .filter((c) => !quizIds.has(c.id));
  const extraAssignedFromQuiz = contactsByAssignedRaw
    .filter((c) => !idsAlreadyCovered.has(c.id))
    .filter((c) => quizIds.has(c.id)).length;
  console.log(`\n📋 Contatos com assigned=Josimar no evento (alem dos ja listados): ${extraAssigned.length} reais (${extraAssignedFromQuiz} do quiz pulados — vao virar NULL via SQL backfill)`);
  extraAssigned.forEach((c) => console.log(`   - ${c.name || '(sem nome)'} | empresa=${c.company || '—'}`));

  // 5. Booth visits do Josimar no evento
  const visits = await q(
    'booth_visits',
    `select=id,booth_id,contact_id,visited_at&organization_id=eq.${event.organization_id}&event_id=eq.${event.id}&user_id=eq.${josimar.user_id}&order=visited_at.desc`
  );
  console.log(`\n🚶 Booth visits do Josimar no evento: ${visits.length}`);
  visits.forEach((v) => console.log(`   - booth=${shortId(v.booth_id)} contact=${shortId(v.contact_id)} ${v.visited_at}`));

  if (!APPLY) {
    console.log(`\n[DRY RUN] Para aplicar, rode com --apply`);
    return;
  }

  // 6. APPLY — usa id=in.(...) pra transferir SO os que nao sao do quiz
  console.log('\n>>> Aplicando UPDATEs...');

  // 6a. created_by_user_id (so os reais, excluindo quiz)
  if (contactsByCreated.length > 0) {
    const idList = contactsByCreated.map((c) => c.id).join(',');
    const u1 = await patch(
      'contacts',
      `id=in.(${idList})`,
      { created_by_user_id: mario.user_id }
    );
    console.log(`   created_by_user_id: ${u1.length} atualizados`);
  } else {
    console.log(`   created_by_user_id: 0 a transferir`);
  }

  // 6b. assigned_to_user_id — todos os contatos do evento atribuidos a Josimar
  // (incluindo extras do passo 4). Quiz nao seta assigned, entao seguro.
  const allAssignedIds = [
    ...new Set([...contactsByCreated.map((c) => c.id), ...extraAssigned.map((c) => c.id)]),
  ];
  if (allAssignedIds.length > 0) {
    const u2 = await patch(
      'contacts',
      `id=in.(${allAssignedIds.join(',')})&assigned_to_user_id=eq.${josimar.user_id}`,
      { assigned_to_user_id: mario.user_id }
    );
    console.log(`   assigned_to_user_id: ${u2.length} atualizados`);
  } else {
    console.log(`   assigned_to_user_id: 0 a transferir`);
  }

  // 6c. booth_visits — todos do Josimar nesse evento
  if (visits.length > 0) {
    const u3 = await patch(
      'booth_visits',
      `organization_id=eq.${event.organization_id}&event_id=eq.${event.id}&user_id=eq.${josimar.user_id}`,
      { user_id: mario.user_id, user_name: mario.name }
    );
    console.log(`   booth_visits: ${u3.length} atualizados`);
  }

  console.log('\nOK. Rode o audit pra validar.');
}

main().catch((e) => { console.error(e); process.exit(1); });
