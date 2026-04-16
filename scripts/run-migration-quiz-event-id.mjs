// Adiciona event_id na quiz_configuracoes para vincular quiz a uma feira.
// Uso: node scripts/run-migration-quiz-event-id.mjs
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

const SQL = readFileSync(
  resolve(__dirname, '..', 'supabase', 'migrations', '20260416_quiz_event_id.sql'),
  'utf8'
);

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
  console.log('Rodando migration: quiz_event_id\n');

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
    console.log('\nExecutando SQL...');
    await client.query(SQL);
    console.log('Migration executada com sucesso!');

    // Verify
    const { rows } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'quiz_configuracoes' AND column_name = 'event_id'
    `);
    if (rows.length > 0) {
      console.log(`Coluna event_id confirmada: ${rows[0].data_type}`);
    } else {
      console.error('AVISO: coluna event_id nao encontrada apos migration!');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
