-- Migration v10: Pipeline Members
-- Permite atribuir usuarios especificos a cada pipeline

CREATE TABLE IF NOT EXISTS pipeline_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pipeline_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_members_pipeline ON pipeline_members(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_members_user ON pipeline_members(user_id);

ALTER TABLE pipeline_members ENABLE ROW LEVEL SECURITY;

-- Usuarios veem apenas membros dos pipelines da sua org
CREATE POLICY pipeline_members_select ON pipeline_members FOR SELECT
  USING (pipeline_id IN (
    SELECT id FROM pipelines WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- Admins podem gerenciar membros
CREATE POLICY pipeline_members_all ON pipeline_members FOR ALL
  USING (pipeline_id IN (
    SELECT id FROM pipelines WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- ============================================
-- Backfill: inserir TODOS os usuarios de cada org como membros de TODOS os pipelines existentes
-- Isso garante que nada muda visualmente apos a migration
-- ============================================
INSERT INTO pipeline_members (pipeline_id, user_id)
SELECT p.id, pr.user_id
FROM pipelines p
JOIN profiles pr ON pr.organization_id = p.organization_id
ON CONFLICT (pipeline_id, user_id) DO NOTHING;
