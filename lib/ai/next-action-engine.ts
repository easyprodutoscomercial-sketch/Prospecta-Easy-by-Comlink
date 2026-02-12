import { ContactStatus, ProximaAcaoTipo, InteractionType, InteractionOutcome } from '@/lib/types';
import { ActionSuggestion, ContactForAnalysis } from './types';

interface ActionRule {
  status: ContactStatus[];
  lastInteractionType?: InteractionType[] | null; // null = no interactions
  lastOutcome?: InteractionOutcome[];
  minDays?: number;
  maxDays?: number;
  action: ProximaAcaoTipo;
  reason: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Decision matrix for next action suggestions
const ACTION_RULES: ActionRule[] = [
  // NOVO — no interactions
  {
    status: ['NOVO'],
    lastInteractionType: null,
    action: 'LIGAR',
    reason: 'Fazer primeiro contato por telefone',
    priority: 'HIGH',
  },
  // NOVO — called, no answer (0-1 days)
  {
    status: ['NOVO'],
    lastInteractionType: ['LIGACAO'],
    lastOutcome: ['SEM_RESPOSTA'],
    minDays: 0,
    maxDays: 1,
    action: 'ENVIAR_WHATSAPP',
    reason: 'Ligação sem resposta, tentar WhatsApp',
    priority: 'HIGH',
  },
  // NOVO — WhatsApp sent, no answer (1-2 days)
  {
    status: ['NOVO'],
    lastInteractionType: ['WHATSAPP'],
    lastOutcome: ['SEM_RESPOSTA', 'AGUARDANDO_RETORNO'],
    minDays: 1,
    maxDays: 2,
    action: 'LIGAR',
    reason: 'WhatsApp sem resposta, tentar ligação',
    priority: 'HIGH',
  },
  // NOVO — Email sent, no answer
  {
    status: ['NOVO'],
    lastInteractionType: ['EMAIL'],
    lastOutcome: ['SEM_RESPOSTA', 'AGUARDANDO_RETORNO'],
    minDays: 2,
    maxDays: 5,
    action: 'LIGAR',
    reason: 'Email sem resposta, tentar contato direto',
    priority: 'MEDIUM',
  },
  // EM_PROSPECCAO — responded (0-2 days)
  {
    status: ['EM_PROSPECCAO'],
    lastOutcome: ['RESPONDEU', 'SEGUIR_TENTANDO'],
    minDays: 0,
    maxDays: 2,
    action: 'REUNIAO',
    reason: 'Contato respondeu, agendar reunião enquanto quente',
    priority: 'HIGH',
  },
  // EM_PROSPECCAO — no answer, try again
  {
    status: ['EM_PROSPECCAO'],
    lastOutcome: ['SEM_RESPOSTA'],
    minDays: 2,
    maxDays: 5,
    action: 'FOLLOW_UP',
    reason: 'Sem resposta em prospecção, fazer follow-up',
    priority: 'MEDIUM',
  },
  // CONTATADO — responded (0-3 days)
  {
    status: ['CONTATADO'],
    lastOutcome: ['RESPONDEU', 'SEGUIR_TENTANDO', 'EM_NEGOCIACAO'],
    minDays: 0,
    maxDays: 3,
    action: 'REUNIAO',
    reason: 'Contato ativo, agendar reunião ou enviar proposta',
    priority: 'HIGH',
  },
  // CONTATADO — awaiting return
  {
    status: ['CONTATADO'],
    lastOutcome: ['AGUARDANDO_RETORNO'],
    minDays: 3,
    maxDays: 7,
    action: 'FOLLOW_UP',
    reason: 'Aguardando retorno há alguns dias, cobrar',
    priority: 'MEDIUM',
  },
  // REUNIAO_MARCADA — after meeting
  {
    status: ['REUNIAO_MARCADA'],
    lastInteractionType: ['REUNIAO', 'VISITA', 'APRESENTACAO'],
    minDays: 0,
    maxDays: 1,
    action: 'ENVIAR_PROPOSTA',
    reason: 'Reunião realizada, enviar proposta',
    priority: 'HIGH',
  },
  // REUNIAO_MARCADA — proposal sent, waiting
  {
    status: ['REUNIAO_MARCADA'],
    lastInteractionType: ['PROPOSTA_ENVIADA', 'ORCAMENTO'],
    lastOutcome: ['AGUARDANDO_RETORNO'],
    minDays: 3,
    action: 'FOLLOW_UP',
    reason: 'Proposta enviada há dias, cobrar retorno',
    priority: 'HIGH',
  },
  // REUNIAO_MARCADA — negotiating
  {
    status: ['REUNIAO_MARCADA'],
    lastOutcome: ['EM_NEGOCIACAO'],
    minDays: 2,
    action: 'FOLLOW_UP',
    reason: 'Em negociação, manter contato ativo',
    priority: 'MEDIUM',
  },
  // Any active — referred to third party
  {
    status: ['NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA'],
    lastOutcome: ['INDICOU_TERCEIRO'],
    minDays: 0,
    action: 'LIGAR',
    reason: 'Indicou terceiro, entrar em contato com a indicação',
    priority: 'MEDIUM',
  },
];

function daysSince(dateStr: string): number {
  const now = new Date();
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function suggestNextAction(contact: ContactForAnalysis): ActionSuggestion | null {
  // Only for active contacts
  const activeStatuses: ContactStatus[] = ['NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA'];
  if (!activeStatuses.includes(contact.status)) return null;

  const lastInteraction = contact.interactions.length > 0 ? contact.interactions[0] : null;
  const daysSinceLastInteraction = lastInteraction
    ? daysSince(lastInteraction.happened_at)
    : daysSince(contact.created_at);

  for (const rule of ACTION_RULES) {
    // Check status match
    if (!rule.status.includes(contact.status)) continue;

    // Check interaction type match
    if (rule.lastInteractionType === null) {
      // Rule requires no interactions
      if (contact.interactions.length > 0) continue;
    } else if (rule.lastInteractionType !== undefined) {
      if (!lastInteraction) continue;
      if (!rule.lastInteractionType.includes(lastInteraction.type)) continue;
    }

    // Check outcome match
    if (rule.lastOutcome) {
      if (!lastInteraction) continue;
      if (!rule.lastOutcome.includes(lastInteraction.outcome)) continue;
    }

    // Check day range
    if (rule.minDays !== undefined && daysSinceLastInteraction < rule.minDays) continue;
    if (rule.maxDays !== undefined && daysSinceLastInteraction > rule.maxDays) continue;

    return {
      action: rule.action,
      reason: rule.reason,
      priority: rule.priority,
      contactId: contact.id,
      contactName: contact.name,
    };
  }

  // Fallback: generic follow-up for active contacts with no matching rule
  if (daysSinceLastInteraction > 3) {
    return {
      action: 'FOLLOW_UP',
      reason: `Sem atividade há ${daysSinceLastInteraction} dias, fazer follow-up`,
      priority: 'MEDIUM',
      contactId: contact.id,
      contactName: contact.name,
    };
  }

  return null;
}
