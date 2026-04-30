// Run events migration using pg package
// Usage: node scripts/run-migration-events.mjs
import pg from 'pg';
import { loadSupabaseEnv } from './_lib/env.mjs';
const { Client } = pg;

const { SB_KEY: SERVICE_ROLE_KEY } = loadSupabaseEnv();
const PROJECT_REF = 'edwkdrgferjbitxwlwrf';

const SQL = `
-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  map_url TEXT,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'ATIVO', 'ENCERRADO')),
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_org ON events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(organization_id, status);

-- Event booths
CREATE TABLE IF NOT EXISTS event_booths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  booth_number TEXT,
  sector TEXT,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'VISITADO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_booths_event ON event_booths(event_id);
CREATE INDEX IF NOT EXISTS idx_event_booths_org ON event_booths(organization_id);
CREATE INDEX IF NOT EXISTS idx_event_booths_status ON event_booths(event_id, status);

-- Booth visits
CREATE TABLE IF NOT EXISTS booth_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booth_id UUID NOT NULL REFERENCES event_booths(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  photo_facade_url TEXT,
  photo_contact_url TEXT,
  contact_name TEXT,
  contact_role TEXT,
  prospect_type TEXT NOT NULL DEFAULT 'COMPRADOR' CHECK (prospect_type IN ('COMPRADOR', 'FORNECEDOR', 'AMBOS')),
  notes TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booth_visits_booth ON booth_visits(booth_id);
CREATE INDEX IF NOT EXISTS idx_booth_visits_event ON booth_visits(event_id);
CREATE INDEX IF NOT EXISTS idx_booth_visits_user ON booth_visits(user_id);

-- Triggers
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_events_updated_at();

DROP TRIGGER IF EXISTS trg_event_booths_updated_at ON event_booths;
CREATE TRIGGER trg_event_booths_updated_at BEFORE UPDATE ON event_booths FOR EACH ROW EXECUTE FUNCTION update_events_updated_at();

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_booths ENABLE ROW LEVEL SECURITY;
ALTER TABLE booth_visits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'events_service') THEN
    CREATE POLICY events_service ON events FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_booths' AND policyname = 'event_booths_service') THEN
    CREATE POLICY event_booths_service ON event_booths FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booth_visits' AND policyname = 'booth_visits_service') THEN
    CREATE POLICY booth_visits_service ON booth_visits FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

// Try multiple connection methods
const connectionAttempts = [
  // 1. Direct connection via Supavisor session mode (JWT auth)
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
  // 2. Pooler transaction mode
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
  // 3. Try us-east-1
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
  // 4. Try sa-east-1 (São Paulo)
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
  // 5. Direct DB connection
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
  console.log('🏗️  Running events migration...\n');

  let client = null;

  for (const attempt of connectionAttempts) {
    client = await tryConnect(attempt);
    if (client) break;
  }

  if (!client) {
    console.log('\n⚠️  Could not connect to database automatically.');
    console.log('Please provide your database password as argument:');
    console.log('  node scripts/run-migration-events.mjs YOUR_DB_PASSWORD\n');

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
      process.exit(1);
    }
  }

  try {
    console.log('\nExecuting migration SQL...');
    await client.query(SQL);
    console.log('\n✅ Migration completed successfully!');

    // Verify tables exist
    const { rows } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('events', 'event_booths', 'booth_visits')
      ORDER BY table_name
    `);
    console.log('\nTables created:');
    rows.forEach(r => console.log(`  ✓ ${r.table_name}`));
  } catch (err) {
    console.error('\n❌ Migration error:', err.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
