-- Migration: meeting_participants
-- Permite adicionar participantes internos (da org) e externos (email) a reunioes.

CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID,                          -- NULL para participantes externos
  name TEXT,                             -- nome do externo (ou override)
  email TEXT,                            -- email do externo
  is_external BOOLEAN DEFAULT FALSE,     -- flag para saber se e externo
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, user_id),
  UNIQUE(meeting_id, email)
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user_id ON meeting_participants(user_id) WHERE user_id IS NOT NULL;
