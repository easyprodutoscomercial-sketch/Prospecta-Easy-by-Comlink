import { ContactStatus, ProximaAcaoTipo, InteractionType, InteractionOutcome } from '@/lib/types';

// Risk levels
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Risk rule identifiers
export type RiskRule =
  | 'STALE_DEAL'
  | 'NO_NEXT_ACTION'
  | 'TASK_OVERDUE'
  | 'NO_OWNER'
  | 'NEVER_CONTACTED'
  | 'HIGH_VALUE_AT_RISK'
  | 'COOLING_DOWN';

// Notification types
export type NotificationType =
  | 'RISK_ALERT'
  | 'NEXT_ACTION'
  | 'COACHING_TIP'
  | 'TASK_OVERDUE'
  | 'STALE_DEAL'
  | 'NO_OWNER'
  | 'SYSTEM';

// Risk alert
export interface RiskAlert {
  rule: RiskRule;
  level: RiskLevel;
  title: string;
  description: string;
  contactId?: string;
  contactName?: string;
  daysStale?: number;
  value?: number;
}

// Suggested next action
export interface ActionSuggestion {
  action: ProximaAcaoTipo;
  reason: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  contactId: string;
  contactName: string;
}

// Notification
export interface Notification {
  id: string;
  organization_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  contact_id: string | null;
  metadata: Record<string, any>;
  read: boolean;
  dismissed: boolean;
  created_at: string;
}

// Pipeline health metrics
export interface PipelineHealth {
  atRisk: number;
  stale: number;
  noOwner: number;
  noNextAction: number;
  totalActive: number;
  totalValue: number;
  avgDaysInStage: Record<string, number>;
  conversionRate: number;
  coachingTips: string[];
}

// Message generation
export type MessageChannel = 'whatsapp' | 'email' | 'ligacao';
export type MessageIntent =
  | 'primeiro_contato'
  | 'follow_up'
  | 'reagendar'
  | 'enviar_proposta'
  | 'cobrar_retorno'
  | 'pos_reuniao'
  | 'reativacao';

export interface GeneratedMessage {
  channel: MessageChannel;
  intent: MessageIntent;
  subject?: string; // for email
  body: string;
}

// SLA config per stage
export interface StageSLA {
  warnDays: number;
  criticalDays: number;
}

// Contact with interactions for analysis
export interface ContactForAnalysis {
  id: string;
  name: string;
  status: ContactStatus;
  temperatura: string | null;
  origem: string | null;
  proxima_acao_tipo: ProximaAcaoTipo | null;
  proxima_acao_data: string | null;
  valor_estimado: number | null;
  assigned_to_user_id: string | null;
  created_at: string;
  updated_at: string;
  company: string | null;
  interactions: {
    type: InteractionType;
    outcome: InteractionOutcome;
    happened_at: string;
    created_at: string;
  }[];
}
