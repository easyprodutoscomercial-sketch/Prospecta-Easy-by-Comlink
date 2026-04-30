// Roda migration pra adicionar colunas polygon + zapt_id em event_booths.
// Usage: node scripts/run-migration-event-booths-polygon.mjs

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { loadSupabaseEnv } from './_lib/env.mjs';
const { Client } = pg;

const { SB_KEY: SERVICE_ROLE_KEY } = loadSupabaseEnv();
const PROJECT_REF = 'edwkdrgferjbitxwlwrf';

const SQL = fs.readFileSync(
  path.join(process.cwd(), 'scripts', 'migration-event-booths-polygon.sql'),
  'utf8'
);

const attempts = [
  { label: 'Pooler us-west-1 session', config: { host: 'aws-0-us-west-1.pooler.supabase.com', port: 5432, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Pooler us-west-1 transaction', config: { host: 'aws-0-us-west-1.pooler.supabase.com', port: 6543, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Pooler sa-east-1', config: { host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Direct', config: { host: `db.${PROJECT_REF}.supabase.co`, port: 5432, user: 'postgres', password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
];

async function tryConnect(a) {
  const c = new Client(a.config);
  try { await c.connect(); console.log(`ok ${a.label}`); return c; }
  catch (e) { console.log(`falhou ${a.label}: ${e.message}`); return null; }
}

async function main() {
  console.log('Rodando migration polygon + zapt_id em event_booths...\n');
  let client = null;
  for (const a of attempts) { client = await tryConnect(a); if (client) break; }
  if (!client) { console.log('Nao consegui conectar.'); process.exit(1); }

  try {
    await client.query(SQL);
    console.log('\nMigration aplicada.');
    const { rows } = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'event_booths'
        AND column_name IN ('polygon', 'zapt_id', 'position_x', 'position_y')
      ORDER BY column_name
    `);
    console.log('Colunas relevantes em event_booths:');
    rows.forEach(r => console.log(`  ${r.column_name.padEnd(15)} ${r.data_type}`));
  } catch (e) {
    console.error('Erro:', e.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
