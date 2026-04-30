// Backfill contacts.event_id for contacts created before the event_id column existed
// Usage: node scripts/backfill-contact-event-id.mjs [DB_PASSWORD]
//
// Strategy:
//   1. For every booth_visits row with contact_id, set that contact's event_id = booth_visits.event_id
//   2. For contacts with origem='FEIRA' and notes containing a legacy marker `<!--EVENT:<uuid>-->`,
//      parse the uuid and set event_id accordingly, then strip the marker from notes
//
// Safe to re-run: only updates rows where event_id is currently NULL.

import pg from 'pg';
import { loadSupabaseEnv } from './_lib/env.mjs';
const { Client } = pg;

const { SB_KEY: SERVICE_ROLE_KEY } = loadSupabaseEnv();
const PROJECT_REF = 'edwkdrgferjbitxwlwrf';

const connectionAttempts = [
  { label: 'Pooler session mode (JWT)', config: { host: 'aws-0-us-west-1.pooler.supabase.com', port: 5432, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Pooler transaction mode (JWT)', config: { host: 'aws-0-us-west-1.pooler.supabase.com', port: 6543, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Pooler us-east-1 (JWT)', config: { host: 'aws-0-us-east-1.pooler.supabase.com', port: 5432, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Pooler sa-east-1 (JWT)', config: { host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Direct DB connection', config: { host: `db.${PROJECT_REF}.supabase.co`, port: 5432, user: 'postgres', password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
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
  console.log('🔄 Backfilling contacts.event_id...\n');

  let client = null;
  for (const attempt of connectionAttempts) {
    client = await tryConnect(attempt);
    if (client) break;
  }

  if (!client) {
    const dbPassword = process.argv[2];
    if (dbPassword) {
      client = await tryConnect({
        label: 'Direct with password',
        config: { host: `db.${PROJECT_REF}.supabase.co`, port: 5432, user: 'postgres', password: dbPassword, database: 'postgres', ssl: { rejectUnauthorized: false } },
      });
    }
    if (!client) {
      console.log('\n❌ Could not connect. Exiting.');
      process.exit(1);
    }
  }

  try {
    // Verify column exists before anything
    const { rows: colRows } = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'event_id'
    `);
    if (colRows.length === 0) {
      console.log('❌ Column contacts.event_id does not exist. Run the migration first:');
      console.log('   node scripts/run-migration-contact-event.mjs');
      process.exit(1);
    }

    // Step 1: primary contacts — via booth_visits.contact_id
    console.log('\n📌 Step 1: Linking primary contacts via booth_visits...');
    const step1 = await client.query(`
      UPDATE contacts c
      SET event_id = bv.event_id
      FROM booth_visits bv
      WHERE bv.contact_id = c.id
        AND bv.contact_id IS NOT NULL
        AND c.event_id IS NULL
    `);
    console.log(`   ✓ Updated ${step1.rowCount} primary contact(s)`);

    // Step 2: extras — via legacy marker `<!--EVENT:<uuid>-->` in notes
    console.log('\n📌 Step 2: Linking extra contacts via legacy notes marker...');
    const step2 = await client.query(`
      UPDATE contacts c
      SET event_id = (regexp_match(c.notes, '<!--EVENT:([0-9a-f-]+)-->'))[1]::uuid
      WHERE c.event_id IS NULL
        AND c.notes ~ '<!--EVENT:[0-9a-f-]+-->'
    `);
    console.log(`   ✓ Updated ${step2.rowCount} extra contact(s) via marker`);

    // Step 3: strip markers from notes (cleanup)
    console.log('\n📌 Step 3: Cleaning legacy markers from notes...');
    const step3 = await client.query(`
      UPDATE contacts
      SET notes = TRIM(regexp_replace(notes, '\\s*<!--EVENT:[0-9a-f-]+-->\\s*', '', 'g'))
      WHERE notes ~ '<!--EVENT:[0-9a-f-]+-->'
    `);
    console.log(`   ✓ Cleaned ${step3.rowCount} notes`);

    // Summary
    const { rows: summary } = await client.query(`
      SELECT COUNT(*) AS total_with_event
      FROM contacts
      WHERE event_id IS NOT NULL
    `);
    console.log(`\n✅ Done. Total contacts with event_id: ${summary[0].total_with_event}`);
  } catch (err) {
    console.error('\n❌ Backfill error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
