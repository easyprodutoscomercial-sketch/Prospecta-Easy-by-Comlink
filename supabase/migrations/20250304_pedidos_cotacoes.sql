-- ============================================
-- Pedidos & Cotacoes Module
-- ============================================

-- 1. pc_clients
CREATE TABLE IF NOT EXISTS pc_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cnpj TEXT,
  cnpj_digits TEXT,
  fornecedor TEXT NOT NULL,
  contato TEXT,
  email TEXT,
  status_sac TEXT NOT NULL DEFAULT 'PRE_CADASTRO' CHECK (status_sac IN ('SIM', 'NAO', 'AGUARDANDO_ACEITE', 'PRE_CADASTRO')),
  filhos_count INTEGER NOT NULL DEFAULT 0,
  contato_data TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pc_clients_org ON pc_clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_pc_clients_cnpj_digits ON pc_clients(cnpj_digits);
CREATE INDEX IF NOT EXISTS idx_pc_clients_fornecedor ON pc_clients(fornecedor);

-- 2. pc_cotacoes
CREATE TABLE IF NOT EXISTS pc_cotacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cotacao_numero TEXT NOT NULL,
  cotacao_nome TEXT,
  fornecedor TEXT NOT NULL,
  cnpj TEXT,
  informe TEXT,
  resposta TEXT NOT NULL DEFAULT 'NAO_RESPONDEU' CHECK (resposta IN ('RESPONDEU', 'NAO_RESPONDEU')),
  pc_client_id UUID REFERENCES pc_clients(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pc_cotacoes_org ON pc_cotacoes(organization_id);
CREATE INDEX IF NOT EXISTS idx_pc_cotacoes_numero ON pc_cotacoes(cotacao_numero);
CREATE INDEX IF NOT EXISTS idx_pc_cotacoes_client ON pc_cotacoes(pc_client_id);

-- 3. pc_pedidos
CREATE TABLE IF NOT EXISTS pc_pedidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pedido_numero TEXT NOT NULL,
  empresa TEXT NOT NULL,
  situacao TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (situacao IN ('PENDENTE', 'ACEITO', 'RECUSADO', 'EM_ANDAMENTO')),
  informe TEXT,
  pc_client_id UUID REFERENCES pc_clients(id) ON DELETE SET NULL,
  finalizado BOOLEAN NOT NULL DEFAULT false,
  finalizado_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pc_pedidos_org ON pc_pedidos(organization_id);
CREATE INDEX IF NOT EXISTS idx_pc_pedidos_numero ON pc_pedidos(pedido_numero);
CREATE INDEX IF NOT EXISTS idx_pc_pedidos_finalizado ON pc_pedidos(finalizado);
CREATE INDEX IF NOT EXISTS idx_pc_pedidos_client ON pc_pedidos(pc_client_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_pc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_pc_clients_updated_at ON pc_clients;
CREATE TRIGGER tr_pc_clients_updated_at BEFORE UPDATE ON pc_clients FOR EACH ROW EXECUTE FUNCTION update_pc_updated_at();

DROP TRIGGER IF EXISTS tr_pc_cotacoes_updated_at ON pc_cotacoes;
CREATE TRIGGER tr_pc_cotacoes_updated_at BEFORE UPDATE ON pc_cotacoes FOR EACH ROW EXECUTE FUNCTION update_pc_updated_at();

DROP TRIGGER IF EXISTS tr_pc_pedidos_updated_at ON pc_pedidos;
CREATE TRIGGER tr_pc_pedidos_updated_at BEFORE UPDATE ON pc_pedidos FOR EACH ROW EXECUTE FUNCTION update_pc_updated_at();

-- RLS policies
ALTER TABLE pc_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_cotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pc_clients_org_access" ON pc_clients FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "pc_cotacoes_org_access" ON pc_cotacoes FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "pc_pedidos_org_access" ON pc_pedidos FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));
