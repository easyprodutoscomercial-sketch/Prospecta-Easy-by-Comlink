-- Suporte a "Associacao" como campo extra em feiras especificas.
--
-- Algumas feiras (ex: ORPLANA) precisam capturar a qual associacao/cooperativa
-- o contato pertence. Em vez de adicionar o campo em TODOS os walk-ins/avulsos,
-- o evento tem uma flag e o form (vendedor e cliente) renderiza o campo
-- condicionalmente.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS uses_association BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS associacao TEXT;

COMMENT ON COLUMN events.uses_association IS
  'true = feira captura "Associacao" como campo adicional no cadastro de contato.';
COMMENT ON COLUMN contacts.associacao IS
  'Nome da associacao/cooperativa do contato. So preenchido quando capturado em feira com uses_association=true.';

-- Liga o flag pra ORPLANA (usa case-insensitive pra pegar variacoes)
UPDATE events
  SET uses_association = true
  WHERE UPPER(name) LIKE '%ORPLANA%';
