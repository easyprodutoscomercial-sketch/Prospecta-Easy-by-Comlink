-- 2026-04-30: tornar contacts.created_by_user_id NULLABLE.
--
-- Motivacao: contatos criados via fluxos publicos (quiz feira, lead-capture
-- sem dono) eram artificialmente atribuidos ao "primeiro admin" da org pra
-- contornar o NOT NULL. Isso inflava o ranking de vendedores (admin parecia
-- ter "capturado" 200+ contatos no evento que na verdade vieram do QR do
-- quiz). Veja /api/quiz/route.ts (workaround antigo) e
-- /api/events/[id]/sellers/route.ts (ranking).
--
-- Com NULL permitido, o quiz passa a gravar NULL (= "nao tem dono individual,
-- veio do quiz publico") e o ranking ja ignora null naturalmente.

ALTER TABLE contacts
  ALTER COLUMN created_by_user_id DROP NOT NULL;

-- =============================================================
-- ROLLBACK (rodar manualmente se precisar reverter)
-- =============================================================
-- ATENCAO: depois que rodar a migration acima, o quiz comeca a gravar NULL.
-- Pra reverter, antes de re-aplicar NOT NULL, voce PRECISA setar todos os
-- NULLs pra um user_id valido. Senao o ALTER ... SET NOT NULL falha.
--
-- 1. Backfill: NULLs viram o admin atual da org
--   UPDATE contacts c
--   SET created_by_user_id = (
--     SELECT user_id FROM profiles p
--     WHERE p.organization_id = c.organization_id AND p.role = 'admin'
--     ORDER BY p.created_at ASC
--     LIMIT 1
--   )
--   WHERE c.created_by_user_id IS NULL;
--
-- 2. Re-aplica NOT NULL:
--   ALTER TABLE contacts ALTER COLUMN created_by_user_id SET NOT NULL;
--
-- 3. Reverte o codigo do quiz pra setar admin de novo (workaround antigo).
