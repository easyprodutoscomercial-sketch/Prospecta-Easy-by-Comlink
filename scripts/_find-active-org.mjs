// Lista todas as orgs com contagem de contatos pra achar a ativa.
import { loadSupabaseEnv } from './_lib/env.mjs';

const { SB_URL, HEADERS } = loadSupabaseEnv();

async function q(table, params) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers: HEADERS });
  if (!r.ok) return [];
  return r.json();
}

async function count(params) {
  const r = await fetch(`${SB_URL}/rest/v1/contacts?${params}&select=id`, {
    headers: { ...HEADERS, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!r.ok) return 0;
  const range = r.headers.get('content-range') || '';
  return Number(range.split('/')[1]) || 0;
}

const orgs = await q('organizations', 'select=id,name&limit=200');
console.log(`Total orgs: ${orgs.length}\n`);

const results = [];
for (const o of orgs) {
  const c = await count(`organization_id=eq.${o.id}&is_draft=eq.false&inexistente=eq.false`);
  if (c > 0) results.push({ ...o, contacts: c });
}
results.sort((a, b) => b.contacts - a.contacts);
console.log('Orgs com contatos ativos:');
for (const o of results.slice(0, 20)) {
  console.log(`  ${o.contacts.toString().padStart(6)} | ${o.id} | ${o.name}`);
}
