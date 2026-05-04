// Verifica quem ENXERGA os contatos da feira AGRISHOW na pipeline.
// Cruza pipeline_members com vendedores pra ver quem nao esta vendo nada.
import { loadSupabaseEnv } from './_lib/env.mjs';

const { SB_URL, HEADERS } = loadSupabaseEnv();
const PIPELINE_ID = 'ca0488f4-ae6d-4ce7-bc34-0afeeeb4a521'; // Vendas Easybycomlink
const ORG_ID = '86727616-4004-4604-b21b-25e8400d271d';

async function q(table, params) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers: HEADERS });
  if (!r.ok) return [];
  return r.json();
}

const profiles = await q('profiles', `organization_id=eq.${ORG_ID}&select=user_id,name,role&order=name.asc`);
const members = await q('pipeline_members', `pipeline_id=eq.${PIPELINE_ID}&select=user_id`);
const memberIds = new Set(members.map((m) => m.user_id));

console.log(`=== Quem enxerga a pipeline "Vendas Easybycomlink" ===\n`);
console.log(`Pipeline: ${PIPELINE_ID.slice(0, 8)}\n`);
console.log('Role         | Membro pipeline? | Nome');
console.log('-------------|------------------|---------------------------');
for (const p of profiles) {
  const isAdmin = p.role === 'admin';
  const isMember = memberIds.has(p.user_id);
  const ok = isAdmin || isMember;
  const flag = ok ? '✅' : '❌ NAO VE NADA';
  console.log(`${p.role.padEnd(12)} | ${(isMember ? 'sim' : 'nao').padEnd(16)} | ${(p.name || p.user_id.slice(0, 8))} ${flag}`);
}

const semAcesso = profiles.filter((p) => p.role !== 'admin' && !memberIds.has(p.user_id));
console.log(`\nVendedores SEM acesso ao pipeline (vao ver lista vazia): ${semAcesso.length}`);
if (semAcesso.length > 0) {
  console.log('Eles abrem /contacts e /kanban e nao veem nenhum contato da AGRISHOW.');
  console.log('Soluciona: adicionar como pipeline_member, ou virar admin.');
}
