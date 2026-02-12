import { MessageChannel, MessageIntent } from './types';

// Labels for message generation
const CHANNEL_LABELS: Record<MessageChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  ligacao: 'Roteiro de Ligação',
};

const INTENT_LABELS: Record<MessageIntent, string> = {
  primeiro_contato: 'Primeiro contato',
  follow_up: 'Follow-up',
  reagendar: 'Reagendar reunião',
  enviar_proposta: 'Enviar proposta',
  cobrar_retorno: 'Cobrar retorno',
  pos_reuniao: 'Pós-reunião',
  reativacao: 'Reativação de contato frio',
};

export function buildMessagePrompt(params: {
  channel: MessageChannel;
  intent: MessageIntent;
  contactName: string;
  contactCompany?: string | null;
  contactStatus: string;
  sellerName: string;
  recentInteractions: { type: string; outcome: string; note?: string | null; happened_at: string }[];
}): { system: string; user: string } {
  const { channel, intent, contactName, contactCompany, contactStatus, sellerName, recentInteractions } = params;

  const interactionHistory = recentInteractions.length > 0
    ? recentInteractions.map((i, idx) => `${idx + 1}. ${i.type} - ${i.outcome}${i.note ? ` (${i.note})` : ''} em ${new Date(i.happened_at).toLocaleDateString('pt-BR')}`).join('\n')
    : 'Nenhuma interação anterior';

  const system = `Você é um assistente de vendas B2B brasileiro. Gere mensagens profissionais, diretas e naturais em português brasileiro.
Regras:
- Seja breve e objetivo (máximo 3 parágrafos para email, 2-3 linhas para WhatsApp)
- Use linguagem profissional mas amigável
- NÃO use emojis excessivos (máximo 1-2 para WhatsApp)
- Para email, inclua um assunto na primeira linha no formato "Assunto: ..."
- Para WhatsApp, seja conciso e direto
- Para ligação, crie um roteiro curto com pontos-chave
- Adapte o tom ao contexto da interação`;

  const user = `Gere uma mensagem de ${CHANNEL_LABELS[channel]} com intenção "${INTENT_LABELS[intent]}".

Dados do contato:
- Nome: ${contactName}
- Empresa: ${contactCompany || 'Não informada'}
- Status atual: ${contactStatus}
- Vendedor: ${sellerName}

Histórico recente:
${interactionHistory}

Gere apenas a mensagem pronta para enviar/usar.`;

  return { system, user };
}

export function buildCoachingPrompt(metrics: {
  totalActive: number;
  byStage: Record<string, number>;
  avgDaysInStage: Record<string, number>;
  atRiskCount: number;
  staleCount: number;
  noOwnerCount: number;
  noNextActionCount: number;
  conversionRate: number;
  totalValue: number;
}): { system: string; user: string } {
  const { totalActive, byStage, avgDaysInStage, atRiskCount, staleCount, noOwnerCount, noNextActionCount, conversionRate, totalValue } = metrics;

  const stageBreakdown = Object.entries(byStage)
    .map(([stage, count]) => `  - ${stage}: ${count} contatos (média ${avgDaysInStage[stage] || 0} dias)`)
    .join('\n');

  const system = `Você é um coach de vendas B2B especializado em pipelines de CRM. Analise as métricas e dê dicas práticas, diretas e acionáveis em português brasileiro.
Regras:
- Retorne um JSON array com 3-5 strings
- Cada dica deve ser uma frase curta e prática (máximo 20 palavras)
- Foque em ações concretas, não teorias
- Priorize os problemas mais urgentes
- Use dados específicos quando possível
- Formato: ["dica 1", "dica 2", "dica 3"]`;

  const user = `Analise este pipeline de vendas e dê dicas de coaching:

Pipeline:
- Total ativo: ${totalActive} contatos
- Valor total: R$ ${totalValue.toLocaleString('pt-BR')}
- Taxa de conversão: ${conversionRate}%

Por etapa:
${stageBreakdown}

Problemas detectados:
- Em risco: ${atRiskCount}
- Parados (sem atualização): ${staleCount}
- Sem responsável: ${noOwnerCount}
- Sem próxima ação: ${noNextActionCount}

Retorne APENAS o JSON array com as dicas.`;

  return { system, user };
}
