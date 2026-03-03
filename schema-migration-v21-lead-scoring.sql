-- Migration v21: Lead Scoring
-- Adds lead_score_history table and lead_score column to contacts

-- Lead score history for tracking score changes over time
CREATE TABLE IF NOT EXISTS lead_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  breakdown JSONB NOT NULL DEFAULT '{}',
  scored_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_score_history_contact
  ON lead_score_history(contact_id, scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_score_history_org
  ON lead_score_history(organization_id);

-- Add lead_score column to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER;

CREATE INDEX IF NOT EXISTS idx_contacts_lead_score
  ON contacts(organization_id, lead_score DESC NULLS LAST);

-- RLS
ALTER TABLE lead_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lead scores in their org"
  ON lead_score_history FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert lead scores in their org"
  ON lead_score_history FOR INSERT
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));
