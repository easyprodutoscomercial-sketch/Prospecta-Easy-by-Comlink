// Centralized labels and colors for statuses, types, interactions, and outcomes

export const STATUS_LABELS: Record<string, string> = {
  NOVO: 'Novo',
  EM_PROSPECCAO: 'Em Prospecção',
  CONTATADO: 'Contatado',
  REUNIAO_MARCADA: 'Reunião Marcada',
  CONVERTIDO: 'Convertido',
  PERDIDO: 'Perdido',
};

export const STATUS_COLORS: Record<string, string> = {
  NOVO: 'bg-neutral-100 text-neutral-700',
  EM_PROSPECCAO: 'bg-amber-100 text-amber-700',
  CONTATADO: 'bg-blue-100 text-blue-700',
  REUNIAO_MARCADA: 'bg-green-100 text-green-700',
  CONVERTIDO: 'bg-emerald-100 text-emerald-700',
  PERDIDO: 'bg-red-100 text-red-700',
};

export const STATUS_CHART_COLORS: Record<string, string> = {
  NOVO: '#a3a3a3',
  EM_PROSPECCAO: '#f59e0b',
  CONTATADO: '#3b82f6',
  REUNIAO_MARCADA: '#22c55e',
  CONVERTIDO: '#10b981',
  PERDIDO: '#ef4444',
};

export const CONTACT_TYPE_LABELS: Record<string, string> = {
  FORNECEDOR: 'Fornecedor',
  COMPRADOR: 'Comprador',
};

export const CONTACT_TYPE_COLORS: Record<string, string> = {
  FORNECEDOR: 'bg-purple-100 text-purple-700',
  COMPRADOR: 'bg-cyan-100 text-cyan-700',
};

// Segmento de mercado — texto livre, cor gerada dinamicamente
export const SEGMENTO_LABELS: Record<string, string> = {};

const SEGMENTO_PALETTE = [
  '#3b82f6', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6',
  '#eab308', '#ef4444', '#06b6d4', '#84cc16', '#f43f5e',
  '#6366f1', '#22c55e', '#d946ef', '#0ea5e9', '#a855f7',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getSegmentoColor(segmento: string): { bg: string; text: string; stripe: string } {
  const color = SEGMENTO_PALETTE[hashString(segmento) % SEGMENTO_PALETTE.length];
  return { bg: '', text: '', stripe: color };
}

export const SEGMENTO_COLORS: Record<string, { bg: string; text: string; stripe: string }> = new Proxy(
  {} as Record<string, { bg: string; text: string; stripe: string }>,
  { get: (_target, prop: string) => getSegmentoColor(prop) }
);

export const CLASSE_LABELS: Record<string, string> = {
  A: 'Classe A',
  B: 'Classe B',
  C: 'Classe C',
  D: 'Classe D',
};

export const INTERACTION_TYPE_LABELS: Record<string, string> = {
  LIGACAO: 'Ligação',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  REUNIAO: 'Reunião',
  OUTRO: 'Outro',
  VISITA: 'Visita',
  PROPOSTA_ENVIADA: 'Proposta Enviada',
  FOLLOW_UP: 'Follow-up',
  NEGOCIACAO: 'Negociação',
  POS_VENDA: 'Pós-Venda',
  SUPORTE: 'Suporte',
  INDICACAO: 'Indicação',
  APRESENTACAO: 'Apresentação',
  ORCAMENTO: 'Orçamento',
};

export const INTERACTION_OUTCOME_LABELS: Record<string, string> = {
  SEM_RESPOSTA: 'Sem Resposta',
  RESPONDEU: 'Respondeu',
  REUNIAO_MARCADA: 'Reunião Marcada',
  NAO_INTERESSADO: 'Não Interessado',
  CONVERTIDO: 'Convertido',
  SEGUIR_TENTANDO: 'Seguir Tentando',
  PROPOSTA_ACEITA: 'Proposta Aceita',
  AGUARDANDO_RETORNO: 'Aguardando Retorno',
  EM_NEGOCIACAO: 'Em Negociação',
  INDICOU_TERCEIRO: 'Indicou Terceiro',
  FECHADO_PARCIAL: 'Fechado Parcial',
};

export function formatStatus(status: string): string {
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || 'bg-neutral-100 text-neutral-700';
}

export function formatInteractionType(type: string): string {
  return INTERACTION_TYPE_LABELS[type] || type;
}

export function formatInteractionOutcome(outcome: string): string {
  return INTERACTION_OUTCOME_LABELS[outcome] || outcome;
}

// Temperatura
export const TEMPERATURA_LABELS: Record<string, string> = {
  FRIO: 'Frio',
  MORNO: 'Morno',
  QUENTE: 'Quente',
};

export const TEMPERATURA_COLORS: Record<string, string> = {
  FRIO: 'bg-blue-100 text-blue-700',
  MORNO: 'bg-amber-100 text-amber-700',
  QUENTE: 'bg-red-100 text-red-700',
};

// Origem
export const ORIGEM_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  INDICACAO: 'Indicação',
  FEIRA: 'Feira',
  LINKEDIN: 'LinkedIn',
  SITE: 'Site',
  WHATSAPP_INBOUND: 'WhatsApp Inbound',
  QRCODE: 'QR Code',
  OUTRO: 'Outro',
};

