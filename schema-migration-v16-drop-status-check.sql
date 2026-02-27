-- Migration v16: Remover CHECK constraint do campo status em contacts
-- Com pipelines customizaveis, o status pode ter slugs arbitrarios
-- Rodar no Supabase SQL Editor

-- Descobrir o nome da constraint
-- SELECT conname FROM pg_constraint WHERE conrelid = 'contacts'::regclass AND contype = 'c';

-- Dropar a constraint (nome pode variar; ajustar se necessario)
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_status_check;

-- Alternativa caso o nome seja diferente:
-- DO $$
-- DECLARE
--   constraint_name TEXT;
-- BEGIN
--   SELECT conname INTO constraint_name
--   FROM pg_constraint
--   WHERE conrelid = 'contacts'::regclass
--     AND contype = 'c'
--     AND pg_get_constraintdef(oid) LIKE '%status%';
--   IF constraint_name IS NOT NULL THEN
--     EXECUTE 'ALTER TABLE contacts DROP CONSTRAINT ' || constraint_name;
--   END IF;
-- END $$;
