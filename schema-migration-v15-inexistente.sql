-- Migration v15: Adicionar campo "inexistente" aos contatos
-- Permite marcar contatos como inexistentes (nome riscado na UI)

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS inexistente BOOLEAN NOT NULL DEFAULT false;
