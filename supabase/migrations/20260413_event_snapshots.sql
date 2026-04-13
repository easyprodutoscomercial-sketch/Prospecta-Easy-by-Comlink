-- Event snapshots: hist\u00f3rico imut\u00e1vel de cada feira encerrada.
-- Serve como "foto" do estado final da feira e sobrevive \u00e0 dele\u00e7\u00e3o do
-- pr\u00f3prio evento. Motivo: o dono quer poder apagar feiras antigas pra
-- limpar agenda sem perder o relat\u00f3rio do que aconteceu (leads, valores,
-- vendedores, breakdown por dia).
--
-- Chave: event_id ON DELETE SET NULL. Apagou a feira, o snapshot fica.
-- event_name e datas s\u00e3o cached no snapshot pra sobreviver mesmo sem FK.

CREATE TABLE IF NOT EXISTS event_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  -- Dados imut\u00e1veis (sobrevivem \u00e0 dele\u00e7\u00e3o do evento)
  event_name TEXT NOT NULL,
  event_location TEXT,
  event_start_date DATE,
  event_end_date DATE,

  -- Payload completo do snapshot (JSONB)
  -- Estrutura documentada em /app/api/events/[id]/snapshot/route.ts
  -- Inclui: total_leads, stand_leads, walk_in_leads, total_booths,
  -- visited_booths, by_user[], by_day[], by_type{}, sellers[],
  -- high_value_deals[], next_actions[]
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Export Excel arquivado no Storage (opcional)
  excel_url TEXT,

  -- Auditoria
  created_by_user_id UUID,
  created_by_name TEXT,
  trigger TEXT NOT NULL CHECK (trigger IN ('auto_encerrado', 'manual')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_snapshots_org
  ON event_snapshots(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_snapshots_event
  ON event_snapshots(event_id) WHERE event_id IS NOT NULL;

-- RLS
ALTER TABLE event_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view event snapshots in their org"
  ON event_snapshots FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert event snapshots in their org"
  ON event_snapshots FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));
