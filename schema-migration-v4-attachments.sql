-- Migration v4: Anexos de Contatos
-- Rodar no Supabase SQL Editor

-- 1) Tabela contact_attachments
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

-- 2) Indices
CREATE INDEX IF NOT EXISTS idx_contact_attachments_contact_id ON contact_attachments(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_attachments_organization_id ON contact_attachments(organization_id);

-- 3) RLS
ALTER TABLE contact_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments in their org"
  ON contact_attachments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert attachments in their org"
  ON contact_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments in their org"
  ON contact_attachments FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access contact_attachments"
  ON contact_attachments FOR ALL
  TO service_role
  USING (true);

-- 4) Storage bucket para anexos
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 5) Policies de storage
CREATE POLICY IF NOT EXISTS "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY IF NOT EXISTS "Public attachment access"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'attachments');

CREATE POLICY IF NOT EXISTS "Authenticated users can delete attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');

CREATE POLICY IF NOT EXISTS "Service role full access attachments"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'attachments');
