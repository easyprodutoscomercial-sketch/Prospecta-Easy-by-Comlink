-- Adiciona colunas pra dados do mapa oficial (Zapt) em event_booths.
-- polygon: array de segmentos [[x1,y1],[x2,y2]] pra desenhar a forma do stand
-- zapt_id: referencia ao ID do stand no sistema Zapt (pra resync futuro)

ALTER TABLE event_booths
  ADD COLUMN IF NOT EXISTS polygon JSONB,
  ADD COLUMN IF NOT EXISTS zapt_id TEXT;

CREATE INDEX IF NOT EXISTS idx_event_booths_zapt_id
  ON event_booths(zapt_id)
  WHERE zapt_id IS NOT NULL;
