-- ============================================
-- Events / Feiras Module
-- ============================================

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

-- Event booths (stands)
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

-- Booth visits (check-ins)
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

-- Updated_at trigger for events
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_events_updated_at();

DROP TRIGGER IF EXISTS trg_event_booths_updated_at ON event_booths;
CREATE TRIGGER trg_event_booths_updated_at
  BEFORE UPDATE ON event_booths
  FOR EACH ROW EXECUTE FUNCTION update_events_updated_at();

-- RLS policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_booths ENABLE ROW LEVEL SECURITY;
ALTER TABLE booth_visits ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (admin client bypasses RLS anyway)
CREATE POLICY events_service ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY event_booths_service ON event_booths FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY booth_visits_service ON booth_visits FOR ALL USING (true) WITH CHECK (true);
