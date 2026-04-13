-- Cascade delete: apagou feira → somem todos os contatos, visitas, stands,
-- interacoes, reunioes, anexos, notificacoes, historico de score, execucoes
-- de automacao. Regra do dono.
--
-- Estado antes desta migration (auditado em 2026-04-13):
--   contacts.event_id              SET NULL  (sobreviviam a dele\u00e7\u00e3o)
--   quiz_participantes.contact_id  NO ACTION (bloqueava dele\u00e7\u00e3o)
--   import_run_items.contact_id    NO ACTION (bloqueava dele\u00e7\u00e3o)
--
-- Todas as outras FKs cr\u00edticas (booth_visits, interactions, meetings,
-- contact_attachments, lead_score_history, notifications, custom_fields,
-- automation_executions) j\u00e1 estavam com CASCADE ou SET NULL corretos.

-- 1) contacts.event_id: SET NULL -> CASCADE
-- Quando a feira \u00e9 apagada, contatos da feira v\u00e3o junto.
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_event_id_fkey;
ALTER TABLE contacts ADD CONSTRAINT contacts_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- 2) quiz_participantes.contact_id: NO ACTION -> SET NULL
-- Se o contato \u00e9 apagado, a participa\u00e7\u00e3o no quiz fica an\u00f4nima (valor hist\u00f3rico
-- preservado) mas n\u00e3o bloqueia a dele\u00e7\u00e3o.
ALTER TABLE quiz_participantes DROP CONSTRAINT IF EXISTS quiz_participantes_contact_id_fkey;
ALTER TABLE quiz_participantes ADD CONSTRAINT quiz_participantes_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

-- 3) import_run_items.contact_id: NO ACTION -> SET NULL
-- Se o contato importado e apagado, o item do import fica sem liga\u00e7\u00e3o mas
-- o hist\u00f3rico do import em si fica preservado.
ALTER TABLE import_run_items DROP CONSTRAINT IF EXISTS import_run_items_contact_id_fkey;
ALTER TABLE import_run_items ADD CONSTRAINT import_run_items_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
