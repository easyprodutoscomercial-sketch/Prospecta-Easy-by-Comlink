-- Quiz Feira: tables for quiz configuration and participants
-- Follows the same pattern as lead_capture_links

-- quiz_configuracoes: settings per organization
CREATE TABLE IF NOT EXISTS quiz_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quiz_ativo boolean DEFAULT false,
  valor_exato integer DEFAULT 500,
  nome_evento text DEFAULT 'Feira 2026',
  descricao_desafio text DEFAULT 'Quantos grãos de soja tem neste pote?',
  mensagem_pausa text DEFAULT 'O quiz está pausado no momento.',
  token_publico text UNIQUE DEFAULT gen_random_uuid()::text,
  pipeline_id uuid REFERENCES pipelines(id),
  crm_tag text DEFAULT '',
  crm_ativo boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_configuracoes_org ON quiz_configuracoes(organization_id);
CREATE INDEX IF NOT EXISTS idx_quiz_configuracoes_token ON quiz_configuracoes(token_publico);

-- quiz_participantes: participation records
CREATE TABLE IF NOT EXISTS quiz_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quiz_config_id uuid REFERENCES quiz_configuracoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  empresa text NOT NULL,
  telefone text NOT NULL,
  palpite integer NOT NULL,
  evento_nome text,
  contact_id uuid REFERENCES contacts(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_participantes_org ON quiz_participantes(organization_id);
CREATE INDEX IF NOT EXISTS idx_quiz_participantes_config ON quiz_participantes(quiz_config_id);
CREATE INDEX IF NOT EXISTS idx_quiz_participantes_created ON quiz_participantes(created_at);

-- RLS
ALTER TABLE quiz_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_participantes ENABLE ROW LEVEL SECURITY;

-- Policies for quiz_configuracoes
CREATE POLICY "Users can view own org quiz config"
  ON quiz_configuracoes FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own org quiz config"
  ON quiz_configuracoes FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update own org quiz config"
  ON quiz_configuracoes FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

-- Policies for quiz_participantes
CREATE POLICY "Users can view own org quiz participants"
  ON quiz_participantes FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own org quiz participants"
  ON quiz_participantes FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));
