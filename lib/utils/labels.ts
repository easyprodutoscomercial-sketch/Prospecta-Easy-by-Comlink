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
import type { PipelineSettings } from '@/lib/types';

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

export const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
