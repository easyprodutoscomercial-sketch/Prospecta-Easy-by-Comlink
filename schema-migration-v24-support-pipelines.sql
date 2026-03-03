-- Migration v24: Support Pipeline - Add pipeline_id and stage_id to support_tickets
-- This allows support tickets to use configurable pipeline stages instead of fixed statuses

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES pipelines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES pipeline_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_pipeline ON support_tickets(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_stage ON support_tickets(stage_id);
