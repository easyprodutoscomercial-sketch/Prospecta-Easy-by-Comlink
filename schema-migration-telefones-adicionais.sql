-- Migration: Adicionar coluna telefones_adicionais na tabela contacts
-- Execução: Rodar no Supabase SQL Editor

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS telefones_adicionais JSONB DEFAULT '[]'::jsonb;
