-- Vincula quiz a um evento/feira existente (opcional).
-- Quando vinculado, o quiz herda nome, datas e pipeline da feira,
-- eliminando a duplicação de dados.
--
-- Quizzes existentes ficam com event_id NULL e continuam
-- funcionando com os campos manuais (nome_evento, data_inicio, etc).

ALTER TABLE quiz_configuracoes
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_configuracoes_event
  ON quiz_configuracoes(event_id) WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_configuracoes_org_event
  ON quiz_configuracoes(organization_id, event_id) WHERE event_id IS NOT NULL;
