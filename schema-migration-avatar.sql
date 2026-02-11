-- Migration: Avatar de Usuários
-- Rodar no Supabase SQL Editor

-- 1) Adicionar campo avatar_url ao profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2) Criar bucket de storage para avatares (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3) Policy: qualquer usuário autenticado pode fazer upload no bucket avatars
CREATE POLICY IF NOT EXISTS "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- 4) Policy: qualquer pessoa pode ver avatares (público)
CREATE POLICY IF NOT EXISTS "Public avatar access"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- 5) Policy: usuários podem deletar seus próprios avatares
CREATE POLICY IF NOT EXISTS "Users can delete own avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars');

-- 6) Policy: service_role pode fazer tudo (para admin client)
CREATE POLICY IF NOT EXISTS "Service role full access avatars"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'avatars');
