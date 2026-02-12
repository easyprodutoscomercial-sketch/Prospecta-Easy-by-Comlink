import { ContactStatus } from '@/lib/types';
import { RiskAlert, RiskLevel, ContactForAnalysis, StageSLA } from './types';

// SLA per stage (days)
const STAGE_SLA: Record<string, StageSLA> = {
  NOVO: { warnDays: 2, criticalDays: 5 },
  EM_PROSPECCAO: { warnDays: 5, criticalDays: 10 },
  CONTATADO: { warnDays: 3, criticalDays: 7 },
  REUNIAO_MARCADA: { warnDays: 5, criticalDays: 10 },
};

// Active statuses (exclude terminal)
const ACTIVE_STATUSES: ContactStatus[] = ['NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA'];

function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function isActive(status: string): boolean {
  return ACTIVE_STATUSES.includes(status as ContactStatus);
}

// Rule 1: Negocio parado — dias sem atualizar > SLA da etapa
function checkStaleDeal(contact: ContactForAnalysis, now: Date): RiskAlert | null {
  if (!isActive(contact.status)) return null;

  const sla = STAGE_SLA[contact.status];
  if (!sla) return null;

  const daysStale = daysBetween(contact.updated_at, now);

  if (daysStale >= sla.criticalDays) {
    return {
      rule: 'STALE_DEAL',
      level: 'CRITICAL',
      title: 'Negócio parado',
      description: `${contact.name} está há ${daysStale} dias sem atualização na etapa ${contact.status.replace(/_/g, ' ')}`,
      contactId: contact.id,
      contactName: contact.name,
      daysStale,
    };
  }

  if (daysStale >= sla.warnDays) {
    return {
      rule: 'STALE_DEAL',
      level: 'HIGH',
      title: 'Negócio esfriando',
      description: `${contact.name} está há ${daysStale} dias sem atualização`,
      contactId: contact.id,
      contactName: contact.name,
      daysStale,
    };
  }

  return null;
}

// Rule 2: Sem proxima acao
function checkNoNextAction(contact: ContactForAnalysis): RiskAlert | null {
  if (!isActive(contact.status)) return null;
  if (contact.proxima_acao_tipo || contact.proxima_acao_data) return null;

  return {
    rule: 'NO_NEXT_ACTION',
    level: 'MEDIUM',
    title: 'Sem próxima ação',
    description: `${contact.name} não tem próxima ação definida`,
    contactId: contact.id,
    contactName: contact.name,
  };
}

