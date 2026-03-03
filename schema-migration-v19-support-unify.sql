-- Migration v19: Unify bugs into support_tickets
-- Adds severity column and migrates bug_reports data

-- 1. Add severity column to support_tickets
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS severity text;

-- 2. Migrate bug_reports → support_tickets
INSERT INTO support_tickets (
  organization_id,
  title,
  description,
  ticket_type,
  category,
  priority,
  severity,
  status,
  contact_id,
  reported_by,
  assigned_to,
  resolution_notes,
  resolved_at,
  created_at,
  updated_at
)
SELECT
  br.organization_id,
  br.title,
  br.description,
  'BUG'::text AS ticket_type,
  'ERRO'::text AS category,
  br.priority,
  br.severity,
  CASE br.status
    WHEN 'ABERTO' THEN 'ABERTO'
    WHEN 'EM_ANALISE' THEN 'EM_ANDAMENTO'
    WHEN 'CORRIGINDO' THEN 'EM_ANDAMENTO'
    WHEN 'TESTE' THEN 'AGUARDANDO'
    WHEN 'RESOLVIDO' THEN 'RESOLVIDO'
    ELSE 'ABERTO'
  END AS status,
  NULL AS contact_id,
  br.reported_by,
  br.assigned_to,
  br.resolution_notes,
  br.resolved_at,
  br.created_at,
  br.updated_at
FROM bug_reports br
WHERE NOT EXISTS (
  SELECT 1 FROM support_tickets st
  WHERE st.title = br.title
    AND st.organization_id = br.organization_id
    AND st.ticket_type = 'BUG'
);

-- 3. Migrate bug_attachments → support_attachments
-- We need to map old bug_report_id to new support_ticket id
INSERT INTO support_attachments (
  organization_id,
  ticket_id,
  file_name,
  file_path,
  file_size,
  mime_type,
  uploaded_by,
  created_at
)
SELECT
  ba.organization_id,
  st.id AS ticket_id,
  ba.file_name,
  ba.file_path,
  ba.file_size,
  ba.mime_type,
  ba.uploaded_by,
  ba.created_at
FROM bug_attachments ba
JOIN bug_reports br ON br.id = ba.bug_report_id
JOIN support_tickets st ON st.title = br.title
  AND st.organization_id = br.organization_id
  AND st.ticket_type = 'BUG'
WHERE NOT EXISTS (
  SELECT 1 FROM support_attachments sa
  WHERE sa.file_path = ba.file_path
);

-- 4. Migrate bug_comments → support_comments
INSERT INTO support_comments (
  ticket_id,
  user_id,
  user_name,
  content,
  is_status_change,
  created_at
)
SELECT
  st.id AS ticket_id,
  bc.user_id,
  bc.user_name,
  bc.content,
  bc.is_status_change,
  bc.created_at
FROM bug_comments bc
JOIN bug_reports br ON br.id = bc.bug_report_id
JOIN support_tickets st ON st.title = br.title
  AND st.organization_id = br.organization_id
  AND st.ticket_type = 'BUG'
WHERE NOT EXISTS (
  SELECT 1 FROM support_comments sc
  WHERE sc.ticket_id = st.id
    AND sc.content = bc.content
    AND sc.created_at = bc.created_at
);
