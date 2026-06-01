// Aplica TODAS as migrations historicas (schema-migration-v*.sql) em ordem.
// Idempotente: usa IF NOT EXISTS na maioria dos casos.

import { readFileSync, readdirSync } from 'fs';

const SBP = process.env.SBP_TOKEN || '';
const API = `https://api.supabase.com/v1/projects/otemsbhhtygjwokvxlir/database/query`;

async function runSQL(query, label) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SBP}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) {
    const body = await r.text();
    console.error(`❌ ${label}: ${body.slice(0, 200)}`);
    return false;
  }
  console.log(`✅ ${label}`);
  return true;
}

// Pega todos schema-migration-v*.sql, ordena por versao numerica
const files = readdirSync('.').filter((f) => /^schema-migration-v\d+/.test(f));
files.sort((a, b) => {
  const na = parseInt(a.match(/v(\d+)/)[1]);
  const nb = parseInt(b.match(/v(\d+)/)[1]);
  return na - nb;
});

console.log(`Aplicando ${files.length} migrations em ordem:\n`);
for (const f of files) {
  const sql = readFileSync(f, 'utf8');
  await runSQL(sql, f);
}

// Confere se 'segmento' apareceu agora
console.log('\n=== Verificando coluna segmento em contacts ===');
const r = await fetch(API, {
  method: 'POST',
  headers: { Authorization: `Bearer ${SBP}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "SELECT column_name FROM information_schema.columns WHERE table_name='contacts' AND column_name IN ('segmento','origem','temperatura','lead_score')",
  }),
});
const cols = await r.json();
console.log('Colunas encontradas:', cols.map((c) => c.column_name).join(', '));
