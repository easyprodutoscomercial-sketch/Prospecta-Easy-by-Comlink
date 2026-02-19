-- Migration v11: Adiciona campo pipeline_type na tabela pipelines
-- Tipos: 'PADRAO' (pipeline normal de CRM), 'BUGS' (pipeline de bugs com campo anexo)

ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS pipeline_type TEXT NOT NULL DEFAULT 'PADRAO';

-- Backfill: todos os pipelines existentes ficam como PADRAO
UPDATE pipelines SET pipeline_type = 'PADRAO' WHERE pipeline_type IS NULL;
