-- ============================================
-- SCHEMA COMPLETO - MINI CRM
-- ============================================

-- 1) ORGANIZATIONS
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) PROFILES (usuários)
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) CONTACTS
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Dados originais
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  cpf TEXT,
  cnpj TEXT,
  company TEXT,
  notes TEXT,

  -- Tipo e classificação
  tipo TEXT[] DEFAULT '{}',
  referencia TEXT,
  classe TEXT CHECK (classe IS NULL OR classe IN ('A', 'B', 'C', 'D')),
  produtos_fornecidos TEXT,

  -- Pessoa de contato
  contato_nome TEXT,
  cargo TEXT,

  -- Endereço
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,

  -- Presença digital
  website TEXT,
  instagram TEXT,
  whatsapp TEXT,

  -- Dados normalizados (para deduplicação)
  name_normalized TEXT NOT NULL,
  phone_normalized TEXT,
  email_normalized TEXT,
  cpf_digits TEXT,
  cnpj_digits TEXT,

  -- Status e atribuição
  status TEXT NOT NULL DEFAULT 'NOVO' CHECK (status IN ('NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA', 'CONVERTIDO', 'PERDIDO')),
  assigned_to_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  
  -- Auditoria
  created_by_user_id UUID NOT NULL REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4) INTERACTIONS (apontamentos)
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('LIGACAO', 'WHATSAPP', 'EMAIL', 'REUNIAO', 'OUTRO', 'VISITA', 'PROPOSTA_ENVIADA', 'FOLLOW_UP', 'NEGOCIACAO', 'POS_VENDA', 'SUPORTE', 'INDICACAO', 'APRESENTACAO', 'ORCAMENTO')),
  outcome TEXT NOT NULL CHECK (outcome IN ('SEM_RESPOSTA', 'RESPONDEU', 'REUNIAO_MARCADA', 'NAO_INTERESSADO', 'CONVERTIDO', 'SEGUIR_TENTANDO', 'PROPOSTA_ACEITA', 'AGUARDANDO_RETORNO', 'EM_NEGOCIACAO', 'INDICOU_TERCEIRO', 'FECHADO_PARCIAL')),
  note TEXT,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Auditoria (snapshot do usuário)
  created_by_user_id UUID NOT NULL REFERENCES profiles(user_id),
  created_by_name TEXT NOT NULL,
  created_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) IMPORT RUNS (histórico de importações)
CREATE TABLE import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES profiles(user_id),
  
  total_rows INT NOT NULL,
  created_count INT NOT NULL DEFAULT 0,
  duplicate_count INT NOT NULL DEFAULT 0,
  invalid_count INT NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE import_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id UUID NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created', 'duplicate', 'invalid')),
  contact_id UUID REFERENCES contacts(id),
  error_message TEXT,
  data JSONB NOT NULL
);

-- ============================================
-- ÍNDICES
-- ============================================

-- Organizations
CREATE INDEX idx_organizations_created_at ON organizations(created_at);

-- Profiles
CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Contacts - busca e deduplicação
CREATE INDEX idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX idx_contacts_email_normalized ON contacts(organization_id, email_normalized) WHERE email_normalized IS NOT NULL;
CREATE INDEX idx_contacts_phone_normalized ON contacts(organization_id, phone_normalized) WHERE phone_normalized IS NOT NULL;
CREATE INDEX idx_contacts_cpf_digits ON contacts(organization_id, cpf_digits) WHERE cpf_digits IS NOT NULL;
CREATE INDEX idx_contacts_cnpj_digits ON contacts(organization_id, cnpj_digits) WHERE cnpj_digits IS NOT NULL;
CREATE INDEX idx_contacts_status ON contacts(organization_id, status);
CREATE INDEX idx_contacts_assigned_to ON contacts(organization_id, assigned_to_user_id);
CREATE INDEX idx_contacts_name_normalized ON contacts(organization_id, name_normalized);
CREATE INDEX idx_contacts_created_at ON contacts(created_at);
CREATE INDEX idx_contacts_tipo ON contacts USING GIN (tipo);

-- Interactions
CREATE INDEX idx_interactions_organization_id ON interactions(organization_id);
CREATE INDEX idx_interactions_contact_id ON interactions(contact_id);
CREATE INDEX idx_interactions_happened_at ON interactions(happened_at DESC);

-- Import runs
CREATE INDEX idx_import_runs_organization_id ON import_runs(organization_id);
CREATE INDEX idx_import_run_items_import_run_id ON import_run_items(import_run_id);

-- ============================================
-- CONSTRAINTS UNIQUE (DEDUPLICAÇÃO)
-- ============================================

-- Email único por organização (quando preenchido)
CREATE UNIQUE INDEX idx_contacts_unique_email 
  ON contacts(organization_id, email_normalized) 
  WHERE email_normalized IS NOT NULL;

-- Telefone único por organização (quando preenchido)
CREATE UNIQUE INDEX idx_contacts_unique_phone 
  ON contacts(organization_id, phone_normalized) 
  WHERE phone_normalized IS NOT NULL;

-- CPF único por organização (quando preenchido)
CREATE UNIQUE INDEX idx_contacts_unique_cpf 
  ON contacts(organization_id, cpf_digits) 
  WHERE cpf_digits IS NOT NULL;

-- CNPJ único por organização (quando preenchido)
CREATE UNIQUE INDEX idx_contacts_unique_cnpj 
  ON contacts(organization_id, cnpj_digits) 
  WHERE cnpj_digits IS NOT NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger para updated_at em contacts
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interactions_updated_at BEFORE UPDATE ON interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Ativar RLS em todas as tabelas
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_run_items ENABLE ROW LEVEL SECURITY;

-- POLICIES para ORGANIZATIONS
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- POLICIES para PROFILES
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view profiles in their organization"
  ON profiles FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());

-- POLICIES para CONTACTS
CREATE POLICY "Users can view contacts in their organization"
  ON contacts FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert contacts in their organization"
  ON contacts FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update contacts in their organization"
  ON contacts FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete contacts in their organization"
  ON contacts FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- POLICIES para INTERACTIONS
CREATE POLICY "Users can view interactions in their organization"
  ON interactions FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert interactions in their organization"
  ON interactions FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own interactions"
  ON interactions FOR UPDATE
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own interactions"
  ON interactions FOR DELETE
  USING (created_by_user_id = auth.uid());

-- POLICIES para IMPORT_RUNS
CREATE POLICY "Users can view import runs in their organization"
  ON import_runs FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert import runs in their organization"
  ON import_runs FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- POLICIES para IMPORT_RUN_ITEMS
CREATE POLICY "Users can view import items in their organization"
  ON import_run_items FOR SELECT
  USING (import_run_id IN (
    SELECT id FROM import_runs 
    WHERE organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can insert import items in their organization"
  ON import_run_items FOR INSERT
  WITH CHECK (import_run_id IN (
    SELECT id FROM import_runs 
    WHERE organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  ));

-- ============================================
-- FUNÇÃO HELPER: Auto-criar organization no primeiro login
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Criar organização automaticamente
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'name', NEW.email) || '''s Organization')
  RETURNING id INTO new_org_id;
  
  -- Criar profile
  INSERT INTO public.profiles (user_id, organization_id, name, email)
  VALUES (
    NEW.id,
    new_org_id,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar org/profile automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
