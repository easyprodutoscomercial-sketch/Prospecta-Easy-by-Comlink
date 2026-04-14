-- Adiciona suporte a contatos em rascunho (is_draft).
--
-- Motivacao: quando o vendedor comeca a cadastrar um contato avulso numa feira,
-- ele pode ser interrompido no meio do preenchimento. Antes, o rascunho ficava
-- so no celular (IndexedDB). Agora cada rascunho vira uma linha real em contacts
-- com is_draft=true, o que permite:
--   - ver a lista de rascunhos de qualquer dispositivo
--   - rastrear quantos rascunhos cada vendedor deixou pendentes
--   - dar um ID de verdade desde o primeiro clique
--
-- Regras:
--   - Listagens padrao de contatos (GET /api/contacts, kanban, relatorios,
--     dedupe, lead score, notificacoes) devem filtrar is_draft=false.
--   - Apenas a "aba Rascunhos" mostra is_draft=true.
--   - Finalizacao (is_draft false) passa por dedup e validacao normal.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false;

-- Index parcial so nas linhas que sao rascunho. Pequeno e rapido pra
-- consulta tipo "me mostra meus rascunhos daquele evento".
CREATE INDEX IF NOT EXISTS idx_contacts_is_draft_org
  ON contacts (organization_id, is_draft, event_id, updated_at DESC)
  WHERE is_draft = true;

COMMENT ON COLUMN contacts.is_draft IS
  'true = contato iniciado mas nao finalizado (rascunho de cadastro). Listagens padrao devem filtrar is_draft=false.';
