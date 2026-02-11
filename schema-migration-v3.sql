-- Migration v3: Ownership, Access Requests, Pipeline Settings
-- Executar no Supabase SQL Editor

-- 1) Role no perfil
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('admin', 'user'));

-- Primeiro usuário de cada org vira admin
UPDATE profiles p SET role = 'admin'
WHERE p.user_id = (
  SELECT p2.user_id FROM profiles p2
  WHERE p2.organization_id = p.organization_id
  ORDER BY p2.created_at ASC LIMIT 1
);

-- 2) Tabela de solicitações de acesso
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

-- 3) Config do pipeline na organização
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pipeline_settings JSONB DEFAULT '{}'::jsonb;
