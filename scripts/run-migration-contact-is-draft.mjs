// Roda a migration que adiciona a coluna is_draft em contacts.
// Uso: node scripts/run-migration-contact-is-draft.mjs [DB_PASSWORD]
//
// Prefere ler SUPABASE_SERVICE_ROLE_KEY do ambiente (.env.local ou process.env).
// Se nao achar, aceita uma senha direto na linha de comando como fallback.
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tenta carregar SERVICE_ROLE_KEY do .env.local (formato simples KEY=VALUE)
function loadEnvFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (m) {
        const val = m[2].replace(/^['"]|['"]$/g, '');
        if (!process.env[m[1]]) process.env[m[1]] = val;
      }
    }
  } catch {
    // ignora
  }
}
loadEnvFromFile(path.join(__dirname, '..', '.env.local'));

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF =
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'edwkdrgferjbitxwlwrf';

const SQL = fs.readFileSync(path.join(__dirname, 'migration-contact-is-draft.sql'), 'utf-8');

function buildAttempts(password) {
  return [
    {
      label: 'Pooler session mode (us-west-1)',
      config: {
        host: 'aws-0-us-west-1.pooler.supabase.com',
        port: 5432,
        user: `postgres.${PROJECT_REF}`,
        password,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
      },
    },
    {
      label: 'Pooler session mode (sa-east-1)',
      config: {
        host: 'aws-0-sa-east-1.pooler.supabase.com',
        port: 5432,
        user: `postgres.${PROJECT_REF}`,
        password,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
      },
    },
    {
      label: 'Direct DB connection',
      config: {
        host: `db.${PROJECT_REF}.supabase.co`,
        port: 5432,
        user: 'postgres',
        password,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
      },
    },
  ];
}

async function tryConnect(attempt) {
  const client = new Client(attempt.config);
  try {
    await client.connect();
    console.log(`OK conectou via: ${attempt.label}`);
    return client;
  } catch (err) {
    console.log(`FAIL ${attempt.label}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('Rodando migration: add is_draft em contacts...\n');

  const password = SERVICE_ROLE_KEY || process.argv[2];
  if (!password) {
    console.error('Nao achou SUPABASE_SERVICE_ROLE_KEY no .env.local nem no argumento.');
    console.error('Uso: node scripts/run-migration-contact-is-draft.mjs <DB_PASSWORD>');
    console.error('Ou: rode o SQL manualmente no Supabase Dashboard > SQL Editor');
    console.error('    (arquivo: scripts/migration-contact-is-draft.sql)');
    process.exit(1);
  }

  let client = null;
  for (const attempt of buildAttempts(password)) {
    client = await tryConnect(attempt);
    if (client) break;
  }

  if (!client) {
    console.error('\nNao conseguiu conectar em nenhum endpoint.');
    console.error('Rode o SQL manualmente no Supabase Dashboard > SQL Editor');
    console.error('Arquivo: scripts/migration-contact-is-draft.sql');
    process.exit(1);
  }

  try {
    console.log('\nExecutando SQL...');
    await client.query(SQL);
    console.log('Migration rodou sem erro.');

    // Valida que a coluna existe
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'contacts'
        AND column_name = 'is_draft'
    `);
    if (rows.length > 0) {
      console.log(`\nOK contacts.is_draft existe (${rows[0].data_type}, nullable=${rows[0].is_nullable}, default=${rows[0].column_default})`);
    } else {
      console.log('\nATENCAO: coluna nao encontrada depois da migration!');
      process.exit(1);
    }
  } catch (err) {
    console.error('\nErro na migration:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
