// Run contact-event migration using pg package
// Usage: node scripts/run-migration-contact-event.mjs [DB_PASSWORD]
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadSupabaseEnv } from './_lib/env.mjs';
const { Client } = pg;

const { SB_KEY: SERVICE_ROLE_KEY } = loadSupabaseEnv();
const PROJECT_REF = 'edwkdrgferjbitxwlwrf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SQL = fs.readFileSync(path.join(__dirname, 'migration-contact-event.sql'), 'utf-8');

const connectionAttempts = [
  {
    label: 'Pooler session mode (JWT)',
    config: {
      host: `aws-0-us-west-1.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${PROJECT_REF}`,
      password: SERVICE_ROLE_KEY,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    },
  },
  {
    label: 'Pooler transaction mode (JWT)',
    config: {
      host: `aws-0-us-west-1.pooler.supabase.com`,
      port: 6543,
      user: `postgres.${PROJECT_REF}`,
      password: SERVICE_ROLE_KEY,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    },
  },
  {
    label: 'Pooler us-east-1 (JWT)',
    config: {
      host: `aws-0-us-east-1.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${PROJECT_REF}`,
      password: SERVICE_ROLE_KEY,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    },
  },
  {
    label: 'Pooler sa-east-1 (JWT)',
    config: {
      host: `aws-0-sa-east-1.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${PROJECT_REF}`,
      password: SERVICE_ROLE_KEY,
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
      password: SERVICE_ROLE_KEY,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    },
  },
];

async function tryConnect(attempt) {
  const client = new Client(attempt.config);
  try {
    await client.connect();
    console.log(`✅ Connected via: ${attempt.label}`);
    return client;
  } catch (err) {
    console.log(`❌ ${attempt.label}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('🏗️  Running contact-event migration...\n');

  let client = null;

  for (const attempt of connectionAttempts) {
    client = await tryConnect(attempt);
    if (client) break;
  }

  if (!client) {
    console.log('\n⚠️  Could not connect automatically.');
    const dbPassword = process.argv[2];
    if (dbPassword) {
      console.log('Trying with provided password...');
      client = await tryConnect({
        label: 'Direct with password',
        config: {
          host: `db.${PROJECT_REF}.supabase.co`,
          port: 5432,
          user: 'postgres',
          password: dbPassword,
          database: 'postgres',
          ssl: { rejectUnauthorized: false },
        },
      });
    }

    if (!client) {
      console.log('\n❌ Failed. Please run the SQL manually in Supabase Dashboard SQL Editor.');
      console.log('File: scripts/migration-contact-event.sql\n');
      process.exit(1);
    }
  }

  try {
    console.log('\nExecuting migration SQL...');
    await client.query(SQL);
    console.log('\n✅ Migration completed successfully!');

    // Verify column exists
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'contacts'
        AND column_name = 'event_id'
    `);
    if (rows.length > 0) {
      console.log(`\n✓ Column contacts.event_id exists (${rows[0].data_type}, nullable=${rows[0].is_nullable})`);
    } else {
      console.log('\n⚠️  Column not found after migration!');
    }
  } catch (err) {
    console.error('\n❌ Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
