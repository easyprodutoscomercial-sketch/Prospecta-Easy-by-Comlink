// 2026-04-30: torna contacts.created_by_user_id NULLABLE + backfill dos
// contatos do quiz feira que estavam atribuidos artificialmente ao primeiro
// admin da org (workaround antigo em /api/quiz/route.ts).
//
// Uso: node scripts/run-migration-created-by-nullable.mjs
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const PROJECT_REF = SUPA_URL.replace('https://', '').split('.')[0];

const { Client } = pg;

const SQL_MIGRATION = readFileSync(
  resolve(__dirname, '..', 'supabase', 'migrations', '20260430_created_by_user_id_nullable.sql'),
  'utf8'
);

// Backfill: contatos que estao em quiz_participantes (vieram do quiz publico)
// recebem created_by_user_id = NULL e assigned_to_user_id = NULL quando estao
// como admin. So mexe nos que tem o admin nesses campos (= padrao do workaround
// antigo + atribuicao em massa anterior) — nao toca em contato de quiz que ja
// foi editado e re-atribuido manualmente a outro vendedor.
const SQL_BACKFILL = `
WITH quiz_contacts AS (
  SELECT DISTINCT contact_id, organization_id
  FROM quiz_participantes
  WHERE contact_id IS NOT NULL
),
admins_per_org AS (
  SELECT organization_id, user_id
  FROM profiles
  WHERE role = 'admin'
)
UPDATE contacts c
SET
  created_by_user_id = CASE WHEN c.created_by_user_id = a.user_id THEN NULL ELSE c.created_by_user_id END,
  assigned_to_user_id = CASE WHEN c.assigned_to_user_id = a.user_id THEN NULL ELSE c.assigned_to_user_id END
FROM quiz_contacts qc
JOIN admins_per_org a ON a.organization_id = qc.organization_id
WHERE c.id = qc.contact_id
  AND (c.created_by_user_id = a.user_id OR c.assigned_to_user_id = a.user_id)
RETURNING c.id;
`;

const connectionAttempts = [
  { label: 'Pooler session us-west-1', config: { host: 'aws-0-us-west-1.pooler.supabase.com', port: 5432, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Pooler transaction us-west-1', config: { host: 'aws-0-us-west-1.pooler.supabase.com', port: 6543, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Pooler us-east-1', config: { host: 'aws-0-us-east-1.pooler.supabase.com', port: 5432, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Pooler sa-east-1', config: { host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Direct DB', config: { host: `db.${PROJECT_REF}.supabase.co`, port: 5432, user: 'postgres', password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
];

async function tryConnect(attempt) {
  const client = new Client(attempt.config);
  try {
    await client.connect();
    console.log(`  OK: ${attempt.label}`);
    return client;
  } catch (err) {
    console.log(`  X ${attempt.label}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('Rodando migration + backfill: created_by_user_id NULLABLE\n');

  let client = null;
  for (const attempt of connectionAttempts) {
    client = await tryConnect(attempt);
    if (client) break;
  }

  if (!client) {
    console.error('\nNao conectou. Rode o SQL manualmente no Supabase Dashboard.');
    process.exit(1);
  }

  try {
    // 1. Migration
    console.log('\n[1/3] Aplicando migration (DROP NOT NULL)...');
    await client.query(SQL_MIGRATION);

    const { rows: cols } = await client.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'contacts' AND column_name = 'created_by_user_id'
    `);
    if (cols[0]?.is_nullable === 'YES') {
      console.log(`   created_by_user_id agora e NULLABLE.`);
    } else {
      console.error('   AVISO: coluna ainda NOT NULL apos migration!');
      process.exit(1);
    }

    // 2. Backfill
    console.log('\n[2/3] Backfill: setando NULL em contatos do quiz atribuidos a admins...');
    const { rows: updated } = await client.query(SQL_BACKFILL);
    console.log(`   ${updated.length} contatos atualizados (created_by_user_id => NULL).`);

    // 3. Validacao final
    console.log('\n[3/3] Validacao: contatos do quiz que ainda tem created_by_user_id setado...');
    const { rows: stillSet } = await client.query(`
      SELECT COUNT(*)::int AS n
      FROM contacts c
      JOIN quiz_participantes qp ON qp.contact_id = c.id
      WHERE c.created_by_user_id IS NOT NULL
    `);
    console.log(`   ${stillSet[0].n} contatos do quiz com created_by_user_id setado (esses foram editados manualmente — nao mexer).`);

    console.log('\nOK.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
