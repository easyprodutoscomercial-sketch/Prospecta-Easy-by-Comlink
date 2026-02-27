-- ============================================
-- Migration: Lead Capture Links (QR Code para Feiras)
-- ============================================

-- 1. Criar tabela lead_capture_links
CREATE TABLE IF NOT EXISTS lead_capture_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  "label" TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  leads_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indice para busca rapida por token (endpoint publico)
CREATE INDEX IF NOT EXISTS idx_lead_capture_links_token ON lead_capture_links(token);

-- Indice para listagem por usuario
CREATE INDEX IF NOT EXISTS idx_lead_capture_links_user ON lead_capture_links(user_id, organization_id);

-- RLS
ALTER TABLE lead_capture_links ENABLE ROW LEVEL SECURITY;

-- Politica: usuarios veem links da propria organizacao
CREATE POLICY "Users can view own org links"
  ON lead_capture_links FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own links"
  ON lead_capture_links FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own links"
  ON lead_capture_links FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own links"
  ON lead_capture_links FOR DELETE
  USING (user_id = auth.uid());

-- 2. Adicionar QRCODE a constraint de origem nos contacts
-- Remover constraint antiga (pode nao existir se ja foi dropada)
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_origem_check;

-- Recriar com QRCODE incluido
ALTER TABLE contacts ADD CONSTRAINT contacts_origem_check
  CHECK (origem IS NULL OR origem IN ('MANUAL', 'INDICACAO', 'FEIRA', 'LINKEDIN', 'SITE', 'WHATSAPP_INBOUND', 'OUTRO', 'QRCODE'));

-- 3. Adicionar campo whatsapp_vendedor para botao WhatsApp pos-cadastro
ALTER TABLE lead_capture_links ADD COLUMN IF NOT EXISTS whatsapp_vendedor TEXT;
