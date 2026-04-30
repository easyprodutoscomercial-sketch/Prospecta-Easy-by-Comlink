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
