export type ContactStatus =
  | 'NOVO'
  | 'EM_PROSPECCAO'
  | 'CONTATADO'
  | 'REUNIAO_MARCADA'
  | 'CONVERTIDO'
  | 'PERDIDO';

export type ContactType = 'FORNECEDOR' | 'COMPRADOR';

export type Temperatura = 'FRIO' | 'MORNO' | 'QUENTE';

export type Origem = 'MANUAL' | 'INDICACAO' | 'FEIRA' | 'LINKEDIN' | 'SITE' | 'WHATSAPP_INBOUND' | 'OUTRO';

export type ProximaAcaoTipo = 'LIGAR' | 'ENVIAR_WHATSAPP' | 'ENVIAR_EMAIL' | 'REUNIAO' | 'VISITA' | 'FOLLOW_UP' | 'ENVIAR_PROPOSTA' | 'OUTRO';

export type InteractionType =
  | 'LIGACAO'
  | 'WHATSAPP'
  | 'EMAIL'
  | 'REUNIAO'
  | 'OUTRO'
  | 'VISITA'
  | 'PROPOSTA_ENVIADA'
  | 'FOLLOW_UP'
  | 'NEGOCIACAO'
  | 'POS_VENDA'
  | 'SUPORTE'
  | 'INDICACAO'
  | 'APRESENTACAO'
  | 'ORCAMENTO';

export type InteractionOutcome =
  | 'SEM_RESPOSTA'
  | 'RESPONDEU'
  | 'REUNIAO_MARCADA'
  | 'NAO_INTERESSADO'
  | 'CONVERTIDO'
  | 'SEGUIR_TENTANDO'
  | 'PROPOSTA_ACEITA'
  | 'AGUARDANDO_RETORNO'
  | 'EM_NEGOCIACAO'
  | 'INDICOU_TERCEIRO'
  | 'FECHADO_PARCIAL';

export interface Contact {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  cnpj: string | null;
  company: string | null;
  notes: string | null;
  // Tipo e classificação
  tipo: ContactType[];
  referencia: string | null;
  classe: string | null;
  produtos_fornecidos: string | null;
  // Pessoa de contato
  contato_nome: string | null;
  cargo: string | null;
  // Endereço
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  // Presença digital
  website: string | null;
  instagram: string | null;
  whatsapp: string | null;
  // Normalizados
  name_normalized: string;
  phone_normalized: string | null;
  email_normalized: string | null;
  cpf_digits: string | null;
  cnpj_digits: string | null;
  // Qualificação
  temperatura: Temperatura | null;
  origem: Origem | null;
  proxima_acao_tipo: ProximaAcaoTipo | null;
  proxima_acao_data: string | null;
  motivo_ganho_perdido: string | null;
  valor_estimado: number | null;
  // Pipeline
  pipeline_id: string | null;
  stage_id: string | null;
  // Status e atribuição
  status: ContactStatus;
  assigned_to_user_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  organization_id: string;
  contact_id: string;
  type: InteractionType;
  outcome: InteractionOutcome;
  note: string | null;
  happened_at: string;
  created_by_user_id: string;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'admin' | 'user';

export interface Profile {
  user_id: string;
  organization_id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  visible_menus?: string[];
  created_at: string;
}

export interface AccessRequest {
  id: string;
  organization_id: string;
  contact_id: string;
  requester_user_id: string;
  owner_user_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  resolved_at: string | null;
  requester_name?: string;
  requester_email?: string;
  owner_name?: string;
  owner_email?: string;
  contact_name?: string;
}

export interface PipelineSettings {
  columns: Record<ContactStatus, { label: string; color: string }>;
}

export type PipelineType = 'PADRAO' | 'BUGS';

export interface Pipeline {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  pipeline_type: PipelineType;
  is_default: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  slug: string;
  color: string;
  icon?: string | null;
  position: number;
  is_terminal: boolean;
  terminal_type: 'won' | 'lost' | null;
  allow_meeting?: boolean;
  created_at: string;
}

export interface PipelineMember {
  id: string;
  pipeline_id: string;
  user_id: string;
  created_at: string;
}

export interface PipelineWithStages extends Pipeline {
  stages: PipelineStage[];
  members?: PipelineMember[];
}

export interface ImportResult {
  total_rows: number;
  created_count: number;
  updated_count: number;
  duplicate_count: number;
  invalid_count: number;
  items: {
    row_number: number;
    status: 'created' | 'updated' | 'duplicate' | 'invalid';
    contact_id?: string;
    error_message?: string;
    data: any;
  }[];
}

export interface ContactAttachment {
  id: string;
  organization_id: string;
  contact_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by_user_id: string;
  uploaded_by_name: string;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  email: string;
  contacts_created: number;
  interactions_count: number;
  meetings_count: number;
  conversions_count: number;
}

export type MeetingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface Meeting {
  id: string;
  organization_id: string;
  contact_id: string;
  created_by_user_id: string;
  title: string;
  notes: string | null;
  location: string | null;
  meeting_at: string;
  duration_minutes: number;
  status: MeetingStatus;
  notifications_generated: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Work Fronts
// ============================================

export type WorkFrontRole = 'lead' | 'member';

export type SprintStatus = 'PLANEJADA' | 'ATIVA' | 'CONCLUIDA' | 'CANCELADA';

export interface WorkFront {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkFrontMember {
  id: string;
  work_front_id: string;
  user_id: string;
  role: WorkFrontRole;
  joined_at: string;
  // joined from profiles
  user_name?: string;
  user_email?: string;
  avatar_url?: string | null;
}

export interface WorkFrontWithMembers extends WorkFront {
  members: WorkFrontMember[];
  bug_count?: number;
  active_sprint?: WorkFrontSprint | null;
}

export interface UserActiveWorkFront {
  user_id: string;
  work_front_id: string;
  set_at: string;
}

export interface WorkFrontTag {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface WorkFrontSprint {
  id: string;
  work_front_id: string;
  name: string;
  goal: string | null;
  starts_at: string;
  ends_at: string;
  status: SprintStatus;
  created_at: string;
  updated_at: string;
}

// ============================================
// Bug Reports
// ============================================

export type BugSeverity = 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO';

export type BugPriority = 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';

export type BugStatus = 'ABERTO' | 'EM_ANALISE' | 'CORRIGINDO' | 'TESTE' | 'RESOLVIDO';

export interface BugReport {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  severity: BugSeverity;
  priority: BugPriority;
  status: BugStatus;
  work_front_id: string | null;
  sprint_id: string | null;
  reported_by: string;
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  reported_by_name?: string;
  assigned_to_name?: string;
  work_front_name?: string;
  tags?: WorkFrontTag[];
}

export interface BugAttachment {
  id: string;
  organization_id: string;
  bug_report_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
  public_url?: string;
}

export interface BugComment {
  id: string;
  bug_report_id: string;
  user_id: string;
  user_name: string;
  content: string;
  is_status_change: boolean;
  created_at: string;
}

// ============================================
// Custom Fields
// ============================================

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean';

export interface PipelineCustomField {
  id: string;
  organization_id: string;
  pipeline_id: string;
  name: string;
  slug: string;
  field_type: CustomFieldType;
  options: string[] | null;
  is_required: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ContactCustomFieldValue {
  id: string;
  organization_id: string;
  contact_id: string;
  field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
  created_at: string;
  updated_at: string;
}

// Re-export AI types for convenience
export type { Notification, RiskAlert, ActionSuggestion, PipelineHealth } from '@/lib/ai/types';
