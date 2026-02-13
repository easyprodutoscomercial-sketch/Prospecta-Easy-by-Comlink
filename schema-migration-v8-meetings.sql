-- Migration V8: Meetings (calendario de reunioes) + scheduled notifications

-- 1. Tabela de reunioes
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  location TEXT,
  meeting_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  notifications_generated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_meetings_org ON meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_meetings_contact ON meetings(contact_id);
CREATE INDEX IF NOT EXISTS idx_meetings_user ON meetings(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_at ON meetings(meeting_at);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

-- 2. Coluna scheduled_for na tabela notifications (para notificacoes escalonadas)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- Index para buscar notificacoes prontas para exibir
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for);

-- 3. Adicionar MEETING_REMINDER ao CHECK constraint de notifications.type
-- Primeiro remove o constraint antigo, depois adiciona o novo com MEETING_REMINDER
DO $$
BEGIN
  -- Tenta remover constraint existente (pode ter nomes diferentes)
  BEGIN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notification_type;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Adiciona novo constraint com MEETING_REMINDER
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('RISK_ALERT', 'NEXT_ACTION', 'COACHING_TIP', 'TASK_OVERDUE', 'STALE_DEAL', 'NO_OWNER', 'SYSTEM', 'MEETING_REMINDER'));
END $$;

-- 4. RLS para meetings
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY meetings_org_policy ON meetings
  FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));
