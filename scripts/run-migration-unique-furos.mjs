// /furos round 2: aplica UNIQUE INDEX em booth_visits e quiz_participantes.
//
// Pre-requisito: rodar `node scripts/dedupe-booth-visits.mjs --apply` antes
// (este script confere e aborta se houver duplicatas em booth_visits).
//
// Uso: node scripts/run-migration-unique-furos.mjs

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
  resolve(__dirname, '..', 'supabase', 'migrations', '20260430_unique_indexes_furos.sql'),
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
  console.log('Aplicando migration UNIQUE INDEX (furos #1 + #4)\n');

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
    // Pre-check: confere que nao tem duplicata em booth_visits (senao UNIQUE falha)
    console.log('\n[1/4] Conferindo se ha duplicatas em booth_visits...');
    const { rows: dupCheck } = await client.query(`
      SELECT user_id, booth_id, event_id, COUNT(*) as n
      FROM booth_visits
      WHERE user_id IS NOT NULL
      GROUP BY user_id, booth_id, event_id
      HAVING COUNT(*) > 1
      LIMIT 5
    `);
    if (dupCheck.length > 0) {
      console.error(`   X ${dupCheck.length}+ duplicatas ainda existem. Rode dedupe-booth-visits.mjs --apply primeiro.`);
      process.exit(1);
    }
    console.log(`   OK — sem duplicatas em booth_visits.`);

    // Aplica migration
    console.log('\n[2/4] Aplicando migration SQL (cria 2 UNIQUE INDEX + dedup quiz)...');
    await client.query(SQL_MIGRATION);
    console.log('   OK.');

    // Validacao
    console.log('\n[3/4] Validando que os indices existem...');
    const { rows: indexes } = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN ('uq_booth_visits_user_booth_event', 'uq_quiz_participante_telefone')
    `);
    console.log('   Indices criados:', indexes.map(r => r.indexname).join(', '));

    if (indexes.length !== 2) {
      console.error('   AVISO: nao criou os 2 indices esperados!');
      process.exit(1);
    }

    // Stats finais
    console.log('\n[4/4] Stats:');
    const { rows: bvStats } = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(DISTINCT (user_id, booth_id, event_id)) as unique_combo
      FROM booth_visits WHERE user_id IS NOT NULL
    `);
    console.log(`   booth_visits: total=${bvStats[0].total} unique=${bvStats[0].unique_combo}`);

    const { rows: qpStats } = await client.query(`
      SELECT COUNT(*) as total FROM quiz_participantes
    `);
    console.log(`   quiz_participantes: total=${qpStats[0].total}`);

    console.log('\nMigration aplicada com sucesso. Race conditions agora bloqueadas pelo banco.');
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
