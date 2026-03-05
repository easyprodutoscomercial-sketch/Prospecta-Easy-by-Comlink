import { createClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { chatCompletionJSON } from '@/lib/ai/openai';
import { NextRequest, NextResponse } from 'next/server';

export interface PcAiAnalysisResult {
  resumo: string;
  insights: string[];
  alertas: string[];
  recomendacoes: string[];
  score: number;
}

// POST /api/pedidos-cotacoes/ai-analysis
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const body = await request.json();
    const { stats } = body;

    if (!stats) {
      return NextResponse.json({ error: 'Stats obrigatorios' }, { status: 400 });
    }

    const prompt = `Voce e um analista de compras e supply chain. Analise os dados abaixo de um sistema de gestao de pedidos e cotacoes e forneca insights acionaveis em portugues brasileiro.

DADOS:
- Total de clientes/fornecedores: ${stats.total_clients}
- Total de cotacoes: ${stats.total_cotacoes}
- Total de pedidos: ${stats.total_pedidos}
- Cotacoes respondidas: ${stats.cotacoes_responderam} (${stats.taxa_resposta_pct}%)
- Cotacoes sem resposta: ${stats.cotacoes_nao_responderam}
- Pedidos ativos: ${stats.pedidos_ativos}
- Pedidos finalizados: ${stats.pedidos_finalizados}
- Distribuicao de clientes por status: ${JSON.stringify(stats.clients_by_status)}
- Distribuicao de pedidos por situacao: ${JSON.stringify(stats.pedidos_by_situacao)}
- Top fornecedores: ${JSON.stringify(stats.top_fornecedores)}

Responda SOMENTE com um JSON valido (sem markdown, sem code blocks) no formato:
{
  "resumo": "Resumo executivo em 2-3 frases",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "alertas": ["alerta 1 se houver problemas"],
  "recomendacoes": ["recomendacao 1", "recomendacao 2"],
  "score": 75
}

Regras:
- score de 0-100 representando saude geral do processo de compras
- 3 a 5 insights relevantes
- alertas apenas se houver problemas reais (pode ser array vazio)
- 2 a 4 recomendacoes praticas
- Se houver poucos dados, mencione isso e sugira acoes para melhorar`;

    const result = await chatCompletionJSON<PcAiAnalysisResult>({
      messages: [
        { role: 'system', content: 'Voce e um analista de compras especializado. Responda sempre em JSON valido.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 1500,
      temperature: 0.5,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in PC AI analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Erro na analise IA' },
      { status: 500 }
    );
  }
}
