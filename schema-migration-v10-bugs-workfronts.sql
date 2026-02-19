-- Migration v10: Bug Reports + Work Fronts
-- Run this in Supabase SQL Editor

-- ============================================
-- WORK FRONTS (Frentes de Trabalho)
-- ============================================

CREATE TABLE IF NOT EXISTS work_fronts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#8B5CF6',
  icon text DEFAULT 'folder',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_fronts_org ON work_fronts(organization_id);

ALTER TABLE work_fronts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_fronts_org" ON work_fronts
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Members
CREATE TABLE IF NOT EXISTS work_front_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_front_id uuid NOT NULL REFERENCES work_fronts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(work_front_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_wf_members_wf ON work_front_members(work_front_id);
CREATE INDEX IF NOT EXISTS idx_wf_members_user ON work_front_members(user_id);

ALTER TABLE work_front_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wf_members_org" ON work_front_members
  USING (work_front_id IN (
    SELECT id FROM work_fronts WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- User active work front
CREATE TABLE IF NOT EXISTS user_active_work_front (
  user_id uuid PRIMARY KEY,
  work_front_id uuid NOT NULL REFERENCES work_fronts(id) ON DELETE CASCADE,
  set_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_active_work_front ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uawf_own" ON user_active_work_front
  USING (user_id = auth.uid());

-- Tags
CREATE TABLE IF NOT EXISTS work_front_tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366F1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE work_front_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wf_tags_org" ON work_front_tags
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Sprints
CREATE TABLE IF NOT EXISTS work_front_sprints (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_front_id uuid NOT NULL REFERENCES work_fronts(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text,
  starts_at date NOT NULL,
  ends_at date NOT NULL,
  status text NOT NULL DEFAULT 'PLANEJADA' CHECK (status IN ('PLANEJADA', 'ATIVA', 'CONCLUIDA', 'CANCELADA')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_sprints_wf ON work_front_sprints(work_front_id);

ALTER TABLE work_front_sprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wf_sprints_org" ON work_front_sprints
  USING (work_front_id IN (
    SELECT id FROM work_fronts WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- ============================================
-- BUG REPORTS
-- ============================================

CREATE TABLE IF NOT EXISTS bug_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'MEDIO' CHECK (severity IN ('CRITICO', 'ALTO', 'MEDIO', 'BAIXO')),
  priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('URGENTE', 'ALTA', 'NORMAL', 'BAIXA')),
  status text NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EM_ANALISE', 'CORRIGINDO', 'TESTE', 'RESOLVIDO')),
  work_front_id uuid REFERENCES work_fronts(id) ON DELETE SET NULL,
  sprint_id uuid REFERENCES work_front_sprints(id) ON DELETE SET NULL,
  reported_by uuid NOT NULL,
  assigned_to uuid,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bugs_org ON bug_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_bugs_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bugs_wf ON bug_reports(work_front_id);
CREATE INDEX IF NOT EXISTS idx_bugs_assigned ON bug_reports(assigned_to);
CREATE INDEX IF NOT EXISTS idx_bugs_created ON bug_reports(created_at);

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bugs_org" ON bug_reports
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Bug <-> Tag junction
CREATE TABLE IF NOT EXISTS bug_report_tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bug_report_id uuid NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES work_front_tags(id) ON DELETE CASCADE,
  UNIQUE(bug_report_id, tag_id)
);

ALTER TABLE bug_report_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bug_tags_org" ON bug_report_tags
  USING (bug_report_id IN (
    SELECT id FROM bug_reports WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- Bug attachments
CREATE TABLE IF NOT EXISTS bug_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bug_report_id uuid NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_att_bug ON bug_attachments(bug_report_id);

ALTER TABLE bug_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bug_att_org" ON bug_attachments
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Bug comments
CREATE TABLE IF NOT EXISTS bug_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bug_report_id uuid NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  content text NOT NULL,
  is_status_change boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_comments_bug ON bug_comments(bug_report_id);

ALTER TABLE bug_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bug_comments_org" ON bug_comments
  USING (bug_report_id IN (
    SELECT id FROM bug_reports WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));
