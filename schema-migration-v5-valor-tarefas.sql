-- Migration V5: Valor estimado do negocio
-- Rodar manualmente no Supabase SQL Editor

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS valor_estimado DECIMAL(12,2) DEFAULT NULL;
