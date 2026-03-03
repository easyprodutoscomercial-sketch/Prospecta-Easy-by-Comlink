import { ContactStatus } from '@/lib/types';
import { RiskAlert, RiskLevel, ContactForAnalysis, StageSLA } from './types';

// Default SLA per stage name (fallback)
const DEFAULT_STAGE_SLA: Record<string, StageSLA> = {
  NOVO: { warnDays: 2, criticalDays: 5 },
  EM_PROSPECCAO: { warnDays: 5, criticalDays: 10 },
  CONTATADO: { warnDays: 3, criticalDays: 7 },
  REUNIAO_MARCADA: { warnDays: 5, criticalDays: 10 },
  STANDBY: { warnDays: 7, criticalDays: 14 },
};

// Legacy active statuses (kept for backwards compat)
const ACTIVE_STATUSES: ContactStatus[] = ['NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA'];

// Resolve SLA for a contact — uses stage_name or falls back to status
function getSLA(contact: ContactForAnalysis, stageSLAMap?: Record<string, StageSLA>): StageSLA | null {
  // Try stage_name first (from dynamic pipeline stages)
  if (contact.stage_name) {
    const normalized = contact.stage_name.toUpperCase().replace(/\s+/g, '_').replace(/[ÁÀÂÃ]/gi, 'A').replace(/[ÉÈÊ]/gi, 'E').replace(/[ÍÌÎ]/gi, 'I').replace(/[ÓÒÔÕ]/gi, 'O').replace(/[ÚÙÛ]/gi, 'U').replace(/Ç/gi, 'C');
    if (stageSLAMap?.[normalized]) return stageSLAMap[normalized];
    if (DEFAULT_STAGE_SLA[normalized]) return DEFAULT_STAGE_SLA[normalized];
  }
  // Fallback to old status field
  if (contact.status && DEFAULT_STAGE_SLA[contact.status]) {
    return DEFAULT_STAGE_SLA[contact.status];
  }
  // Generic fallback: 5/10 days
  return { warnDays: 5, criticalDays: 10 };
}

function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// Check if contact is "active" — uses activeStageIds if provided, otherwise falls back to status
function isContactActive(contact: ContactForAnalysis, activeStageIds?: Set<string>): boolean {
  if (activeStageIds && activeStageIds.size > 0) {
    return !!contact.stage_id && activeStageIds.has(contact.stage_id);
  }
  return ACTIVE_STATUSES.includes(contact.status as ContactStatus);
}

// Rule 1: Negocio parado — dias sem atualizar > SLA da etapa
function checkStaleDeal(contact: ContactForAnalysis, now: Date, activeStageIds?: Set<string>, stageSLAMap?: Record<string, StageSLA>): RiskAlert | null {
  if (!isContactActive(contact, activeStageIds)) return null;

  const sla = getSLA(contact, stageSLAMap);
  if (!sla) return null;

  const stageName = contact.stage_name || contact.status?.replace(/_/g, ' ') || 'desconhecida';
  const daysStale = daysBetween(contact.updated_at, now);

  if (daysStale >= sla.criticalDays) {
    return {
      rule: 'STALE_DEAL',
      level: 'CRITICAL',
      title: 'Negócio parado',
      description: `${contact.name} está há ${daysStale} dias sem atualização na etapa ${stageName}`,
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
function checkNoNextAction(contact: ContactForAnalysis, activeStageIds?: Set<string>): RiskAlert | null {
  if (!isContactActive(contact, activeStageIds)) return null;
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
function checkNoOwner(contact: ContactForAnalysis, activeStageIds?: Set<string>): RiskAlert | null {
  if (!isContactActive(contact, activeStageIds)) return null;
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
function checkNeverContacted(contact: ContactForAnalysis, now: Date, activeStageIds?: Set<string>): RiskAlert | null {
  if (!isContactActive(contact, activeStageIds)) return null;
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
function checkCoolingDown(contact: ContactForAnalysis, now: Date, activeStageIds?: Set<string>): RiskAlert | null {
  if (contact.temperatura !== 'QUENTE') return null;
  if (!isContactActive(contact, activeStageIds)) return null;
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

// Options for analysis
interface AnalyzeOptions {
  activeStageIds?: Set<string>;
  stageSLAMap?: Record<string, StageSLA>;
}

// Run all 7 rules on a list of contacts
export function analyzeContacts(contacts: ContactForAnalysis[], options?: AnalyzeOptions): RiskAlert[] {
  const now = new Date();
  const alerts: RiskAlert[] = [];
  const activeStageIds = options?.activeStageIds;
  const stageSLAMap = options?.stageSLAMap;

  for (const contact of contacts) {
    // Rules 1-5, 7
    const staleDeal = checkStaleDeal(contact, now, activeStageIds, stageSLAMap);
    if (staleDeal) alerts.push(staleDeal);

    const noNextAction = checkNoNextAction(contact, activeStageIds);
    if (noNextAction) alerts.push(noNextAction);

    const taskOverdue = checkTaskOverdue(contact, now);
    if (taskOverdue) alerts.push(taskOverdue);

    const noOwner = checkNoOwner(contact, activeStageIds);
    if (noOwner) alerts.push(noOwner);

    const neverContacted = checkNeverContacted(contact, now, activeStageIds);
    if (neverContacted) alerts.push(neverContacted);

    const coolingDown = checkCoolingDown(contact, now, activeStageIds);
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
export function analyzeContact(contact: ContactForAnalysis, options?: AnalyzeOptions): RiskAlert[] {
  return analyzeContacts([contact], options);
}

export { DEFAULT_STAGE_SLA as STAGE_SLA, ACTIVE_STATUSES };
