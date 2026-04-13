-- ============================================
-- Event Map — pin positions em event_booths
-- ============================================
-- Reaproveita a coluna events.map_url (já existente, sem uso atualmente)
-- para guardar a URL pública da planta do evento.
-- Adiciona position_x/position_y em event_booths como percentuais (0..100).

ALTER TABLE event_booths
  ADD COLUMN IF NOT EXISTS position_x NUMERIC,
  ADD COLUMN IF NOT EXISTS position_y NUMERIC;

COMMENT ON COLUMN event_booths.position_x IS 'Posição horizontal do pin no mapa (0-100%)';
COMMENT ON COLUMN event_booths.position_y IS 'Posição vertical do pin no mapa (0-100%)';
