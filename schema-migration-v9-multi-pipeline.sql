-- Migration v9: Multi-Pipeline com Stages Customizaveis
-- RODAR EM PARTES NO SUPABASE SQL EDITOR (cada bloco separado por comentario)

-- =============================================================================
-- PARTE 1: CRIAR TABELAS
-- =============================================================================
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  "position" INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#a3a3a3',
  "position" INT NOT NULL DEFAULT 0,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  terminal_type TEXT CHECK (terminal_type IS NULL OR terminal_type IN ('won', 'lost')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id);

CREATE INDEX IF NOT EXISTS idx_pipelines_org ON pipelines(organization_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_contacts_pipeline ON contacts(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(stage_id);

ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pipelines_select_org ON pipelines;
CREATE POLICY pipelines_select_org ON pipelines FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS pipelines_all_org ON pipelines;
CREATE POLICY pipelines_all_org ON pipelines FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS stages_select_org ON pipeline_stages;
CREATE POLICY stages_select_org ON pipeline_stages FOR SELECT
  USING (pipeline_id IN (SELECT id FROM pipelines WHERE organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS stages_all_org ON pipeline_stages;
CREATE POLICY stages_all_org ON pipeline_stages FOR ALL
  USING (pipeline_id IN (SELECT id FROM pipelines WHERE organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())));