// Próxima Ação
export const PROXIMA_ACAO_LABELS: Record<string, string> = {
  LIGAR: 'Ligar',
  ENVIAR_WHATSAPP: 'Enviar WhatsApp',
  ENVIAR_EMAIL: 'Enviar Email',
  REUNIAO: 'Reunião',
  VISITA: 'Visita',
  FOLLOW_UP: 'Follow-up',
  ENVIAR_PROPOSTA: 'Enviar Proposta',
  OUTRO: 'Outro',
};

// Motivos de Ganho/Perdido
export const MOTIVO_GANHO_LABELS: Record<string, string> = {
  PRECO: 'Preço',
  QUALIDADE: 'Qualidade',
  ATENDIMENTO: 'Atendimento',
  PRAZO: 'Prazo de Entrega',
  CONFIANCA: 'Confiança',
  OUTRO: 'Outro',
};

export const MOTIVO_PERDIDO_LABELS: Record<string, string> = {
  PRECO: 'Preço',
  CONCORRENTE: 'Concorrente',
  SEM_INTERESSE: 'Sem Interesse',
  SEM_ORCAMENTO: 'Sem Orçamento',
  SEM_RESPOSTA: 'Sem Resposta',
  TIMING: 'Timing',
  OUTRO: 'Outro',
};

// Meeting Status
export const MEETING_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendada',
  COMPLETED: 'Concluida',
  CANCELLED: 'Cancelada',
};

export const MEETING_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-cyan-500/20 text-cyan-400',
  COMPLETED: 'bg-emerald-500/20 text-emerald-400',
  CANCELLED: 'bg-red-500/20 text-red-400',
};

export function formatMeetingStatus(status: string): string {
  return MEETING_STATUS_LABELS[status] || status;
}

// Meeting Type
export const MEETING_TYPE_LABELS: Record<string, string> = {
  PROSPECCAO: 'Prospeccao',
  ALINHAMENTO: 'Alinhamento',
  APRESENTACAO: 'Apresentacao',
  NEGOCIACAO: 'Negociacao',
  FOLLOW_UP: 'Follow-up',
  POS_VENDA: 'Pos-venda',
  SUPORTE: 'Suporte',
  OUTRO: 'Outro',
};

export const MEETING_TYPE_COLORS: Record<string, string> = {
  PROSPECCAO: 'bg-cyan-500/20 text-cyan-400',
  ALINHAMENTO: 'bg-purple-500/20 text-purple-400',
  APRESENTACAO: 'bg-blue-500/20 text-blue-400',
  NEGOCIACAO: 'bg-amber-500/20 text-amber-400',
  FOLLOW_UP: 'bg-orange-500/20 text-orange-400',
  POS_VENDA: 'bg-emerald-500/20 text-emerald-400',
  SUPORTE: 'bg-pink-500/20 text-pink-400',
  OUTRO: 'bg-neutral-500/20 text-neutral-400',
};

export function formatMeetingType(type: string): string {
  return MEETING_TYPE_LABELS[type] || type;
}

