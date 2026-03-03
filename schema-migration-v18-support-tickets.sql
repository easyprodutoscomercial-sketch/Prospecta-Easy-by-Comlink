-- Migration v18: Support Tickets (Suporte / Tarefas)
-- Run in Supabase SQL Editor

-- ============================================
-- 1. support_tickets
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  ticket_type text NOT NULL DEFAULT 'SUPORTE',       -- SUPORTE | TAREFA
  category text NOT NULL DEFAULT 'GERAL',             -- ERRO | DUVIDA | MELHORIA | ENTREGA | CONFIGURACAO | GERAL
  priority text NOT NULL DEFAULT 'NORMAL',            -- URGENTE | ALTA | NORMAL | BAIXA
  status text NOT NULL DEFAULT 'ABERTO',              -- ABERTO | EM_ANDAMENTO | AGUARDANDO | RESOLVIDO | FECHADO
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  reported_by uuid NOT NULL,
  assigned_to uuid,
  due_date date,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_type ON support_tickets(organization_id, ticket_type);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(organization_id, priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_contact ON support_tickets(contact_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_due ON support_tickets(due_date) WHERE due_date IS NOT NULL;

-- RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets_select" ON support_tickets
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "support_tickets_insert" ON support_tickets
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "support_tickets_update" ON support_tickets
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "support_tickets_delete" ON support_tickets
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 2. support_comments
-- ============================================
CREATE TABLE IF NOT EXISTS support_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  content text NOT NULL,
  is_status_change boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_comments_ticket ON support_comments(ticket_id);

ALTER TABLE support_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_comments_select" ON support_comments
  FOR SELECT USING (
    ticket_id IN (
      SELECT id FROM support_tickets WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "support_comments_insert" ON support_comments
  FOR INSERT WITH CHECK (
    ticket_id IN (
      SELECT id FROM support_tickets WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================
-- 3. support_attachments
-- ============================================
CREATE TABLE IF NOT EXISTS support_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_attachments_ticket ON support_attachments(ticket_id);

ALTER TABLE support_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_attachments_select" ON support_attachments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "support_attachments_insert" ON support_attachments
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "support_attachments_delete" ON support_attachments
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER trigger_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_support_tickets_updated_at();
