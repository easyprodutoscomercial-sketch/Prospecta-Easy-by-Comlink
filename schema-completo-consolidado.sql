-- ============================================
-- MINI CRM - SQL CONSOLIDADO COMPLETO
-- Gerado em: 2026-02-18
-- Rodar no Supabase SQL Editor em ORDEM
-- (cada secao pode ser rodada separadamente)
-- ============================================


-- ============================================================
-- PARTE 1: TABELAS BASE (schema.sql)
-- ============================================================

-- 1) ORGANIZATIONS
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) PROFILES (usuarios)
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) CONTACTS
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  cpf TEXT,
  cnpj TEXT,
  company TEXT,
  notes TEXT,
  tipo TEXT[] DEFAULT '{}',
  referencia TEXT,
  classe TEXT CHECK (classe IS NULL OR classe IN ('A', 'B', 'C', 'D')),
  produtos_fornecidos TEXT,
  contato_nome TEXT,
  cargo TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  website TEXT,
  instagram TEXT,
  whatsapp TEXT,
  telefones_adicionais JSONB DEFAULT '[]'::jsonb,
  name_normalized TEXT NOT NULL,
  phone_normalized TEXT,
  email_normalized TEXT,
  cpf_digits TEXT,
  cnpj_digits TEXT,
  status TEXT NOT NULL DEFAULT 'NOVO' CHECK (status IN ('NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA', 'CONVERTIDO', 'PERDIDO')),
  assigned_to_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_by_user_id UUID NOT NULL REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4) INTERACTIONS (apontamentos)
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('LIGACAO', 'WHATSAPP', 'EMAIL', 'REUNIAO', 'OUTRO', 'VISITA', 'PROPOSTA_ENVIADA', 'FOLLOW_UP', 'NEGOCIACAO', 'POS_VENDA', 'SUPORTE', 'INDICACAO', 'APRESENTACAO', 'ORCAMENTO')),
  outcome TEXT NOT NULL CHECK (outcome IN ('SEM_RESPOSTA', 'RESPONDEU', 'REUNIAO_MARCADA', 'NAO_INTERESSADO', 'CONVERTIDO', 'SEGUIR_TENTANDO', 'PROPOSTA_ACEITA', 'AGUARDANDO_RETORNO', 'EM_NEGOCIACAO', 'INDICOU_TERCEIRO', 'FECHADO_PARCIAL')),
  note TEXT,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id UUID NOT NULL REFERENCES profiles(user_id),
  created_by_name TEXT NOT NULL,
  created_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) IMPORT RUNS
CREATE TABLE IF NOT EXISTS import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES profiles(user_id),
  total_rows INT NOT NULL,
  created_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  duplicate_count INT NOT NULL DEFAULT 0,
  invalid_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id UUID NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created', 'updated', 'duplicate', 'invalid')),
  contact_id UUID REFERENCES contacts(id),
  error_message TEXT,
  data JSONB NOT NULL
);