// Activity Templates (quick interaction templates)
export const ACTIVITY_TEMPLATES = [
  { label: 'Liguei — não atendeu', type: 'LIGACAO', outcome: 'SEM_RESPOSTA', note: 'Liguei — não atendeu' },
  { label: 'WhatsApp enviado', type: 'WHATSAPP', outcome: 'AGUARDANDO_RETORNO', note: 'WhatsApp enviado' },
  { label: 'Email enviado', type: 'EMAIL', outcome: 'AGUARDANDO_RETORNO', note: 'Email enviado' },
  { label: 'Reunião realizada', type: 'REUNIAO', outcome: 'RESPONDEU', note: 'Reunião realizada' },
  { label: 'Proposta enviada', type: 'PROPOSTA_ENVIADA', outcome: 'AGUARDANDO_RETORNO', note: 'Proposta enviada' },
  { label: 'Follow-up realizado', type: 'FOLLOW_UP', outcome: 'SEGUIR_TENTANDO', note: 'Follow-up realizado' },
] as const;

// Pipeline settings helpers
import type { PipelineSettings, PipelineStage } from '@/lib/types';

export function getColumnLabel(status: string, settings?: PipelineSettings | null): string {
  if (settings?.columns?.[status as keyof typeof settings.columns]) {
    return settings.columns[status as keyof typeof settings.columns].label;
  }
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

export function getColumnColor(status: string, settings?: PipelineSettings | null): string {
  if (settings?.columns?.[status as keyof typeof settings.columns]) {
    return settings.columns[status as keyof typeof settings.columns].color;
  }
  return STATUS_CHART_COLORS[status] || '#a3a3a3';
}

// Dynamic stage helpers
export function getStageLabel(stage: PipelineStage): string {
  return stage.name;
}

export function getStageColor(stage: PipelineStage): string {
  return stage.color || '#a3a3a3';
}

export function isTerminalStage(stage: PipelineStage): boolean {
  return stage.is_terminal;
}

export function getTerminalType(stage: PipelineStage): 'won' | 'lost' | null {
  return stage.terminal_type;
}

export const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

// AI Copilot Labels
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  RISK_ALERT: 'Alerta de Risco',
  NEXT_ACTION: 'Proxima Acao',
  COACHING_TIP: 'Dica de Coaching',
  TASK_OVERDUE: 'Tarefa Atrasada',
  STALE_DEAL: 'Negocio Parado',
  NO_OWNER: 'Sem Responsavel',
  SYSTEM: 'Sistema',
};

export const RISK_LEVEL_LABELS: Record<string, string> = {
  CRITICAL: 'Critico',
  HIGH: 'Alto',
  MEDIUM: 'Medio',
  LOW: 'Baixo',
};

export const RISK_LEVEL_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-blue-100 text-blue-700',
};

export const MESSAGE_CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  ligacao: 'Ligacao',
};

export const MESSAGE_INTENT_LABELS: Record<string, string> = {
  primeiro_contato: 'Primeiro contato',
  follow_up: 'Follow-up',
  reagendar: 'Reagendar reuniao',
  enviar_proposta: 'Enviar proposta',
  cobrar_retorno: 'Cobrar retorno',
  pos_reuniao: 'Pos-reuniao',
  reativacao: 'Reativacao',
};

// ============================================
// Bug Reports Labels & Colors
// ============================================

export const BUG_SEVERITY_LABELS: Record<string, string> = {
  CRITICO: 'Critico',
  ALTO: 'Alto',
  MEDIO: 'Medio',
  BAIXO: 'Baixo',
};

export const BUG_SEVERITY_COLORS: Record<string, string> = {
  CRITICO: 'bg-red-500/20 text-red-400',
  ALTO: 'bg-orange-500/20 text-orange-400',
  MEDIO: 'bg-amber-500/20 text-amber-400',
  BAIXO: 'bg-blue-500/20 text-blue-400',
};

export const BUG_PRIORITY_LABELS: Record<string, string> = {
  URGENTE: 'Urgente',
  ALTA: 'Alta',
  NORMAL: 'Normal',
  BAIXA: 'Baixa',
};

export const BUG_PRIORITY_COLORS: Record<string, string> = {
  URGENTE: 'bg-red-500/20 text-red-400',
  ALTA: 'bg-orange-500/20 text-orange-400',
  NORMAL: 'bg-neutral-500/20 text-neutral-400',
  BAIXA: 'bg-blue-500/20 text-blue-400',
};

export const BUG_STATUS_LABELS: Record<string, string> = {
  ABERTO: 'Aberto',
  EM_ANALISE: 'Em Analise',
  CORRIGINDO: 'Corrigindo',
  TESTE: 'Em Teste',
  RESOLVIDO: 'Resolvido',
};

