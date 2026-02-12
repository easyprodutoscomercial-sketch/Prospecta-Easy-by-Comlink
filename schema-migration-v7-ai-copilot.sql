-- Migration V7: AI Sales Copilot + Notificacoes Inteligentes
-- Tabelas: notifications, ai_analysis_cache

-- 1. Tabela de Notificacoes
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('RISK_ALERT','NEXT_ACTION','COACHING_TIP','TASK_OVERDUE','STALE_DEAL','NO_OWNER','SYSTEM')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices para notificacoes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 2. Tabela de Cache de Analise AI
CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Indice para busca de cache
CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup ON ai_analysis_cache(organization_id, analysis_type, cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expiry ON ai_analysis_cache(expires_at);

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Notifications: users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- AI Cache: org-scoped read access
CREATE POLICY "Org members can view cache" ON ai_analysis_cache
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Service role bypasses RLS (used by admin client)
