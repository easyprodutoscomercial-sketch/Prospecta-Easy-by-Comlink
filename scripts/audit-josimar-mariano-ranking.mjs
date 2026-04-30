// READ-ONLY: investiga por que Josimar Mariano aparece com 228 contatos
// "via QR" no ranking do evento, se ele praticamente nao inseriu nenhum.
//
// Hipotese: contatos do quiz feira sao atribuidos ao primeiro admin da org
// (em /api/quiz/route.ts:300-311), inflando o created_by_user_id dele.
//
// Uso: node scripts/audit-josimar-mariano-ranking.mjs

import { loadSupabaseEnv } from './_lib/env.mjs';

const { SB_URL, HEADERS } = loadSupabaseEnv();

async function q(table, params = '') {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers: HEADERS });
  if (!res.ok) {
    console.error(`[ERR ${res.status}] ${table}?${params}`, await res.text().catch(() => ''));
    return [];
  }
  return res.json();
}

function shortId(id) {
  return id ? String(id).slice(0, 8) : '—';
}

async function main() {
  console.log('=== AUDIT RANKING JOSIMAR MARIANO ===\n');

  // 1. Acha o evento ativo (Agrishow 2026)
  const events = await q('events', 'select=id,name,status,organization_id&status=eq.ATIVO&order=created_at.desc');
  if (!events.length) {
    console.log('Nenhum evento ATIVO encontrado.');
    return;
  }
  const event = events[0];
  console.log(`📍 Evento: ${event.name} [${shortId(event.id)}]`);
  console.log(`   org=${shortId(event.organization_id)}\n`);

  // 2. Acha o profile do Josimar Mariano
  const profiles = await q(
    'profiles',
    `select=user_id,name,email,role&organization_id=eq.${event.organization_id}&limit=200`
  );
  const josimar = profiles.find((p) => /josimar.*mariano/i.test(p.name || ''));
  if (!josimar) {
    console.log('Josimar Mariano nao encontrado. Profiles da org:');
    profiles.forEach((p) => console.log(`  - ${p.name} (${p.role}) ${shortId(p.user_id)}`));
    return;
  }
  console.log(`👤 Josimar: ${josimar.name} | role=${josimar.role} | uid=${shortId(josimar.user_id)}\n`);

  // 3. Conta total de contatos no evento (filtros do ranking: ativos)
  const eventContacts = await q(
    'contacts',
    `select=id,created_by_user_id,origem,temperatura,name,company,created_at&organization_id=eq.${event.organization_id}&event_id=eq.${event.id}&is_draft=eq.false&inexistente=eq.false&limit=2000`
  );
  console.log(`📊 Total de contatos ativos no evento: ${eventContacts.length}`);

  // 4. Filtra os atribuidos ao Josimar via created_by
  const josimarContacts = eventContacts.filter((c) => c.created_by_user_id === josimar.user_id);
  console.log(`   ↳ atribuidos ao Josimar (created_by_user_id): ${josimarContacts.length}`);

  // 5. Quantos desses estao em quiz_participantes?
  const quizPartic = await q(
    'quiz_participantes',
    `select=contact_id&organization_id=eq.${event.organization_id}&limit=5000`
  );
  const quizContactIds = new Set(quizPartic.filter((p) => p.contact_id).map((p) => p.contact_id));
  console.log(`\n🎯 quiz_participantes da org: ${quizPartic.length} (com contact_id: ${quizContactIds.size})`);

  const josimarFromQuiz = josimarContacts.filter((c) => quizContactIds.has(c.id));
  console.log(`   ↳ contatos do Josimar que vieram do QUIZ: ${josimarFromQuiz.length}`);

  // 6. Quantos vieram via lead-capture link?
  const links = await q(
    'lead_capture_links',
    `select=id,user_id,leads_count,event_id,is_active&organization_id=eq.${event.organization_id}`
  );
  const josimarLink = links.find((l) => l.user_id === josimar.user_id);
  console.log(`\n🔗 lead_capture_link do Josimar: ${josimarLink ? `leads_count=${josimarLink.leads_count} event_id=${shortId(josimarLink.event_id)}` : 'NAO TEM'}`);

  // 7. Origens dos contatos do Josimar
  const byOrigem = {};
  josimarContacts.forEach((c) => {
    const k = c.origem || '(null)';
    byOrigem[k] = (byOrigem[k] || 0) + 1;
  });
  console.log('\n📌 Origens dos contatos atribuidos ao Josimar:');
  Object.entries(byOrigem).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${k}: ${v}`));

  // 8. Por origem + temperatura (proxy do quiz: origem=FEIRA temperatura=MORNO)
  const feiraMornoCount = josimarContacts.filter((c) => c.origem === 'FEIRA' && c.temperatura === 'MORNO').length;
  const feiraQuenteCount = josimarContacts.filter((c) => c.origem === 'FEIRA' && c.temperatura === 'QUENTE').length;
  const qrcodeCount = josimarContacts.filter((c) => c.origem === 'QRCODE').length;
  console.log('\n🔍 Decomposicao detalhada:');
  console.log(`   FEIRA + MORNO (padrao do QUIZ): ${feiraMornoCount}`);
  console.log(`   FEIRA + QUENTE (lead-capture com booth): ${feiraQuenteCount}`);
  console.log(`   QRCODE (lead-capture sem booth): ${qrcodeCount}`);

  // 9. Verificacao cruzada — quiz contacts atribuidos a OUTROS users
  const allQuizContactsInEvent = eventContacts.filter((c) => quizContactIds.has(c.id));
  const quizByUser = {};
  allQuizContactsInEvent.forEach((c) => {
    const uid = c.created_by_user_id || '(null)';
    quizByUser[uid] = (quizByUser[uid] || 0) + 1;
  });
  console.log(`\n🎲 Distribuicao dos contatos do QUIZ por created_by_user_id:`);
  Object.entries(quizByUser).sort((a, b) => b[1] - a[1]).forEach(([uid, n]) => {
    const pname = profiles.find((p) => p.user_id === uid)?.name || '(desconhecido)';
    console.log(`   ${pname} [${shortId(uid)}]: ${n}`);
  });

  // 10. Conclusao
  console.log('\n=== CONCLUSAO ===');
  const inflated = josimarFromQuiz.length;
  const real = josimarContacts.length - inflated;
  console.log(`Josimar tem ${josimarContacts.length} contatos atribuidos no evento.`);
  console.log(`  → ${inflated} sao do QUIZ (atribuidos artificialmente ao admin)`);
  console.log(`  → ${real} sao "reais" (criados por ele de verdade)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
