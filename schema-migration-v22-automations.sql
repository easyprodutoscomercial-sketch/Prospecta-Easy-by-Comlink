-- Migration v22: Automations & Workflows

CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  pipeline_id UUID REFERENCES pipelines(id),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('STAGE_CHANGE','TIME_IN_STAGE','NO_INTERACTION','CONTACT_CREATED','VALUE_THRESHOLD')),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_type TEXT NOT NULL CHECK (action_type IN ('MOVE_STAGE','SEND_NOTIFICATION','CHANGE_TEMPERATURE','ASSIGN_USER')),
  action_config JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(organization_id, is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  action_taken TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_rule ON automation_executions(rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_executions_org ON automation_executions(organization_id, created_at DESC);

-- RLS
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation rules in their org"
  ON automation_rules FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage automation rules"
  ON automation_rules FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view automation executions in their org"
  ON automation_executions FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Expand notification types to include AUTOMATION
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('RISK_ALERT','NEXT_ACTION','COACHING_TIP','TASK_OVERDUE','STALE_DEAL','NO_OWNER','SYSTEM','MEETING_REMINDER','AUTOMATION'));
