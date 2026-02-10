-- ============================================
-- MIGRATION: CRM Overhaul
-- Tipo Fornecedor/Comprador, Campos Expandidos, Interações Ampliadas
-- ============================================

-- 1) Novos campos no contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tipo TEXT[] DEFAULT '{}';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS referencia TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS classe TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS produtos_fornecidos TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contato_nome TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- 2) CHECK constraint para classe
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_classe_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_classe_check CHECK (classe IS NULL OR classe IN ('A', 'B', 'C', 'D'));

-- 3) GIN index para busca no array tipo
CREATE INDEX IF NOT EXISTS idx_contacts_tipo ON contacts USING GIN (tipo);

-- 4) Expandir interaction type CHECK
ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_type_check;
ALTER TABLE interactions ADD CONSTRAINT interactions_type_check CHECK (type IN (
  'LIGACAO', 'WHATSAPP', 'EMAIL', 'REUNIAO', 'OUTRO',
  'VISITA', 'PROPOSTA_ENVIADA', 'FOLLOW_UP', 'NEGOCIACAO',
  'POS_VENDA', 'SUPORTE', 'INDICACAO', 'APRESENTACAO', 'ORCAMENTO'
));

-- 5) Expandir interaction outcome CHECK
ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_outcome_check;
ALTER TABLE interactions ADD CONSTRAINT interactions_outcome_check CHECK (outcome IN (
  'SEM_RESPOSTA', 'RESPONDEU', 'REUNIAO_MARCADA', 'NAO_INTERESSADO', 'CONVERTIDO', 'SEGUIR_TENTANDO',
  'PROPOSTA_ACEITA', 'AGUARDANDO_RETORNO', 'EM_NEGOCIACAO', 'INDICOU_TERCEIRO', 'FECHADO_PARCIAL'
));
