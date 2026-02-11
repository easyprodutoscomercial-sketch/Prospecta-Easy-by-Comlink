-- Migration v2: Campos de Qualificação
-- Executar no Supabase SQL Editor

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS temperatura TEXT
  CHECK (temperatura IS NULL OR temperatura IN ('FRIO','MORNO','QUENTE'));

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS origem TEXT
  CHECK (origem IS NULL OR origem IN ('MANUAL','INDICACAO','FEIRA','LINKEDIN','SITE','WHATSAPP_INBOUND','OUTRO'));

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS proxima_acao_tipo TEXT
  CHECK (proxima_acao_tipo IS NULL OR proxima_acao_tipo IN ('LIGAR','ENVIAR_WHATSAPP','ENVIAR_EMAIL','REUNIAO','VISITA','FOLLOW_UP','ENVIAR_PROPOSTA','OUTRO'));

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS proxima_acao_data TIMESTAMPTZ;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS motivo_ganho_perdido TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_proxima_acao_data ON contacts(proxima_acao_data)
  WHERE proxima_acao_data IS NOT NULL;
