import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { chatCompletionWithTools } from '@/lib/ai/openai';
import { webSearch } from '@/lib/ai/web-search';
import { STATUS_LABELS, SEGMENTO_LABELS, TEMPERATURA_LABELS, ORIGEM_LABELS, INTERACTION_TYPE_LABELS, INTERACTION_OUTCOME_LABELS } from '@/lib/utils/labels';

// Tool definitions for OpenAI function calling
const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'notify_responsaveis',
      description:
        'Envia notificacoes para os responsaveis dos contatos selecionados, perguntando o que precisam para dar o proximo passo. Use quando o usuario pedir para notificar, cobrar ou lembrar responsaveis.',
      parameters: {
        type: 'object',
        properties: {
          notifications: {
            type: 'array',
            description: 'Lista de notificacoes a enviar',
            items: {
              type: 'object',
              properties: {
                contact_id: {
                  type: 'string',
                  description: 'ID do contato (UUID)',
                },
                contact_name: {
                  type: 'string',
                  description: 'Nome do contato para referencia',
                },
                responsible_user_id: {
                  type: 'string',
                  description: 'ID do usuario responsavel (UUID). Null se nao atribuido.',
                },
                message: {
                  type: 'string',
                  description: 'Mensagem personalizada para o responsavel',
                },
              },
              required: ['contact_id', 'contact_name', 'message'],
            },
          },
        },
        required: ['notifications'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'pesquisar_internet',
      description:
        'Pesquisa na internet por informacoes relevantes para ajudar o vendedor. Use quando o usuario pedir dicas, estrategias, informacoes sobre empresas, setores, tecnicas de venda, ou qualquer dado externo util.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Termo de busca em portugues',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'consultar_contato',
      description:
        'Busca todos os detalhes de um contato especifico incluindo telefone, email, endereco, CNPJ/CPF, notas e historico completo de interacoes. Use quando o usuario perguntar sobre um contato especifico, pedir detalhes, historico, ou informacoes completas de alguem.',
      parameters: {
        type: 'object',
        properties: {
          contact_name: {
            type: 'string',
            description: 'Nome (ou parte do nome) do contato para buscar',
          },
        },
        required: ['contact_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'pesquisar_empresa',
      description:
        'Pesquisa informacoes sobre uma empresa na internet (LinkedIn, noticias, dados CNPJ). Use quando o usuario quiser saber mais sobre a empresa de um contato, antes de uma reuniao, ou para preparar uma abordagem comercial.',
      parameters: {
        type: 'object',
        properties: {
          company_name: {
            type: 'string',
            description: 'Nome da empresa para pesquisar',
          },
          cnpj: {
            type: 'string',
            description: 'CNPJ da empresa (opcional)',
          },
          city: {
            type: 'string',
            description: 'Cidade da empresa (opcional, melhora resultados)',
          },
          focus: {
            type: 'string',
            enum: ['geral', 'linkedin', 'noticias', 'cnpj'],
            description: 'Foco da pesquisa: geral (padrao), linkedin (perfil corporativo), noticias (noticias recentes), cnpj (dados cadastrais)',
          },
        },
        required: ['company_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'gerar_grafico',
      description:
        'Gera um grafico visual inline no chat. Use quando o usuario pedir graficos, charts, distribuicao visual, funil, fluxograma, diagrama de decisao, ou visualizacao de dados. Voce ja tem os dados no contexto do pipeline — estruture-os em JSON para gerar o grafico.',
      parameters: {
        type: 'object',
        properties: {
          chart_type: {
            type: 'string',
            enum: ['pie', 'bar', 'funnel', 'flowchart'],
            description: 'Tipo de grafico: pie (pizza/donut), bar (barras horizontais), funnel (funil de vendas), flowchart (fluxograma/diagrama de decisao)',
          },
          title: {
            type: 'string',
            description: 'Titulo do grafico',
          },
          data: {
            type: 'array',
            description: 'Dados do grafico (para pie, bar, funnel). Cada item tem name (label), value (numero) e color (hex opcional). NAO use para flowchart.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Label do item' },
                value: { type: 'number', description: 'Valor numerico' },
                color: { type: 'string', description: 'Cor hex opcional (ex: #22c55e)' },
              },
              required: ['name', 'value'],
            },
          },
          nodes: {
            type: 'array',
            description: 'Nos do fluxograma (somente para chart_type=flowchart). Cada no tem id, label e type.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID unico do no (ex: n1, n2)' },
                label: { type: 'string', description: 'Texto exibido no no' },
                type: { type: 'string', enum: ['start', 'decision', 'action', 'end'], description: 'Tipo: start (inicio), decision (decisao/losango), action (acao/retangulo), end (fim)' },
              },
              required: ['id', 'label', 'type'],
            },
          },
          edges: {
            type: 'array',
            description: 'Conexoes entre nos do fluxograma (somente para chart_type=flowchart). Cada edge tem from, to e label opcional.',
            items: {
              type: 'object',
              properties: {
                from: { type: 'string', description: 'ID do no de origem' },
                to: { type: 'string', description: 'ID do no de destino' },
                label: { type: 'string', description: 'Texto da conexao (ex: Sim, Nao)' },
              },
              required: ['from', 'to'],
            },
          },
        },
        required: ['chart_type', 'title'],
      },
    },
  },
];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const { message, history } = await request.json();

    const admin = getAdminClient();
    const orgId = profile.organization_id;
    const userId = user.id;
    const userName = profile.name;
    const isAdmin = profile.role === 'admin';

    // Fetch all org profiles (for name mapping)
    const { data: profiles } = await admin
      .from('profiles')
      .select('user_id, name, email')
      .eq('organization_id', orgId);

    const profileMap = new Map<string, string>();
    for (const p of profiles || []) {
      profileMap.set(p.user_id, p.name);
    }

    // Fetch pipelines and stages for the organization
    const { data: pipelines, error: pipelinesError } = await admin
      .from('pipelines')
      .select('id, name')
      .eq('organization_id', orgId);

    if (pipelinesError) {
      console.error('Chat: pipelines query error:', pipelinesError.message);
    }

    const pipelineIds = (pipelines || []).map(p => p.id);
    console.log(`Chat debug: orgId=${orgId}, userId=${userId}, isAdmin=${isAdmin}, pipelines=${pipelineIds.length}`);

    // For non-admin: filter by pipeline membership
    let allowedPipelineIds: string[] = pipelineIds;
    if (!isAdmin && pipelineIds.length > 0) {
      const { data: memberships } = await admin
        .from('pipeline_members')
        .select('pipeline_id')
        .eq('user_id', userId)
        .in('pipeline_id', pipelineIds);
      const memberPipelineIds = (memberships || []).map(m => m.pipeline_id);
      // If user has no pipeline memberships, fallback to all org pipelines
      // (they can still see contacts, just like the contacts page)
      allowedPipelineIds = memberPipelineIds.length > 0 ? memberPipelineIds : pipelineIds;
      console.log(`Chat debug: memberships=${memberPipelineIds.length}, allowedPipelines=${allowedPipelineIds.length}`);
    }

    // Fetch stages for allowed pipelines
    const { data: allStages, error: stagesError } = await admin
      .from('pipeline_stages')
      .select('id, pipeline_id, name, slug, color, position, is_terminal, terminal_type')
      .in('pipeline_id', allowedPipelineIds.length > 0 ? allowedPipelineIds : ['__none__'])
      .order('position', { ascending: true });

    if (stagesError) {
      console.error('Chat: stages query error:', stagesError.message);
    }

    const stages = allStages || [];
    const stageMap = new Map<string, typeof stages[0]>();
    const activeStageIds = new Set<string>();
    const wonStageIds = new Set<string>();
    const lostStageIds = new Set<string>();

    for (const s of stages) {
      stageMap.set(s.id, s);
      if (s.is_terminal) {
        if (s.terminal_type === 'won') wonStageIds.add(s.id);
        else if (s.terminal_type === 'lost') lostStageIds.add(s.id);
      } else {
        activeStageIds.add(s.id);
      }
    }

    // Fetch contacts — use select('*') to avoid column mismatch issues
    let contactQuery = admin
      .from('contacts')
      .select('*')
      .eq('organization_id', orgId);

    if (allowedPipelineIds.length > 0) {
      contactQuery = contactQuery.in('pipeline_id', allowedPipelineIds);
    }

    const { data: contacts, error: contactsError } = await contactQuery;
    if (contactsError) {
      console.error('Chat: contacts query error:', contactsError.message, contactsError);
    }
    const allOrgContacts = contacts || [];
    console.log(`Chat: orgId=${orgId}, pipelines=${allowedPipelineIds.length}, stages=${stages.length}, contacts=${allOrgContacts.length}`);

    // Separate active vs terminal contacts
    const allContacts = allOrgContacts.filter(c =>
      !c.stage_id || activeStageIds.has(c.stage_id)
    );
    const convertidos = allOrgContacts.filter(c => c.stage_id && wonStageIds.has(c.stage_id)).length;
    const perdidos = allOrgContacts.filter(c => c.stage_id && lostStageIds.has(c.stage_id)).length;

    const taxaConversao = (convertidos + perdidos) > 0
      ? ((convertidos / (convertidos + perdidos)) * 100).toFixed(1)
      : '0';

    // Interaction counts per contact (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const contactIds = allContacts.map(c => c.id);

    const interactionCountMap = new Map<string, number>();
    if (contactIds.length > 0) {
      const { data: interactionRows } = await admin
        .from('interactions')
        .select('contact_id')
        .in('contact_id', contactIds)
        .gte('created_at', thirtyDaysAgo);

      for (const row of interactionRows || []) {
        interactionCountMap.set(row.contact_id, (interactionCountMap.get(row.contact_id) || 0) + 1);
      }
    }

    // Team performance stats (for admin: all users, for non-admin: just this user)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    let performanceSection = '';

    if (isAdmin) {
      const { data: monthInteractions } = await admin
        .from('interactions')
        .select('created_by_user_id, type')
        .eq('organization_id', orgId)
        .gte('created_at', monthStart);

      // Count conversions this month (contacts moved to won stages)
      let monthConversions: { assigned_to_user_id: string | null }[] = [];
      if (wonStageIds.size > 0) {
        const { data: mc } = await admin
          .from('contacts')
          .select('assigned_to_user_id')
          .eq('organization_id', orgId)
          .in('stage_id', Array.from(wonStageIds))
          .gte('updated_at', monthStart);
        monthConversions = mc || [];
      }

      const teamStats = new Map<string, { interactions: number; reunioes: number; conversoes: number }>();
      for (const p of profiles || []) {
        teamStats.set(p.user_id, { interactions: 0, reunioes: 0, conversoes: 0 });
      }

      for (const i of monthInteractions || []) {
        const uid = i.created_by_user_id;
        if (!uid) continue;
        const stats = teamStats.get(uid) || { interactions: 0, reunioes: 0, conversoes: 0 };
        stats.interactions++;
        if (i.type === 'REUNIAO') stats.reunioes++;
        teamStats.set(uid, stats);
      }

      for (const c of monthConversions) {
        const uid = c.assigned_to_user_id;
        if (!uid) continue;
        const stats = teamStats.get(uid) || { interactions: 0, reunioes: 0, conversoes: 0 };
        stats.conversoes++;
        teamStats.set(uid, stats);
      }

      const teamLines: string[] = [];
      for (const [uid, stats] of teamStats) {
        const name = profileMap.get(uid) || 'Desconhecido';
        if (stats.interactions > 0 || stats.conversoes > 0) {
          teamLines.push(`  - ${name}: ${stats.interactions} interacoes, ${stats.reunioes} reunioes, ${stats.conversoes} conversoes`);
        }
      }

      if (teamLines.length > 0) {
        performanceSection = `\n\nDESEMPENHO DA EQUIPE (mes atual):\n${teamLines.join('\n')}`;
      }
    } else {
      const { data: myMonthInteractions } = await admin
        .from('interactions')
        .select('type')
        .eq('organization_id', orgId)
        .eq('created_by_user_id', userId)
        .gte('created_at', monthStart);

      let myConversions = 0;
      if (wonStageIds.size > 0) {
        const { count } = await admin
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('assigned_to_user_id', userId)
          .in('stage_id', Array.from(wonStageIds))
          .gte('updated_at', monthStart);
        myConversions = count || 0;
      }

      const myInteractions = myMonthInteractions || [];
      const reunioes = myInteractions.filter(i => i.type === 'REUNIAO').length;

      performanceSection = `\n\nSEU DESEMPENHO (mes atual):\n  - ${myInteractions.length} interacoes, ${reunioes} reunioes, ${myConversions} conversoes`;
    }

    // Separate assigned vs unassigned
    const myContacts = allContacts.filter(c => c.assigned_to_user_id === userId);
    const unassignedContacts = allContacts.filter(c => !c.assigned_to_user_id);
    const othersContacts = allContacts.filter(c => c.assigned_to_user_id && c.assigned_to_user_id !== userId);

    // Count by stage (using stage_id for dynamic stages)
    const byStageId: Record<string, number> = {};
    for (const c of allContacts) {
      const key = c.stage_id || 'sem_etapa';
      byStageId[key] = (byStageId[key] || 0) + 1;
    }

    // My contacts by stage
    const myByStageId: Record<string, number> = {};
    for (const c of myContacts) {
      const key = c.stage_id || 'sem_etapa';
      myByStageId[key] = (myByStageId[key] || 0) + 1;
    }

    const totalValue = myContacts.reduce((sum, c) => sum + (c.valor_estimado || 0), 0);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Stale contacts (5+ days without update)
    const staleContacts = allContacts
      .map(c => ({
        ...c,
        daysSinceUpdate: Math.floor((now.getTime() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
        ownerName: c.assigned_to_user_id ? (profileMap.get(c.assigned_to_user_id) || 'Desconhecido') : null,
      }))
      .filter(c => c.daysSinceUpdate >= 5)
      .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);

    // Overdue/today actions
    const pendingActions = allContacts
      .filter(c => c.proxima_acao_data && c.proxima_acao_data.split('T')[0] <= todayStr)
      .map(c => ({
        ...c,
        ownerName: c.assigned_to_user_id ? (profileMap.get(c.assigned_to_user_id) || 'Desconhecido') : null,
      }))
      .sort((a, b) => (a.proxima_acao_data > b.proxima_acao_data ? 1 : -1));

    // Build contact list for context (with IDs for tool calling)
    const formatContact = (c: any) => {
      const owner = c.assigned_to_user_id ? (profileMap.get(c.assigned_to_user_id) || '?') : 'SEM RESPONSAVEL';
      const days = Math.floor((now.getTime() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      const intCount = interactionCountMap.get(c.id) || 0;
      let line = `  - [ID:${c.id}] ${c.name}`;
      if (c.company) line += ` (${c.company})`;
      const stageName = c.stage_id && stageMap.get(c.stage_id) ? stageMap.get(c.stage_id)!.name : (STATUS_LABELS[c.status] || c.status);
      line += ` | ${stageName}`;
      if (c.segmento) line += ` | ${SEGMENTO_LABELS[c.segmento] || c.segmento}`;
      if (c.temperatura) line += ` | ${TEMPERATURA_LABELS[c.temperatura] || c.temperatura}`;
      line += ` | Responsavel: ${owner}`;
      if (c.valor_estimado) line += ` | R$${c.valor_estimado.toLocaleString('pt-BR')}`;
      if (intCount > 0) line += ` | ${intCount} interacoes (30d)`;
      if (days >= 5) line += ` | Parado ha ${days} dias`;
      if (c.proxima_acao_tipo) {
        const actionDate = c.proxima_acao_data?.split('T')[0] || '';
        const overdue = actionDate && actionDate < todayStr;
        line += ` | Acao: ${c.proxima_acao_tipo}${overdue ? ' (ATRASADA desde ' + actionDate + ')' : actionDate ? ' em ' + actionDate : ''}`;
      }
      return line;
    };

    // Build stage summaries using dynamic stages
    const activeStages = stages.filter(s => !s.is_terminal);
    const wonStages = stages.filter(s => s.terminal_type === 'won');
    const lostStages = stages.filter(s => s.terminal_type === 'lost');

    const myStagesSummary = activeStages
      .map(s => `- ${s.name}: ${myByStageId[s.id] || 0}`)
      .join('\n');

    const fullFunnelLines = [
      ...activeStages.map(s => `- ${s.name}: ${byStageId[s.id] || 0}`),
      ...wonStages.map(s => `- ${s.name} (ganho): ${convertidos}`),
      ...lostStages.map(s => `- ${s.name} (perdido): ${perdidos}`),
    ];
    const fullFunnel = fullFunnelLines.join('\n');

    let contactListSection = '';

    if (staleContacts.length > 0) {
      contactListSection += '\n\nCONTATOS QUE PRECISAM DE ATENCAO (parados 5+ dias):\n';
      contactListSection += staleContacts.slice(0, 15).map(formatContact).join('\n');
    }

    if (pendingActions.length > 0) {
      contactListSection += '\n\nACOES PENDENTES/ATRASADAS:\n';
      contactListSection += pendingActions.slice(0, 10).map(formatContact).join('\n');
    }

    if (unassignedContacts.length > 0) {
      contactListSection += `\n\nCONTATOS SEM RESPONSAVEL (${unassignedContacts.length}):\n`;
      contactListSection += unassignedContacts.slice(0, 10).map(formatContact).join('\n');
      if (unassignedContacts.length > 10) {
        contactListSection += `\n  ... e mais ${unassignedContacts.length - 10} sem responsavel`;
      }
    }

    if (isAdmin && othersContacts.length > 0) {
      contactListSection += `\n\nCONTATOS DE OUTROS VENDEDORES (${othersContacts.length}):\n`;
      const othersByOwner = new Map<string, typeof othersContacts>();
      for (const c of othersContacts) {
        const ownerName = profileMap.get(c.assigned_to_user_id!) || 'Desconhecido';
        const list = othersByOwner.get(ownerName) || [];
        list.push(c);
        othersByOwner.set(ownerName, list);
      }
      for (const [ownerName, ownerContacts] of othersByOwner) {
        const stale = ownerContacts.filter(c => {
          const days = Math.floor((now.getTime() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24));
          return days >= 5;
        });
        contactListSection += `  ${ownerName}: ${ownerContacts.length} contatos (${stale.length} parados)\n`;
        for (const c of stale.slice(0, 5)) {
          contactListSection += formatContact(c) + '\n';
        }
      }
    }

    // Segment distribution
    const bySegmento: Record<string, number> = {};
    for (const c of allContacts) {
      if (c.segmento) {
        bySegmento[c.segmento] = (bySegmento[c.segmento] || 0) + 1;
      }
    }
    const segmentoSummary = Object.entries(bySegmento)
      .map(([s, count]) => `- ${SEGMENTO_LABELS[s] || s}: ${count}`)
      .join('\n');

    const totalOrgContacts = allContacts.length;
    const totalOrgValue = allContacts.reduce((sum, c) => sum + (c.valor_estimado || 0), 0);

    const systemPrompt = `Voce e o assistente de vendas inteligente de ${userName}${isAdmin ? ' (ADMIN — ve todos os contatos da equipe)' : ''}.
Voce tem acesso COMPLETO aos dados reais do pipeline e da organizacao. Sua funcao principal e ANALISAR esses dados e fornecer insights acionaveis.

=== DADOS DO PIPELINE ===

PIPELINE PESSOAL DE ${userName.toUpperCase()}:
- Contatos ativos atribuidos a mim: ${myContacts.length}
${myStagesSummary}
- Valor total estimado (meus): R$ ${totalValue.toLocaleString('pt-BR')}

PIPELINE DA ORGANIZACAO (TODOS OS VENDEDORES):
- Total de contatos ativos: ${totalOrgContacts}
${fullFunnel}
- Convertidos: ${convertidos} | Perdidos: ${perdidos}
- Taxa de conversao: ${taxaConversao}% (${convertidos} convertidos de ${convertidos + perdidos} finalizados)
- Valor total estimado (org): R$ ${totalOrgValue.toLocaleString('pt-BR')}
- Contatos sem responsavel: ${unassignedContacts.length}${isAdmin ? `\n- Contatos de outros vendedores: ${othersContacts.length}` : ''}
${segmentoSummary ? `\nDISTRIBUICAO POR SEGMENTO:\n${segmentoSummary}` : ''}
${performanceSection}
${contactListSection}

=== COMO ANALISAR ===

Quando o usuario pedir analise do pipeline, voce DEVE:
1. Apresentar os NUMEROS REAIS de cada etapa do funil (quantos contatos em cada fase)
2. Calcular percentuais e identificar gargalos (ex: "60% dos contatos estao parados em Prospecção")
3. Comparar desempenho entre vendedores (se admin)
4. Identificar contatos parados ha mais tempo e sugerir acoes especificas
5. Analisar tendencias: taxa de conversao, valor medio, distribuicao por segmento
6. Se o pipeline pessoal estiver vazio, AINDA ASSIM analise os dados da organizacao e sugira acoes

IMPORTANTE: Mesmo que o pipeline pessoal do usuario esteja vazio (0 contatos atribuidos), a organizacao pode ter contatos. Analise SEMPRE os dados da organizacao e forneca insights uteis. Nunca responda apenas "seu pipeline esta zerado" sem analisar os demais dados.

=== FERRAMENTAS DISPONIVEIS ===

1. notify_responsaveis — Envia notificacao no sistema para os responsaveis dos contatos. Use quando o usuario pedir para notificar, cobrar, ou lembrar as pessoas. Para contatos SEM RESPONSAVEL, mencione que precisam ser atribuidos primeiro.
2. pesquisar_internet — Pesquisa generica na internet. Use quando o usuario pedir ajuda sobre como abordar um cliente, informacoes de mercado, tecnicas de venda, ou qualquer informacao externa.
3. consultar_contato — Busca TODOS os detalhes de um contato (telefone, email, endereco, CNPJ, notas, historico de interacoes). Use quando o usuario perguntar "me fale sobre X", "qual o historico de Y", "detalhes do contato Z".
4. pesquisar_empresa — Pesquisa informacoes sobre uma empresa na internet (LinkedIn, noticias, CNPJ). Use quando o usuario quiser saber sobre a empresa de um contato, preparar reuniao, ou entender o mercado do cliente.
5. gerar_grafico — Gera graficos visuais inline no chat (pizza, barras, funil, fluxograma). Use quando o usuario pedir grafico, chart, distribuicao visual, visualizacao de dados, fluxograma, ou diagrama de decisao. Para flowchart: use nodes (com type start/decision/action/end) e edges (com labels como Sim/Nao). IMPORTANTE: ao gerar grafico, inclua o resultado CHART_DATA exatamente como retornado, sem modificar.

CORES DAS ETAPAS PARA GRAFICOS:
${stages.map(s => `${s.name}=${s.color}`).join(', ')}

=== REGRAS ===

- Responda em portugues brasileiro, direto e pratico
- Use os dados reais do pipeline — NUNCA invente contatos ou dados
- Quando pedirem analise, seja detalhado: mostre numeros, percentuais, comparacoes e insights
- Sugira acoes concretas com nomes reais (ligar para X, enviar proposta para Y)
- Para perguntas rapidas, seja breve. Para analises, seja completo (sem limite de paragrafos)
- Quando notificar, pergunte ao responsavel o que ele precisa para dar o proximo passo com aquele contato
- Quando o usuario responder o que precisa, use pesquisar_internet para buscar informacoes uteis
- Ao listar contatos, use o nome real, nunca o ID
- Se perguntarem de contatos sem responsavel, sugira atribuicao
- Quando o resultado da ferramenta gerar_grafico conter CHART_DATA, inclua-o INTEIRO na sua resposta para o usuario ver o grafico`;

    // Build messages array
    const msgs: any[] = [{ role: 'system', content: systemPrompt }];

    if (history && Array.isArray(history)) {
      for (const h of history) {
        if (h.role === 'user' || h.role === 'assistant') {
          msgs.push({ role: h.role, content: h.content });
        }
      }
    }

    if (message) {
      msgs.push({ role: 'user', content: message });
    } else {
      msgs.push({
        role: 'user',
        content: 'Ola! Me de um resumo rapido do meu pipeline, destaque os contatos parados e sem responsavel, e o que devo priorizar hoje.',
      });
    }

    // Track actions performed
    let notificationsSent = 0;
    let searchesPerformed = 0;
    let chartsGenerated = 0;

    // Execute tool call handler
    const executeToolCall = async (name: string, args: any): Promise<string> => {
      if (name === 'notify_responsaveis') {
        const notifications = args.notifications || [];
        const created: string[] = [];
        const skipped: string[] = [];

        for (const n of notifications) {
          const contact = allContacts.find(c => c.id === n.contact_id);
          if (!contact) {
            skipped.push(`${n.contact_name}: contato nao encontrado`);
            continue;
          }

          const targetUserId = n.responsible_user_id || contact.assigned_to_user_id;

          if (!targetUserId) {
            skipped.push(`${n.contact_name}: sem responsavel atribuido — nao foi possivel notificar`);
            continue;
          }

          try {
            await admin.from('notifications').insert({
              organization_id: orgId,
              user_id: targetUserId,
              type: 'NEXT_ACTION',
              title: `Ação necessária: ${contact.name}`,
              body: n.message,
              contact_id: contact.id,
              metadata: { source: 'ai_chat', requested_by: userName },
            });
            const ownerName = profileMap.get(targetUserId) || 'usuario';
            created.push(`${contact.name} → notificacao enviada para ${ownerName}`);
            notificationsSent++;
          } catch (err: any) {
            skipped.push(`${contact.name}: erro ao enviar (${err.message})`);
          }
        }

        let result = '';
        if (created.length > 0) result += `Notificacoes enviadas com sucesso:\n${created.map(c => `- ${c}`).join('\n')}`;
        if (skipped.length > 0) result += `${result ? '\n\n' : ''}Nao enviados:\n${skipped.map(s => `- ${s}`).join('\n')}`;
        return result || 'Nenhuma notificacao para enviar.';
      }

      if (name === 'pesquisar_internet') {
        const query = args.query || '';
        searchesPerformed++;

        const results = await webSearch(query);

        if (results.length === 0) {
          return `Pesquisa por "${query}": nenhum resultado encontrado via API de busca. Use seu conhecimento para ajudar o usuario.`;
        }

        const formatted = results
          .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   Fonte: ${r.link}`)
          .join('\n\n');

        return `Resultados da pesquisa "${query}":\n\n${formatted}`;
      }

      if (name === 'consultar_contato') {
        const searchName = (args.contact_name || '').toLowerCase();

        // Find matching contact (search all org contacts, including terminal)
        const match = allOrgContacts.find(c =>
          c.name.toLowerCase().includes(searchName) ||
          (c.company && c.company.toLowerCase().includes(searchName))
        );

        if (!match) {
          return `Contato "${args.contact_name}" nao encontrado. Tente outro nome.`;
        }

        // Fetch full contact details
        const { data: fullContact } = await admin
          .from('contacts')
          .select('*')
          .eq('id', match.id)
          .single();

        if (!fullContact) {
          return `Erro ao buscar detalhes do contato ${match.name}.`;
        }

        // Fetch last 20 interactions
        const { data: interactions } = await admin
          .from('interactions')
          .select('type, outcome, note, created_at, created_by_user_id')
          .eq('contact_id', match.id)
          .order('created_at', { ascending: false })
          .limit(20);

        const fc = fullContact;
        const owner = fc.assigned_to_user_id ? (profileMap.get(fc.assigned_to_user_id) || 'Desconhecido') : 'Sem responsavel';

        let detail = `DETALHES COMPLETOS — ${fc.name}\n`;
        detail += `Empresa: ${fc.company || 'N/A'}\n`;
        detail += `Contato: ${fc.contato_nome || fc.name}\n`;
        detail += `Status: ${STATUS_LABELS[fc.status] || fc.status}\n`;
        detail += `Tipo: ${fc.tipo || 'N/A'}\n`;
        detail += `Segmento: ${fc.segmento ? (SEGMENTO_LABELS[fc.segmento] || fc.segmento) : 'N/A'}\n`;
        detail += `Temperatura: ${fc.temperatura ? (TEMPERATURA_LABELS[fc.temperatura] || fc.temperatura) : 'N/A'}\n`;
        detail += `Origem: ${fc.origem ? (ORIGEM_LABELS[fc.origem] || fc.origem) : 'N/A'}\n`;
        detail += `Responsavel: ${owner}\n`;
        detail += `Valor estimado: ${fc.valor_estimado ? `R$ ${fc.valor_estimado.toLocaleString('pt-BR')}` : 'N/A'}\n`;
        detail += `Telefone: ${fc.phone || 'N/A'}\n`;
        detail += `Email: ${fc.email || 'N/A'}\n`;
        detail += `WhatsApp: ${fc.whatsapp || fc.phone || 'N/A'}\n`;
        detail += `Cidade/Estado: ${[fc.cidade, fc.estado].filter(Boolean).join('/') || 'N/A'}\n`;
        if (fc.cpf) detail += `CPF: ${fc.cpf}\n`;
        if (fc.cnpj) detail += `CNPJ: ${fc.cnpj}\n`;
        if (fc.notes) detail += `Notas: ${fc.notes}\n`;
        if (fc.proxima_acao_tipo) {
          detail += `Proxima acao: ${fc.proxima_acao_tipo} em ${fc.proxima_acao_data?.split('T')[0] || '?'}\n`;
        }

        if (interactions && interactions.length > 0) {
          detail += `\nHISTORICO DE INTERACOES (ultimas ${interactions.length}):\n`;
          for (const i of interactions) {
            const date = new Date(i.created_at).toLocaleDateString('pt-BR');
            const byName = i.created_by_user_id ? (profileMap.get(i.created_by_user_id) || '?') : '?';
            detail += `  - ${date} | ${INTERACTION_TYPE_LABELS[i.type] || i.type} | ${INTERACTION_OUTCOME_LABELS[i.outcome] || i.outcome || 'N/A'} | por ${byName}`;
            if (i.note) detail += ` | "${i.note}"`;
            detail += '\n';
          }
        } else {
          detail += '\nNenhuma interacao registrada.\n';
        }

        return detail;
      }

      if (name === 'pesquisar_empresa') {
        const companyName = args.company_name || '';
        const focus = args.focus || 'geral';
        searchesPerformed++;

        let query = '';
        switch (focus) {
          case 'linkedin':
            query = `site:linkedin.com/company "${companyName}"`;
            break;
          case 'noticias':
            query = `"${companyName}" noticias recentes`;
            break;
          case 'cnpj':
            query = args.cnpj
              ? `CNPJ ${args.cnpj} dados cadastrais`
              : `"${companyName}" CNPJ dados cadastrais${args.city ? ` ${args.city}` : ''}`;
            break;
          default:
            query = `"${companyName}"${args.city ? ` ${args.city}` : ''} empresa`;
        }

        const results = await webSearch(query);

        if (results.length === 0) {
          return `Pesquisa sobre "${companyName}": nenhum resultado encontrado. Use seu conhecimento para ajudar.`;
        }

        const formatted = results
          .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   Fonte: ${r.link}`)
          .join('\n\n');

        return `Informacoes sobre "${companyName}" (foco: ${focus}):\n\n${formatted}`;
      }

      if (name === 'gerar_grafico') {
        chartsGenerated++;
        const chartData: Record<string, unknown> = {
          chart_type: args.chart_type,
          title: args.title,
        };
        if (args.chart_type === 'flowchart') {
          chartData.nodes = args.nodes || [];
          chartData.edges = args.edges || [];
        } else {
          chartData.data = args.data || [];
        }
        return `Grafico gerado com sucesso. Inclua este bloco na sua resposta para o usuario:\nCHART_DATA:${JSON.stringify(chartData)}:END_CHART_DATA`;
      }

      return 'Ferramenta desconhecida.';
    };

    const { content, toolResults } = await chatCompletionWithTools({
      messages: msgs,
      tools: TOOLS,
      executeToolCall,
      maxTokens: 2500,
      temperature: 0.7,
    });

    return NextResponse.json({
      reply: content,
      actions: {
        notificationsSent,
        searchesPerformed,
        chartsGenerated,
        details: toolResults,
      },
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar mensagem' },
      { status: 500 }
    );
  }
}
