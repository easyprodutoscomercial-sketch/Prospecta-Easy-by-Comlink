-- ============================================
-- Link contatos a eventos (feiras)
-- ============================================
-- Adiciona coluna event_id em contacts para:
--   1. Saber de qual feira o contato veio
--   2. Migrar pipeline/stage junto com o evento
--   3. Filtrar contatos/kanban por feira especifica
--   4. Mostrar banner do evento em cards

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_event_id ON contacts(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_org_event ON contacts(organization_id, event_id) WHERE event_id IS NOT NULL;