export const BUG_STATUS_COLORS: Record<string, string> = {
  ABERTO: 'bg-red-500/20 text-red-400',
  EM_ANALISE: 'bg-amber-500/20 text-amber-400',
  CORRIGINDO: 'bg-blue-500/20 text-blue-400',
  TESTE: 'bg-purple-500/20 text-purple-400',
  RESOLVIDO: 'bg-emerald-500/20 text-emerald-400',
};

export const BUG_STATUS_CHART_COLORS: Record<string, string> = {
  ABERTO: '#ef4444',
  EM_ANALISE: '#f59e0b',
  CORRIGINDO: '#3b82f6',
  TESTE: '#8b5cf6',
  RESOLVIDO: '#10b981',
};

export const BUG_KANBAN_COLUMNS = [
  { id: 'ABERTO', label: 'Aberto', color: '#ef4444' },
  { id: 'EM_ANALISE', label: 'Em Analise', color: '#f59e0b' },
  { id: 'CORRIGINDO', label: 'Corrigindo', color: '#3b82f6' },
  { id: 'TESTE', label: 'Em Teste', color: '#8b5cf6' },
  { id: 'RESOLVIDO', label: 'Resolvido', color: '#10b981' },
];

// Sprint
export const SPRINT_STATUS_LABELS: Record<string, string> = {
  PLANEJADA: 'Planejada',
  ATIVA: 'Ativa',
  CONCLUIDA: 'Concluida',
  CANCELADA: 'Cancelada',
};

export const SPRINT_STATUS_COLORS: Record<string, string> = {
  PLANEJADA: 'bg-neutral-500/20 text-neutral-400',
  ATIVA: 'bg-emerald-500/20 text-emerald-400',
  CONCLUIDA: 'bg-blue-500/20 text-blue-400',
  CANCELADA: 'bg-red-500/20 text-red-400',
};

// Work Front Roles
export const WF_ROLE_LABELS: Record<string, string> = {
  lead: 'Lider',
  member: 'Membro',
};

// ============================================
// Support Tickets Labels & Colors
// ============================================

export const SUPPORT_TYPE_LABELS: Record<string, string> = {
  SUPORTE: 'Suporte',
  TAREFA: 'Tarefa',
  BUG: 'Bug',
};

export const SUPPORT_TYPE_COLORS: Record<string, string> = {
  SUPORTE: 'bg-orange-500/20 text-orange-400',
  TAREFA: 'bg-cyan-500/20 text-cyan-400',
  BUG: 'bg-red-500/20 text-red-400',
};

export const SUPPORT_SEVERITY_LABELS: Record<string, string> = {
  CRITICO: 'Critico',
  ALTO: 'Alto',
  MEDIO: 'Medio',
  BAIXO: 'Baixo',
};

export const SUPPORT_SEVERITY_COLORS: Record<string, string> = {
  CRITICO: 'bg-red-500/20 text-red-400',
  ALTO: 'bg-orange-500/20 text-orange-400',
  MEDIO: 'bg-amber-500/20 text-amber-400',
  BAIXO: 'bg-blue-500/20 text-blue-400',
};

export const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  ERRO: 'Erro',
  DUVIDA: 'Duvida',
  MELHORIA: 'Melhoria',
  ENTREGA: 'Entrega',
  CONFIGURACAO: 'Configuracao',
  GERAL: 'Geral',
};

export const SUPPORT_CATEGORY_COLORS: Record<string, string> = {
  ERRO: 'bg-red-500/20 text-red-400',
  DUVIDA: 'bg-blue-500/20 text-blue-400',
  MELHORIA: 'bg-purple-500/20 text-purple-400',
  ENTREGA: 'bg-emerald-500/20 text-emerald-400',
  CONFIGURACAO: 'bg-amber-500/20 text-amber-400',
  GERAL: 'bg-neutral-500/20 text-neutral-400',
};

export const SUPPORT_PRIORITY_LABELS: Record<string, string> = {
  URGENTE: 'Urgente',
  ALTA: 'Alta',
  NORMAL: 'Normal',
  BAIXA: 'Baixa',
};

