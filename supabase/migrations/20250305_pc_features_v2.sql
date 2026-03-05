-- Feature 5: FK cotacao -> pedido
ALTER TABLE pc_pedidos ADD COLUMN IF NOT EXISTS cotacao_id UUID REFERENCES pc_cotacoes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pc_pedidos_cotacao ON pc_pedidos(cotacao_id);

-- Feature 9: Campos extras em pedidos e cotacoes
ALTER TABLE pc_pedidos ADD COLUMN IF NOT EXISTS valor NUMERIC(14,2);
ALTER TABLE pc_pedidos ADD COLUMN IF NOT EXISTS prazo_entrega DATE;
ALTER TABLE pc_pedidos ADD COLUMN IF NOT EXISTS condicoes_pagamento TEXT;

ALTER TABLE pc_cotacoes ADD COLUMN IF NOT EXISTS valor NUMERIC(14,2);
ALTER TABLE pc_cotacoes ADD COLUMN IF NOT EXISTS prazo_entrega DATE;
ALTER TABLE pc_cotacoes ADD COLUMN IF NOT EXISTS condicoes_pagamento TEXT;
