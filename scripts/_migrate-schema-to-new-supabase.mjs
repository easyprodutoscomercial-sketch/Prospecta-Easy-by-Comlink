// Aplica schema-completo-consolidado.sql no projeto Supabase NOVO via Management API.
// Read-only no antigo, write no novo. Roda sql em partes pra contornar limite de payload.

import { readFileSync } from 'fs';

const SBP_TOKEN = process.env.SBP_TOKEN || process.env.SBP_TOKEN || '';
const NEW_PROJECT_REF = 'otemsbhhtygjwokvxlir';
const API = `https://api.supabase.com/v1/projects/${NEW_PROJECT_REF}/database/query`;

async function runSQL(query, label) {
  const r = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SBP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const body = await r.text();
  if (!r.ok) {
    console.error(`❌ ${label}: HTTP ${r.status}`);
    console.error('   Body:', body.slice(0, 500));
    return false;
  }
  console.log(`✅ ${label}: OK`);
  return true;
}

console.log('=== Migracao de schema pro Supabase novo ===\n');
console.log(`Projeto: ${NEW_PROJECT_REF}\n`);

// Testa conexao primeiro
console.log('--- Teste de conexao ---');
const ok = await runSQL('SELECT 1 as ok', 'ping');
if (!ok) {
  console.error('\nFalhou no ping. Token invalido ou projeto sem acesso.');
  process.exit(1);
}

// Ordem manual de migrations: precisa criar events ANTES das migrations que mexem nele.
// Os schema-migration-v*.sql ja foram parcialmente cobertos pelo consolidado, mas
// algumas tabelas (support, lead-capture, eventos) ficaram de fora.
const ordered = [
  // 1. Eventos (criados via scripts/, nao estavam no consolidado)
  'scripts/migration-events.sql',
  'scripts/migration-event-map.sql',
  'scripts/migration-cover-image.sql',
  'scripts/migration-event-booths-polygon.sql',
  'scripts/migration-event-uses-association.sql',
  'scripts/migration-contact-event.sql',
  'scripts/migration-contact-is-draft.sql',
  // 2. Lead Capture
  'schema-migration-lead-capture.sql',
  // 3. Support (precisam vir antes da v20)
  'schema-migration-v18-support-tickets.sql',
  'schema-migration-v20-support-projects.sql',
  // 4. Lead scoring / automations / onboarding
  'schema-migration-v21-lead-scoring.sql',
  'schema-migration-v22-automations.sql',
  'schema-migration-v23-onboarding-roles.sql',
  // 5. Migrations oficiais (algumas dependiam de events/booth_visits que ja foram criados acima)
  'supabase/migrations/20260413_cascade_delete_fks.sql',
  'supabase/migrations/20260413_event_snapshots.sql',
  'supabase/migrations/20260413_lead_capture_event_id.sql',
  'supabase/migrations/20260416_quiz_event_id.sql',
  'supabase/migrations/20260430_unique_indexes_furos.sql',
];

console.log(`\n--- Aplicando ${ordered.length} migrations restantes ---`);
for (const f of ordered) {
  try {
    const sql = readFileSync(f, 'utf8');
    await runSQL(sql, f);
  } catch (e) {
    console.error(`❌ ${f}: arquivo nao encontrado`);
  }
}

console.log('\n=== Confirmando tabelas criadas ===');
const checkR = await fetch(API, {
  method: 'POST',
  headers: { Authorization: `Bearer ${SBP_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
  }),
});
const tables = await checkR.json();
console.log(`Total de tabelas no schema public: ${tables.length}`);
for (const t of tables) console.log(`  - ${t.table_name}`);

console.log('\n=== Fim ===');
