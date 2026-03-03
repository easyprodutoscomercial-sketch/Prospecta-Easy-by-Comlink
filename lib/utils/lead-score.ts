/**
 * Lead Scoring Algorithm
 * Score 0-100 based on contact attributes
 */

interface ScoreableContact {
  temperatura?: string | null;
  valor_estimado?: number | null;
  status?: string;
  updated_at?: string;
  created_at?: string;
  proxima_acao_data?: string | null;
  proxima_acao_tipo?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  company?: string | null;
  assigned_to_user_id?: string | null;
}

export function computeLeadScore(contact: ScoreableContact): number {
  let score = 0;

  // Temperatura (0-25 pts)
  if (contact.temperatura === 'QUENTE') score += 25;
  else if (contact.temperatura === 'MORNO') score += 15;
  else if (contact.temperatura === 'FRIO') score += 5;

  // Valor estimado (0-20 pts)
  const val = contact.valor_estimado || 0;
  if (val >= 50000) score += 20;
  else if (val >= 10000) score += 15;
  else if (val >= 1000) score += 10;
  else if (val > 0) score += 5;

  // Progresso no pipeline (0-20 pts)
  const statusScore: Record<string, number> = {
    NOVO: 4,
    EM_PROSPECCAO: 8,
    CONTATADO: 12,
    REUNIAO_MARCADA: 18,
    CONVERTIDO: 20,
    PERDIDO: 0,
  };
  score += statusScore[contact.status || ''] || 0;

  // Recencia - quao recente foi a ultima atualizacao (0-15 pts)
  if (contact.updated_at) {
    const daysSinceUpdate = Math.floor((Date.now() - new Date(contact.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceUpdate <= 1) score += 15;
    else if (daysSinceUpdate <= 3) score += 12;
    else if (daysSinceUpdate <= 7) score += 8;
    else if (daysSinceUpdate <= 14) score += 4;
    // > 14 days = 0
  }

  // Dados de contato completos (0-10 pts)
  if (contact.phone || contact.whatsapp) score += 3;
  if (contact.email) score += 3;
  if (contact.company) score += 2;
  if (contact.assigned_to_user_id) score += 2;

  // Proxima acao agendada (0-10 pts)
  if (contact.proxima_acao_data) {
    const actionDate = new Date(contact.proxima_acao_data);
    const now = new Date();
    if (actionDate >= now) score += 10; // acao futura
    else score += 3; // acao atrasada (tem algo mas ta vencido)
  }

  return Math.min(100, Math.max(0, score));
}

// Enhanced scoring with detailed breakdown
export interface ScoreBreakdown {
  temperatura: number;       // 0-20
  valor_estimado: number;    // 0-15
  pipeline_progress: number; // 0-15
  recency: number;           // 0-10
  completeness: number;      // 0-10
  next_action: number;       // 0-10
  engagement: number;        // 0-15
  profile_quality: number;   // 0-5
}

export interface DetailedScore {
  total: number;
  breakdown: ScoreBreakdown;
}

interface DetailedScoreableContact extends ScoreableContact {
  segmento?: string | null;
  cidade?: string | null;
  cargo?: string | null;
  interactions?: {
    outcome?: string;
    happened_at?: string;
  }[];
}

export function computeLeadScoreDetailed(contact: DetailedScoreableContact): DetailedScore {
  const breakdown: ScoreBreakdown = {
    temperatura: 0,
    valor_estimado: 0,
    pipeline_progress: 0,
    recency: 0,
    completeness: 0,
    next_action: 0,
    engagement: 0,
    profile_quality: 0,
  };

  // Temperatura (0-20)
  if (contact.temperatura === 'QUENTE') breakdown.temperatura = 20;
  else if (contact.temperatura === 'MORNO') breakdown.temperatura = 12;
  else if (contact.temperatura === 'FRIO') breakdown.temperatura = 4;

  // Valor estimado (0-15)
  const val = contact.valor_estimado || 0;
  if (val >= 50000) breakdown.valor_estimado = 15;
  else if (val >= 10000) breakdown.valor_estimado = 12;
  else if (val >= 1000) breakdown.valor_estimado = 8;
  else if (val > 0) breakdown.valor_estimado = 4;

  // Pipeline progress (0-15)
  const statusScore: Record<string, number> = {
    NOVO: 3,
    EM_PROSPECCAO: 6,
    CONTATADO: 9,
    REUNIAO_MARCADA: 13,
    CONVERTIDO: 15,
    PERDIDO: 0,
  };
  breakdown.pipeline_progress = statusScore[contact.status || ''] || 0;

  // Recency (0-10)
  if (contact.updated_at) {
    const days = Math.floor((Date.now() - new Date(contact.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 1) breakdown.recency = 10;
    else if (days <= 3) breakdown.recency = 8;
    else if (days <= 7) breakdown.recency = 5;
    else if (days <= 14) breakdown.recency = 2;
  }

  // Completeness (0-10)
  if (contact.phone || contact.whatsapp) breakdown.completeness += 3;
  if (contact.email) breakdown.completeness += 3;
  if (contact.company) breakdown.completeness += 2;
  if (contact.assigned_to_user_id) breakdown.completeness += 2;

  // Next action (0-10)
  if (contact.proxima_acao_data) {
    const actionDate = new Date(contact.proxima_acao_data);
    if (actionDate >= new Date()) breakdown.next_action = 10;
    else breakdown.next_action = 3;
  }

  // Engagement (0-15) — interactions in last 30 days, positive outcomes
  const interactions = contact.interactions || [];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentInteractions = interactions.filter(
    (i) => i.happened_at && new Date(i.happened_at).getTime() > thirtyDaysAgo
  );
  const positiveOutcomes = ['RESPONDEU', 'REUNIAO_MARCADA', 'CONVERTIDO', 'PROPOSTA_ACEITA', 'EM_NEGOCIACAO', 'FECHADO_PARCIAL'];
  const positiveCount = recentInteractions.filter((i) => positiveOutcomes.includes(i.outcome || '')).length;

  if (recentInteractions.length >= 5) breakdown.engagement += 8;
  else if (recentInteractions.length >= 3) breakdown.engagement += 5;
  else if (recentInteractions.length >= 1) breakdown.engagement += 3;
  if (positiveCount >= 3) breakdown.engagement += 7;
  else if (positiveCount >= 1) breakdown.engagement += 4;
  breakdown.engagement = Math.min(15, breakdown.engagement);

  // Profile quality (0-5)
  if (contact.segmento) breakdown.profile_quality += 2;
  if (contact.cidade) breakdown.profile_quality += 1;
  if (contact.cargo) breakdown.profile_quality += 2;

  const total = Math.min(100, Math.max(0,
    breakdown.temperatura +
    breakdown.valor_estimado +
    breakdown.pipeline_progress +
    breakdown.recency +
    breakdown.completeness +
    breakdown.next_action +
    breakdown.engagement +
    breakdown.profile_quality
  ));

  return { total, breakdown };
}

export function getScoreColor(score: number): { bg: string; text: string; label: string } {
  if (score >= 80) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Quente' };
  if (score >= 60) return { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Bom' };
  if (score >= 40) return { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Medio' };
  if (score >= 20) return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Baixo' };
  return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Frio' };
}