export const SUPPORT_PRIORITY_COLORS: Record<string, string> = {
  URGENTE: 'bg-red-500/20 text-red-400',
  ALTA: 'bg-orange-500/20 text-orange-400',
  NORMAL: 'bg-neutral-500/20 text-neutral-400',
  BAIXA: 'bg-blue-500/20 text-blue-400',
};

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em Andamento',
  AGUARDANDO: 'Aguardando',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
};

export const SUPPORT_STATUS_COLORS: Record<string, string> = {
  ABERTO: 'bg-red-500/20 text-red-400',
  EM_ANDAMENTO: 'bg-blue-500/20 text-blue-400',
  AGUARDANDO: 'bg-amber-500/20 text-amber-400',
  RESOLVIDO: 'bg-emerald-500/20 text-emerald-400',
  FECHADO: 'bg-neutral-500/20 text-neutral-400',
};

export const SUPPORT_STATUS_CHART_COLORS: Record<string, string> = {
  ABERTO: '#ef4444',
  EM_ANDAMENTO: '#3b82f6',
  AGUARDANDO: '#f59e0b',
  RESOLVIDO: '#10b981',
  FECHADO: '#6b7280',
};

export const SUPPORT_KANBAN_COLUMNS = [
  { id: 'ABERTO', label: 'Aberto', color: '#ef4444' },
  { id: 'EM_ANDAMENTO', label: 'Em Andamento', color: '#3b82f6' },
  { id: 'AGUARDANDO', label: 'Aguardando', color: '#f59e0b' },
  { id: 'RESOLVIDO', label: 'Resolvido', color: '#10b981' },
  { id: 'FECHADO', label: 'Fechado', color: '#6b7280' },
];

// ============================================
// Pedidos & Cotacoes Labels & Colors
// ============================================

export const PC_CLIENT_STATUS_LABELS: Record<string, string> = {
  SIM: 'Sim',
  NAO: 'Nao',
  AGUARDANDO_ACEITE: 'Aguardando Aceite',
  PRE_CADASTRO: 'Pre-Cadastro',
};

export const PC_CLIENT_STATUS_COLORS: Record<string, string> = {
  SIM: 'bg-emerald-500/20 text-emerald-400',
  NAO: 'bg-red-500/20 text-red-400',
  AGUARDANDO_ACEITE: 'bg-amber-500/20 text-amber-400',
  PRE_CADASTRO: 'bg-blue-500/20 text-blue-400',
};

export const PC_COTACAO_RESPOSTA_LABELS: Record<string, string> = {
  RESPONDEU: 'Respondeu',
  NAO_RESPONDEU: 'Nao Respondeu',
};

export const PC_COTACAO_RESPOSTA_COLORS: Record<string, string> = {
  RESPONDEU: 'bg-emerald-500/20 text-emerald-400',
  NAO_RESPONDEU: 'bg-red-500/20 text-red-400',
};

export const PC_PEDIDO_SITUACAO_LABELS: Record<string, string> = {
  PENDENTE: 'Pendente',
  ACEITO: 'Aceito',
  RECUSADO: 'Recusado',
  EM_ANDAMENTO: 'Em Andamento',
  FINALIZADO: 'Finalizado',
};

export const PC_PEDIDO_SITUACAO_COLORS: Record<string, string> = {
  PENDENTE: 'bg-amber-500/20 text-amber-400',
  ACEITO: 'bg-emerald-500/20 text-emerald-400',
  RECUSADO: 'bg-red-500/20 text-red-400',
  EM_ANDAMENTO: 'bg-blue-500/20 text-blue-400',
  FINALIZADO: 'bg-purple-500/20 text-purple-400',
};

export const PC_PEDIDO_SITUACAO_BORDER_COLORS: Record<string, string> = {
  PENDENTE: 'border-l-amber-500',
  ACEITO: 'border-l-emerald-500',
  RECUSADO: 'border-l-red-500',
  EM_ANDAMENTO: 'border-l-blue-500',
  FINALIZADO: 'border-l-purple-500',
};

export const PC_PEDIDO_KANBAN_COLUMNS = [
  { id: 'PENDENTE', label: 'Pendente', color: '#f59e0b' },
  { id: 'EM_ANDAMENTO', label: 'Em Andamento', color: '#3b82f6' },
  { id: 'ACEITO', label: 'Aceito', color: '#10b981' },
  { id: 'RECUSADO', label: 'Recusado', color: '#ef4444' },
  { id: 'FINALIZADO', label: 'Finalizado', color: '#8b5cf6' },
];
