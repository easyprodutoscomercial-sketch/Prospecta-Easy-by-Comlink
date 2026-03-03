-- Migration v20: Support Projects
-- Creates support_projects table and links to tickets

-- 1. Create support_projects table
CREATE TABLE IF NOT EXISTS support_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_support_projects_org ON support_projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_projects_token ON support_projects(token);

-- RLS
ALTER TABLE support_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects in their org"
  ON support_projects FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert projects in their org"
  ON support_projects FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update projects in their org"
  ON support_projects FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete projects in their org"
  ON support_projects FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

-- 2. Add project_id column to support_tickets
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES support_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_project ON support_tickets(project_id);
