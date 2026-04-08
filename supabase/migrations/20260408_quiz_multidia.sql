-- Quiz Multi-dia + Cheat VIP
-- Adiciona suporte a múltiplos dias de feira e telefone VIP

-- Novas colunas em quiz_configuracoes
ALTER TABLE quiz_configuracoes ADD COLUMN IF NOT EXISTS telefone_vip text;
ALTER TABLE quiz_configuracoes ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE quiz_configuracoes ADD COLUMN IF NOT EXISTS dias_feira integer DEFAULT 1;
ALTER TABLE quiz_configuracoes ADD COLUMN IF NOT EXISTS dias_config jsonb DEFAULT '[]'::jsonb;

-- Nova coluna em quiz_participantes
ALTER TABLE quiz_participantes ADD COLUMN IF NOT EXISTS dia_feira integer;
