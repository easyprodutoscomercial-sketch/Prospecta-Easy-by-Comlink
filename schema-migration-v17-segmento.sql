-- Migration v17: Add segmento column to contacts
-- Allows segmenting contacts by market segment (Transportadoras, Industria, Varejo, Servicos)

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS segmento TEXT;

-- Index for filtering by segment
CREATE INDEX IF NOT EXISTS idx_contacts_segmento ON contacts(segmento) WHERE segmento IS NOT NULL;
