-- Avatar do contato (foto da pessoa ou cartao de visita).
--
-- Antes desta migration, o walk-in salvava URL de foto no campo `notes`
-- como texto: "Foto da pessoa: https://..." e "Foto do cartao: https://...".
-- Isso era fragil (regex dependente de texto livre). Agora temos uma
-- coluna dedicada `avatar_url` pra render rapido em cards, lista e
-- kanban sem parsing.
--
-- Compatibilidade: o walk-in ainda escreve o URL em notes (pra nao
-- quebrar code paths antigos), mas passa a escrever em avatar_url
-- tambem. Contatos antigos recebem backfill separado em
-- scripts/backfill-avatar-url-from-notes.mjs (rodar manual apos esta
-- migration).

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Backfill inline: extrai "Foto da pessoa" (prioridade) ou
-- "Foto do cartao" (fallback) das notes dos contatos existentes.
UPDATE contacts
SET avatar_url = (
  CASE
    WHEN notes ~ 'Foto da pessoa:\s*(https?://\S+)'
      THEN (regexp_match(notes, 'Foto da pessoa:\s*(https?://\S+)'))[1]
    WHEN notes ~ 'Foto do cartao:\s*(https?://\S+)'
      THEN (regexp_match(notes, 'Foto do cartao:\s*(https?://\S+)'))[1]
    ELSE NULL
  END
)
WHERE avatar_url IS NULL
  AND notes IS NOT NULL
  AND (notes LIKE '%Foto da pessoa:%' OR notes LIKE '%Foto do cartao:%');