-- ============================================================
-- PARTE 2: INDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email_normalized ON contacts(organization_id, email_normalized) WHERE email_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone_normalized ON contacts(organization_id, phone_normalized) WHERE phone_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_cpf_digits ON contacts(organization_id, cpf_digits) WHERE cpf_digits IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_cnpj_digits ON contacts(organization_id, cnpj_digits) WHERE cnpj_digits IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(organization_id, assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name_normalized ON contacts(organization_id, name_normalized);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_tipo ON contacts USING GIN (tipo);
CREATE INDEX IF NOT EXISTS idx_interactions_organization_id ON interactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_interactions_contact_id ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_happened_at ON interactions(happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_runs_organization_id ON import_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_import_run_items_import_run_id ON import_run_items(import_run_id);


-- ============================================================
-- PARTE 3: UNIQUE CONSTRAINTS (deduplicacao)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_unique_email
  ON contacts(organization_id, email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_unique_phone
  ON contacts(organization_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_unique_cpf
  ON contacts(organization_id, cpf_digits)
  WHERE cpf_digits IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_unique_cnpj
  ON contacts(organization_id, cnpj_digits)
  WHERE cnpj_digits IS NOT NULL;


-- ============================================================
-- PARTE 4: TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_interactions_updated_at ON interactions;
CREATE TRIGGER update_interactions_updated_at BEFORE UPDATE ON interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- PARTE 5: RLS (Row Level Security)
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_run_items ENABLE ROW LEVEL SECURITY;

-- Organizations
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;
CREATE POLICY "Users can view profiles in their organization"
  ON profiles FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Contacts
DROP POLICY IF EXISTS "Users can view contacts in their organization" ON contacts;
CREATE POLICY "Users can view contacts in their organization"
  ON contacts FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert contacts in their organization" ON contacts;
CREATE POLICY "Users can insert contacts in their organization"
  ON contacts FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update contacts in their organization" ON contacts;
CREATE POLICY "Users can update contacts in their organization"
  ON contacts FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete contacts in their organization" ON contacts;
CREATE POLICY "Users can delete contacts in their organization"
  ON contacts FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Interactions
DROP POLICY IF EXISTS "Users can view interactions in their organization" ON interactions;
CREATE POLICY "Users can view interactions in their organization"
  ON interactions FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert interactions in their organization" ON interactions;
CREATE POLICY "Users can insert interactions in their organization"
  ON interactions FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own interactions" ON interactions;
CREATE POLICY "Users can update their own interactions"
  ON interactions FOR UPDATE
  USING (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own interactions" ON interactions;
CREATE POLICY "Users can delete their own interactions"
  ON interactions FOR DELETE
  USING (created_by_user_id = auth.uid());

-- Import Runs
DROP POLICY IF EXISTS "Users can view import runs in their organization" ON import_runs;
CREATE POLICY "Users can view import runs in their organization"
  ON import_runs FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert import runs in their organization" ON import_runs;
CREATE POLICY "Users can insert import runs in their organization"
  ON import_runs FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Import Run Items
DROP POLICY IF EXISTS "Users can view import items in their organization" ON import_run_items;
CREATE POLICY "Users can view import items in their organization"
  ON import_run_items FOR SELECT
  USING (import_run_id IN (
    SELECT id FROM import_runs
    WHERE organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Users can insert import items in their organization" ON import_run_items;
CREATE POLICY "Users can insert import items in their organization"
  ON import_run_items FOR INSERT
  WITH CHECK (import_run_id IN (
    SELECT id FROM import_runs
    WHERE organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  ));


-- ============================================================
-- PARTE 6: FUNCAO AUTO-CRIAR ORG NO PRIMEIRO LOGIN
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
BEGIN
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'name', NEW.email) || '''s Organization')
  RETURNING id INTO new_org_id;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- PARTE 7: MIGRATION V2 - Qualificacao
-- ============================================================

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


-- ============================================================
-- PARTE 8: MIGRATION V3 - Role, Access Requests, Pipeline Settings
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('admin', 'user'));

-- Primeiro usuario de cada org vira admin
UPDATE profiles p SET role = 'admin'
WHERE p.user_id = (
  SELECT p2.user_id FROM profiles p2
  WHERE p2.organization_id = p.organization_id
  ORDER BY p2.created_at ASC LIMIT 1
);

CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES profiles(user_id),
  owner_user_id UUID NOT NULL REFERENCES profiles(user_id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_unique_pending
  ON access_requests(contact_id, requester_user_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_access_requests_owner ON access_requests(owner_user_id, status);

-- Pipeline settings (JSONB) na organizacao
-- Aqui fica: columns, broadcast_*, banner_toggle_visible, etc.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pipeline_settings JSONB DEFAULT '{}'::jsonb;


-- ============================================================
-- PARTE 9: MIGRATION AVATAR
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload avatars"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Public avatar access"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own avatars"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access avatars"
    ON storage.objects FOR ALL TO service_role
    USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- PARTE 10: MIGRATION V4 - Anexos de Contatos
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by_user_id UUID NOT NULL,
  uploaded_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_attachments_contact_id ON contact_attachments(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_attachments_organization_id ON contact_attachments(organization_id);

ALTER TABLE contact_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view attachments in their org" ON contact_attachments;
CREATE POLICY "Users can view attachments in their org"
  ON contact_attachments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert attachments in their org" ON contact_attachments;
CREATE POLICY "Users can insert attachments in their org"
  ON contact_attachments FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete attachments in their org" ON contact_attachments;
CREATE POLICY "Users can delete attachments in their org"
  ON contact_attachments FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role full access contact_attachments" ON contact_attachments;
CREATE POLICY "Service role full access contact_attachments"
  ON contact_attachments FOR ALL TO service_role
  USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload attachments"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'attachments');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Public attachment access"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'attachments');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can delete attachments"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'attachments');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access attachments"
    ON storage.objects FOR ALL TO service_role
    USING (bucket_id = 'attachments');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- PARTE 11: MIGRATION V5 - Valor Estimado
-- ============================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS valor_estimado DECIMAL(12,2) DEFAULT NULL;


-- ============================================================
-- PARTE 12: MIGRATION V6 - Backfill Dados Normalizados
-- ============================================================

UPDATE contacts
SET phone_normalized = regexp_replace(phone, '\D', '', 'g')
WHERE phone IS NOT NULL AND phone != ''
  AND (phone_normalized IS NULL OR phone_normalized = '');

UPDATE contacts
SET email_normalized = lower(trim(email))
WHERE email IS NOT NULL AND email != ''
  AND (email_normalized IS NULL OR email_normalized = '');

UPDATE contacts
SET cpf_digits = regexp_replace(cpf, '\D', '', 'g')
WHERE cpf IS NOT NULL AND cpf != ''
  AND (cpf_digits IS NULL OR cpf_digits = '')
  AND length(regexp_replace(cpf, '\D', '', 'g')) = 11;

UPDATE contacts
SET cnpj_digits = regexp_replace(cnpj, '\D', '', 'g')
WHERE cnpj IS NOT NULL AND cnpj != ''
  AND (cnpj_digits IS NULL OR cnpj_digits = '')
  AND length(regexp_replace(cnpj, '\D', '', 'g')) = 14;

UPDATE contacts
SET name_normalized = trim(regexp_replace(name, '\s+', ' ', 'g'))
WHERE name IS NOT NULL
  AND (name_normalized IS NULL OR name_normalized = '');


-- ============================================================
-- PARTE 13: MIGRATION V7 - AI Copilot + Notificacoes
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('RISK_ALERT','NEXT_ACTION','COACHING_TIP','TASK_OVERDUE','STALE_DEAL','NO_OWNER','SYSTEM','MEETING_REMINDER')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for);

CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup ON ai_analysis_cache(organization_id, analysis_type, cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expiry ON ai_analysis_cache(expires_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Org members can view cache" ON ai_analysis_cache;
CREATE POLICY "Org members can view cache" ON ai_analysis_cache
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );


-- ============================================================
-- PARTE 14: MIGRATION V8 - Meetings (Calendario)
-- ============================================================

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  location TEXT,
  meeting_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  notifications_generated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_org ON meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_meetings_contact ON meetings(contact_id);
CREATE INDEX IF NOT EXISTS idx_meetings_user ON meetings(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_at ON meetings(meeting_at);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meetings_org_policy ON meetings;
CREATE POLICY meetings_org_policy ON meetings
  FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));


-- ============================================================
-- PARTE 15: MIGRATION V9 - Multi-Pipeline + Stages
-- ============================================================

CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  "position" INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#a3a3a3',
  "position" INT NOT NULL DEFAULT 0,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  terminal_type TEXT CHECK (terminal_type IS NULL OR terminal_type IN ('won', 'lost')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id);

CREATE INDEX IF NOT EXISTS idx_pipelines_org ON pipelines(organization_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_contacts_pipeline ON contacts(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(stage_id);

ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pipelines_select_org ON pipelines;
CREATE POLICY pipelines_select_org ON pipelines FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS pipelines_all_org ON pipelines;
CREATE POLICY pipelines_all_org ON pipelines FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS stages_select_org ON pipeline_stages;
CREATE POLICY stages_select_org ON pipeline_stages FOR SELECT
  USING (pipeline_id IN (SELECT id FROM pipelines WHERE organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS stages_all_org ON pipeline_stages;
CREATE POLICY stages_all_org ON pipeline_stages FOR ALL
  USING (pipeline_id IN (SELECT id FROM pipelines WHERE organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())));


-- ============================================================
-- PARTE 16: MIGRATION V9 BACKFILL - Criar pipeline "Vendas" + migrar contatos
-- ============================================================

DO $$
DECLARE
  org_rec RECORD;
  pip_id UUID;
  stage_novo UUID;
  stage_prospeccao UUID;
  stage_contatado UUID;
  stage_reuniao UUID;
  stage_convertido UUID;
  stage_perdido UUID;
BEGIN
  FOR org_rec IN
    SELECT id FROM organizations
    WHERE id NOT IN (SELECT DISTINCT organization_id FROM pipelines)
  LOOP
    INSERT INTO pipelines (organization_id, name, description, is_default, "position")
    VALUES (org_rec.id, 'Vendas', 'Pipeline principal de vendas', true, 0)
    RETURNING id INTO pip_id;

    INSERT INTO pipeline_stages (pipeline_id, name, slug, color, "position", is_terminal, terminal_type)
    VALUES (pip_id, 'Novo', 'NOVO', '#a3a3a3', 0, false, NULL)
    RETURNING id INTO stage_novo;

    INSERT INTO pipeline_stages (pipeline_id, name, slug, color, "position", is_terminal, terminal_type)
    VALUES (pip_id, 'Em Prospecao', 'EM_PROSPECCAO', '#f59e0b', 1, false, NULL)
    RETURNING id INTO stage_prospeccao;

    INSERT INTO pipeline_stages (pipeline_id, name, slug, color, "position", is_terminal, terminal_type)
    VALUES (pip_id, 'Contatado', 'CONTATADO', '#3b82f6', 2, false, NULL)
    RETURNING id INTO stage_contatado;

    INSERT INTO pipeline_stages (pipeline_id, name, slug, color, "position", is_terminal, terminal_type)
    VALUES (pip_id, 'Reuniao Marcada', 'REUNIAO_MARCADA', '#22c55e', 3, false, NULL)
    RETURNING id INTO stage_reuniao;

    INSERT INTO pipeline_stages (pipeline_id, name, slug, color, "position", is_terminal, terminal_type)
    VALUES (pip_id, 'Convertido', 'CONVERTIDO', '#10b981', 4, true, 'won')
    RETURNING id INTO stage_convertido;

    INSERT INTO pipeline_stages (pipeline_id, name, slug, color, "position", is_terminal, terminal_type)
    VALUES (pip_id, 'Perdido', 'PERDIDO', '#ef4444', 5, true, 'lost')
    RETURNING id INTO stage_perdido;

    UPDATE contacts SET pipeline_id = pip_id, stage_id = stage_novo
    WHERE organization_id = org_rec.id AND status = 'NOVO' AND pipeline_id IS NULL;

    UPDATE contacts SET pipeline_id = pip_id, stage_id = stage_prospeccao
    WHERE organization_id = org_rec.id AND status = 'EM_PROSPECCAO' AND pipeline_id IS NULL;

    UPDATE contacts SET pipeline_id = pip_id, stage_id = stage_contatado
    WHERE organization_id = org_rec.id AND status = 'CONTATADO' AND pipeline_id IS NULL;

    UPDATE contacts SET pipeline_id = pip_id, stage_id = stage_reuniao
    WHERE organization_id = org_rec.id AND status = 'REUNIAO_MARCADA' AND pipeline_id IS NULL;

    UPDATE contacts SET pipeline_id = pip_id, stage_id = stage_convertido
    WHERE organization_id = org_rec.id AND status = 'CONVERTIDO' AND pipeline_id IS NULL;

    UPDATE contacts SET pipeline_id = pip_id, stage_id = stage_perdido
    WHERE organization_id = org_rec.id AND status = 'PERDIDO' AND pipeline_id IS NULL;

  END LOOP;
END
$$;


-- ============================================================
-- PARTE 17: MIGRATION V10 - Work Fronts + Bug Reports
-- ============================================================

-- Work Fronts
CREATE TABLE IF NOT EXISTS work_fronts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#8B5CF6',
  icon text DEFAULT 'folder',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_fronts_org ON work_fronts(organization_id);

ALTER TABLE work_fronts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "work_fronts_org" ON work_fronts;
CREATE POLICY "work_fronts_org" ON work_fronts
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Work Front Members
CREATE TABLE IF NOT EXISTS work_front_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_front_id uuid NOT NULL REFERENCES work_fronts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(work_front_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_wf_members_wf ON work_front_members(work_front_id);
CREATE INDEX IF NOT EXISTS idx_wf_members_user ON work_front_members(user_id);

ALTER TABLE work_front_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wf_members_org" ON work_front_members;
CREATE POLICY "wf_members_org" ON work_front_members
  USING (work_front_id IN (
    SELECT id FROM work_fronts WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- User Active Work Front
CREATE TABLE IF NOT EXISTS user_active_work_front (
  user_id uuid PRIMARY KEY,
  work_front_id uuid NOT NULL REFERENCES work_fronts(id) ON DELETE CASCADE,
  set_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_active_work_front ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "uawf_own" ON user_active_work_front;
CREATE POLICY "uawf_own" ON user_active_work_front
  USING (user_id = auth.uid());

-- Work Front Tags
CREATE TABLE IF NOT EXISTS work_front_tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366F1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE work_front_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wf_tags_org" ON work_front_tags;
CREATE POLICY "wf_tags_org" ON work_front_tags
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Work Front Sprints
CREATE TABLE IF NOT EXISTS work_front_sprints (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_front_id uuid NOT NULL REFERENCES work_fronts(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text,
  starts_at date NOT NULL,
  ends_at date NOT NULL,
  status text NOT NULL DEFAULT 'PLANEJADA' CHECK (status IN ('PLANEJADA', 'ATIVA', 'CONCLUIDA', 'CANCELADA')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_sprints_wf ON work_front_sprints(work_front_id);

ALTER TABLE work_front_sprints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wf_sprints_org" ON work_front_sprints;
CREATE POLICY "wf_sprints_org" ON work_front_sprints
  USING (work_front_id IN (
    SELECT id FROM work_fronts WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- Bug Reports
CREATE TABLE IF NOT EXISTS bug_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'MEDIO' CHECK (severity IN ('CRITICO', 'ALTO', 'MEDIO', 'BAIXO')),
  priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('URGENTE', 'ALTA', 'NORMAL', 'BAIXA')),
  status text NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EM_ANALISE', 'CORRIGINDO', 'TESTE', 'RESOLVIDO')),
  work_front_id uuid REFERENCES work_fronts(id) ON DELETE SET NULL,
  sprint_id uuid REFERENCES work_front_sprints(id) ON DELETE SET NULL,
  reported_by uuid NOT NULL,
  assigned_to uuid,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bugs_org ON bug_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_bugs_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bugs_wf ON bug_reports(work_front_id);
CREATE INDEX IF NOT EXISTS idx_bugs_assigned ON bug_reports(assigned_to);
CREATE INDEX IF NOT EXISTS idx_bugs_created ON bug_reports(created_at);

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bugs_org" ON bug_reports;
CREATE POLICY "bugs_org" ON bug_reports
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Bug <-> Tag junction
CREATE TABLE IF NOT EXISTS bug_report_tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bug_report_id uuid NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES work_front_tags(id) ON DELETE CASCADE,
  UNIQUE(bug_report_id, tag_id)
);

ALTER TABLE bug_report_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bug_tags_org" ON bug_report_tags;
CREATE POLICY "bug_tags_org" ON bug_report_tags
  USING (bug_report_id IN (
    SELECT id FROM bug_reports WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- Bug Attachments
CREATE TABLE IF NOT EXISTS bug_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bug_report_id uuid NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_att_bug ON bug_attachments(bug_report_id);

ALTER TABLE bug_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bug_att_org" ON bug_attachments;
CREATE POLICY "bug_att_org" ON bug_attachments
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Bug Comments
CREATE TABLE IF NOT EXISTS bug_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bug_report_id uuid NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  content text NOT NULL,
  is_status_change boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_comments_bug ON bug_comments(bug_report_id);

ALTER TABLE bug_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bug_comments_org" ON bug_comments;
CREATE POLICY "bug_comments_org" ON bug_comments
  USING (bug_report_id IN (
    SELECT id FROM bug_reports WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));


-- ============================================================
-- PARTE 18: MIGRATION V10 - Pipeline Members
-- ============================================================

CREATE TABLE IF NOT EXISTS pipeline_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pipeline_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_members_pipeline ON pipeline_members(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_members_user ON pipeline_members(user_id);

ALTER TABLE pipeline_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pipeline_members_select ON pipeline_members;
CREATE POLICY pipeline_members_select ON pipeline_members FOR SELECT
  USING (pipeline_id IN (
    SELECT id FROM pipelines WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS pipeline_members_all ON pipeline_members;
CREATE POLICY pipeline_members_all ON pipeline_members FOR ALL
  USING (pipeline_id IN (
    SELECT id FROM pipelines WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- Backfill: todos os usuarios existentes viram membros de todos os pipelines
INSERT INTO pipeline_members (pipeline_id, user_id)
SELECT p.id, pr.user_id
FROM pipelines p
JOIN profiles pr ON pr.organization_id = p.organization_id
ON CONFLICT (pipeline_id, user_id) DO NOTHING;


-- ============================================================
-- PARTE 19: VIEWS EM PORTUGUES (opcional)
-- ============================================================

CREATE OR REPLACE VIEW vw_organizacoes AS
SELECT id, name AS nome, pipeline_settings AS configuracoes_pipeline, created_at AS criado_em
FROM organizations;

CREATE OR REPLACE VIEW vw_perfis AS
SELECT user_id AS id_usuario, organization_id AS id_organizacao, name AS nome, email, role AS funcao, avatar_url AS foto_url, created_at AS criado_em
FROM profiles;

CREATE OR REPLACE VIEW vw_contatos AS
SELECT
  id, organization_id AS id_organizacao, name AS nome, phone AS telefone, email, cpf, cnpj,
  company AS empresa, notes AS observacoes, tipo, referencia, classe, produtos_fornecidos,
  contato_nome AS nome_contato, cargo, endereco, cidade, estado, cep, website, instagram, whatsapp,
  temperatura, origem, proxima_acao_tipo AS proxima_acao, proxima_acao_data AS data_proxima_acao,
  motivo_ganho_perdido, valor_estimado, status, assigned_to_user_id AS id_responsavel,
  created_by_user_id AS id_criador, created_at AS criado_em, updated_at AS atualizado_em
FROM contacts;

CREATE OR REPLACE VIEW vw_interacoes AS
SELECT
  id, organization_id AS id_organizacao, contact_id AS id_contato, type AS tipo, outcome AS resultado,
  note AS nota, happened_at AS data_ocorrencia, created_by_user_id AS id_criador,
  created_by_name AS nome_criador, created_by_email AS email_criador,
  created_at AS criado_em, updated_at AS atualizado_em
FROM interactions;

CREATE OR REPLACE VIEW vw_reunioes AS
SELECT
  id, organization_id AS id_organizacao, contact_id AS id_contato, created_by_user_id AS id_criador,
  title AS titulo, notes AS notas, location AS local, meeting_at AS data_reuniao,
  duration_minutes AS duracao_minutos, status, notifications_generated AS notificacoes_geradas,
  created_at AS criado_em, updated_at AS atualizado_em
FROM meetings;

CREATE OR REPLACE VIEW vw_notificacoes AS
SELECT
  id, organization_id AS id_organizacao, user_id AS id_usuario, type AS tipo, title AS titulo,
  body AS corpo, contact_id AS id_contato, metadata AS metadados, read AS lida,
  dismissed AS dispensada, scheduled_for AS agendada_para, created_at AS criado_em
FROM notifications;

CREATE OR REPLACE VIEW vw_solicitacoes_acesso AS
SELECT
  id, organization_id AS id_organizacao, contact_id AS id_contato,
  requester_user_id AS id_solicitante, owner_user_id AS id_proprietario,
  status, created_at AS criado_em, resolved_at AS resolvido_em
FROM access_requests;

CREATE OR REPLACE VIEW vw_anexos AS
SELECT
  id, organization_id AS id_organizacao, contact_id AS id_contato,
  file_name AS nome_arquivo, file_path AS caminho_arquivo, file_size AS tamanho_bytes,
  mime_type AS tipo_arquivo, uploaded_by_user_id AS id_enviador, uploaded_by_name AS nome_enviador,
  created_at AS criado_em
FROM contact_attachments;

CREATE OR REPLACE VIEW vw_importacoes AS
SELECT
  id, organization_id AS id_organizacao, created_by_user_id AS id_criador,
  total_rows AS total_linhas, created_count AS qtd_criados, duplicate_count AS qtd_duplicados,
  invalid_count AS qtd_invalidos, created_at AS criado_em
FROM import_runs;

CREATE OR REPLACE VIEW vw_itens_importacao AS
SELECT
  id, import_run_id AS id_importacao, row_number AS numero_linha, status,
  contact_id AS id_contato, error_message AS mensagem_erro, data AS dados
FROM import_run_items;

CREATE OR REPLACE VIEW vw_cache_analise AS
SELECT
  id, organization_id AS id_organizacao, analysis_type AS tipo_analise,
  cache_key AS chave_cache, result AS resultado, created_at AS criado_em, expires_at AS expira_em
FROM ai_analysis_cache;


-- ============================================
-- FIM - SQL CONSOLIDADO COMPLETO
-- 19 partes | 24 tabelas | 9 views
-- ============================================