// Rule 3: Tarefa atrasada
function checkTaskOverdue(contact: ContactForAnalysis, now: Date): RiskAlert | null {
  if (!contact.proxima_acao_data) return null;

  const actionDate = new Date(contact.proxima_acao_data);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((today.getTime() - actionDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return null;

  const level: RiskLevel = diffDays >= 3 ? 'CRITICAL' : 'HIGH';

  return {
    rule: 'TASK_OVERDUE',
    level,
    title: 'Tarefa atrasada',
    description: `${contact.name} tem ação "${contact.proxima_acao_tipo}" atrasada há ${diffDays} dia(s)`,
    contactId: contact.id,
    contactName: contact.name,
    daysStale: diffDays,
  };
}

// Rule 4: Sem responsavel
function checkNoOwner(contact: ContactForAnalysis): RiskAlert | null {
  if (!isActive(contact.status)) return null;
  if (contact.assigned_to_user_id) return null;

  return {
    rule: 'NO_OWNER',
    level: 'MEDIUM',
    title: 'Sem responsável',
    description: `${contact.name} não tem vendedor atribuído`,
    contactId: contact.id,
    contactName: contact.name,
  };
}

// Rule 5: Nunca contatado — 0 interacoes e criado ha >3 dias
function checkNeverContacted(contact: ContactForAnalysis, now: Date): RiskAlert | null {
  if (!isActive(contact.status)) return null;
  if (contact.interactions.length > 0) return null;

  const daysSinceCreation = daysBetween(contact.created_at, now);
  if (daysSinceCreation <= 3) return null;

  return {
    rule: 'NEVER_CONTACTED',
    level: 'HIGH',
    title: 'Nunca contatado',
    description: `${contact.name} foi criado há ${daysSinceCreation} dias e nunca foi contatado`,
    contactId: contact.id,
    contactName: contact.name,
    daysStale: daysSinceCreation,
  };
}

// Rule 6: Alto valor em risco — valor >= 10000 + qualquer risco CRITICAL
function checkHighValueAtRisk(contact: ContactForAnalysis, existingAlerts: RiskAlert[]): RiskAlert | null {
  if (!contact.valor_estimado || contact.valor_estimado < 10000) return null;

  const hasCritical = existingAlerts.some(
    (a) => a.contactId === contact.id && a.level === 'CRITICAL'
  );
  if (!hasCritical) return null;

  return {
    rule: 'HIGH_VALUE_AT_RISK',
    level: 'CRITICAL',
    title: 'Alto valor em risco',
    description: `${contact.name} tem valor de R$ ${contact.valor_estimado.toLocaleString('pt-BR')} e está em risco crítico`,
    contactId: contact.id,
    contactName: contact.name,
    value: contact.valor_estimado,
  };
}

// Rule 7: Esfriando — temperatura QUENTE + ultima interacao SEM_RESPOSTA ha >3 dias
function checkCoolingDown(contact: ContactForAnalysis, now: Date): RiskAlert | null {
  if (contact.temperatura !== 'QUENTE') return null;
  if (!isActive(contact.status)) return null;
  if (contact.interactions.length === 0) return null;

  const lastInteraction = contact.interactions[0]; // assume sorted desc
  if (lastInteraction.outcome !== 'SEM_RESPOSTA') return null;

  const daysSinceLastInteraction = daysBetween(lastInteraction.happened_at, now);
  if (daysSinceLastInteraction <= 3) return null;

  return {
    rule: 'COOLING_DOWN',
    level: 'HIGH',
    title: 'Contato esfriando',
    description: `${contact.name} é QUENTE mas última interação foi SEM_RESPOSTA há ${daysSinceLastInteraction} dias`,
    contactId: contact.id,
    contactName: contact.name,
    daysStale: daysSinceLastInteraction,
  };
}

// Run all 7 rules on a list of contacts
export function analyzeContacts(contacts: ContactForAnalysis[]): RiskAlert[] {
  const now = new Date();
  const alerts: RiskAlert[] = [];

  for (const contact of contacts) {
    // Rules 1-5, 7
    const staleDeal = checkStaleDeal(contact, now);
    if (staleDeal) alerts.push(staleDeal);

    const noNextAction = checkNoNextAction(contact);
    if (noNextAction) alerts.push(noNextAction);

    const taskOverdue = checkTaskOverdue(contact, now);
    if (taskOverdue) alerts.push(taskOverdue);

    const noOwner = checkNoOwner(contact);
    if (noOwner) alerts.push(noOwner);

    const neverContacted = checkNeverContacted(contact, now);
    if (neverContacted) alerts.push(neverContacted);

    const coolingDown = checkCoolingDown(contact, now);
    if (coolingDown) alerts.push(coolingDown);
  }

  // Rule 6: High value at risk (depends on existing alerts)
  for (const contact of contacts) {
    const highValue = checkHighValueAtRisk(contact, alerts);
    if (highValue) alerts.push(highValue);
  }

  // Sort by severity: CRITICAL > HIGH > MEDIUM > LOW
  const levelOrder: Record<RiskLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  return alerts;
}

// Get alerts for a single contact
export function analyzeContact(contact: ContactForAnalysis): RiskAlert[] {
  return analyzeContacts([contact]);
}

export { STAGE_SLA, ACTIVE_STATUSES };
