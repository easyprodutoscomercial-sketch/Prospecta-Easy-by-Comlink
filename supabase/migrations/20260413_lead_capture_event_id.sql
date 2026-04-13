-- Amarra lead_capture_link a um evento especifico (opcional).
-- Permite criar QR Code "Agrishow 2026" ja travado no evento certo,
-- sem precisar escolher manualmente no momento de gerar o QR do stand.
--
-- Links existentes ficam com event_id NULL (modo generico) e continuam
-- funcionando igual. Nada quebra.

ALTER TABLE lead_capture_links
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lead_capture_links_event
  ON lead_capture_links(event_id) WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_capture_links_org_event
  ON lead_capture_links(organization_id, event_id) WHERE event_id IS NOT NULL;
