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

export function getScoreColor(score: number): { bg: string; text: string; label: string } {
  if (score >= 80) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Quente' };
  if (score >= 60) return { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Bom' };
  if (score >= 40) return { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Medio' };
  if (score >= 20) return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Baixo' };
  return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Frio' };
}
