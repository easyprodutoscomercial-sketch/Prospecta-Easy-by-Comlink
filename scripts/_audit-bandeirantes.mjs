// Investigacao especifica: BANDEIRANTES CARDANS aparece na feira mas nao em
// /contacts nem /kanban, e o telefone aparece sumido. Read-only.

import { loadSupabaseEnv } from './_lib/env.mjs';

const { SB_URL, HEADERS } = loadSupabaseEnv();
const ORG_ID = '86727616-4004-4604-b21b-25e8400d271d';
const EVENT_ID = '0e331665-e083-429c-9fae-9e67888a9a80';

async function q(table, params) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers: HEADERS });
  if (!r.ok) {
    console.error('ERR', table, r.status, await r.text().catch(() => ''));
    return [];
  }
  return r.json();
}

console.log('=== AUDITORIA: BANDEIRANTES CARDANS / Marcio ===\n');

// 1. Achar booth pelo nome
const booths = await q(
  'event_booths',
  `event_id=eq.${EVENT_ID}&company_name=ilike.*bandeirantes*&select=id,company_name,booth_number,sector,status,created_at,updated_at`
);
console.log('--- Stand(s) que batem com "bandeirantes" ---');
for (const b of booths) {
  console.log(`  ${b.id.slice(0, 8)} | ${b.company_name} | Stand ${b.booth_number || '-'} | status=${b.status}`);
}
if (booths.length === 0) {
  console.log('  Nenhum.');
  process.exit(0);
}

const boothId = booths[0].id;

// 2. Visitas desse booth
console.log('\n--- booth_visits desse stand ---');
const visits = await q(
  'booth_visits',
  `booth_id=eq.${boothId}&select=id,user_id,visited_at,contact_id,notes&order=visited_at.desc`
);
for (const v of visits) {
  console.log(`  visit=${v.id.slice(0, 8)} | user=${v.user_id?.slice(0, 8)} | contact=${v.contact_id?.slice(0, 8) || '(null)'} | ${v.visited_at}`);
  if (v.notes) console.log(`    notes (raw, ate 400 chars): ${v.notes.toString().slice(0, 400)}`);
}

// 3. Contatos linkados a essas visitas
const contactIds = [...new Set(visits.map((v) => v.contact_id).filter(Boolean))];
console.log(`\n--- Contatos linkados as visitas (${contactIds.length}) ---`);
if (contactIds.length === 0) {
  console.log('  Nenhum contato linkado.');
} else {
  const contacts = await q(
    'contacts',
    `id=in.(${contactIds.join(',')})&select=id,name,company,contato_nome,phone,phone_normalized,whatsapp,email,is_draft,inexistente,pipeline_id,stage_id,event_id,assigned_to_user_id,created_by_user_id,created_at,updated_at,notes`
  );
  for (const c of contacts) {
    console.log(`\n  Contato ${c.id.slice(0, 8)}:`);
    console.log(`    name:           ${c.name}`);
    console.log(`    company:        ${c.company || '(null)'}`);
    console.log(`    contato_nome:   ${c.contato_nome || '(null)'}`);
    console.log(`    phone:          "${c.phone || ''}" (normalized: "${c.phone_normalized || ''}")`);
    console.log(`    whatsapp:       "${c.whatsapp || ''}"`);
    console.log(`    email:          "${c.email || ''}"`);
    console.log(`    is_draft:       ${c.is_draft}    ← se true, oculto em /contacts e /kanban`);
    console.log(`    inexistente:    ${c.inexistente} ← se true, oculto em /contacts e /kanban`);
    console.log(`    pipeline_id:    ${c.pipeline_id?.slice(0, 8) || '(null)'}`);
    console.log(`    stage_id:       ${c.stage_id?.slice(0, 8) || '(null)'}`);
    console.log(`    event_id:       ${c.event_id?.slice(0, 8) || '(null)'}`);
    console.log(`    assigned_to:    ${c.assigned_to_user_id?.slice(0, 8) || '(null)'}`);
    console.log(`    created_by:     ${c.created_by_user_id?.slice(0, 8) || '(null)'}`);
    console.log(`    created_at:     ${c.created_at}`);
    console.log(`    updated_at:     ${c.updated_at}`);
    console.log(`    notes:          ${(c.notes || '(null)').toString().slice(0, 200)}`);
  }
}

// 4. Procurar TODOS os contatos com company BANDEIRANTES (mesmo desvinculados)
console.log('\n\n--- TODOS os contatos com "bandeirantes" no company (mesmo sem visit) ---');
const allBandeirantes = await q(
  'contacts',
  `organization_id=eq.${ORG_ID}&company=ilike.*bandeirantes*&select=id,name,company,contato_nome,phone,is_draft,inexistente,event_id,assigned_to_user_id,created_by_user_id,created_at`
);
for (const c of allBandeirantes) {
  const flag = c.inexistente ? ' [DESCARTADO]' : c.is_draft ? ' [RASCUNHO]' : '';
  const evFlag = c.event_id === EVENT_ID ? ' [AGRISHOW]' : c.event_id ? ' [outra feira]' : '';
  console.log(`  ${c.id.slice(0, 8)}${flag}${evFlag} | ${c.name} | contato=${c.contato_nome || '-'} | phone="${c.phone || ''}"`);
}

// 5. Auditoria final — esse contato apareceria onde?
console.log('\n=== ANALISE ===\n');
for (const c of allBandeirantes) {
  console.log(`Contato ${c.id.slice(0, 8)} (${c.name}, contato=${c.contato_nome || '-'}):`);
  if (c.is_draft) {
    console.log(`  ❌ NAO aparece em /contacts (is_draft=true) — aba Rascunhos so`);
    console.log(`  ❌ NAO aparece em /kanban (is_draft=true)`);
    console.log(`  ✅ Aparece em /eventos/feira (?descartados=all nao filtra rascunho? checar)`);
  } else if (c.inexistente) {
    console.log(`  ❌ NAO aparece em /contacts (inexistente=true)`);
    console.log(`  ❌ NAO aparece em /kanban (inexistente=true)`);
    console.log(`  ✅ Aparece em /eventos/feira (view passa ?descartados=all)`);
    console.log(`     → POR ISSO o vendedor ve na feira mas nao em /contacts e /kanban`);
  } else {
    console.log(`  ✅ Aparece em /contacts e /kanban (estado normal)`);
  }
  if (!c.phone) {
    console.log(`  ⚠️  phone esta vazio no banco — nao foi salvo na hora do check-in ou foi apagado`);
  }
}
