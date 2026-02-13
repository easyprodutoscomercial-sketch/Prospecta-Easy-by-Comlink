import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { chatCompletionWithTools } from '@/lib/ai/openai';
import { webSearch } from '@/lib/ai/web-search';

const ACTIVE_STATUSES = ['NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA'];

const STATUS_LABELS: Record<string, string> = {
  NOVO: 'Novo',
  EM_PROSPECCAO: 'Em Prospecção',
  CONTATADO: 'Contatado',
  REUNIAO_MARCADA: 'Reunião Marcada',
};

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

    // Fetch contacts: user's own + unassigned (admin sees all)
    let contactQuery = admin
      .from('contacts')
      .select('id, name, company, status, valor_estimado, proxima_acao_tipo, proxima_acao_data, updated_at, temperatura, assigned_to_user_id')
      .eq('organization_id', orgId)
      .in('status', ACTIVE_STATUSES);

    if (!isAdmin) {
      // Non-admin: see own contacts + unassigned
      contactQuery = contactQuery.or(`assigned_to_user_id.eq.${userId},assigned_to_user_id.is.null`);
    }

    const { data: contacts } = await contactQuery;
    const allContacts = contacts || [];

    // Separate assigned vs unassigned
    const myContacts = allContacts.filter(c => c.assigned_to_user_id === userId);
    const unassignedContacts = allContacts.filter(c => !c.assigned_to_user_id);
    const othersContacts = allContacts.filter(c => c.assigned_to_user_id && c.assigned_to_user_id !== userId);

    // Count by stage (my contacts)
    const byStage: Record<string, number> = {};
    for (const c of myContacts) {
      byStage[c.status] = (byStage[c.status] || 0) + 1;
    }

    const totalValue = myContacts.reduce((sum, c) => sum + (c.valor_estimado || 0), 0);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Stale contacts (7+ days without update)
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
      let line = `  - [ID:${c.id}] ${c.name}`;
      if (c.company) line += ` (${c.company})`;
      line += ` | ${STATUS_LABELS[c.status] || c.status}`;
      line += ` | Responsavel: ${owner}`;
      if (c.valor_estimado) line += ` | R$${c.valor_estimado.toLocaleString('pt-BR')}`;
      if (days >= 5) line += ` | Parado ha ${days} dias`;
      if (c.proxima_acao_tipo) {
        const actionDate = c.proxima_acao_data?.split('T')[0] || '';
        const overdue = actionDate && actionDate < todayStr;
        line += ` | Acao: ${c.proxima_acao_tipo}${overdue ? ' (ATRASADA desde ' + actionDate + ')' : actionDate ? ' em ' + actionDate : ''}`;
      }
      return line;
    };

    const stageSummary = ACTIVE_STATUSES
      .map(s => `- ${STATUS_LABELS[s] || s}: ${byStage[s] || 0}`)
      .join('\n');

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

    const systemPrompt = `Voce e o assistente de vendas de ${userName}${isAdmin ? ' (ADMIN — ve todos os contatos da equipe)' : ''}.

PIPELINE DE ${userName.toUpperCase()}:
- Meus contatos ativos: ${myContacts.length}
${stageSummary}
- Valor total estimado: R$ ${totalValue.toLocaleString('pt-BR')}
- Contatos sem responsavel na org: ${unassignedContacts.length}${isAdmin ? `\n- Contatos de outros vendedores: ${othersContacts.length}` : ''}
${contactListSection}

FERRAMENTAS DISPONIVEIS:
1. notify_responsaveis — Envia notificacao no sistema para os responsaveis dos contatos. Use quando o usuario pedir para notificar, cobrar, ou lembrar as pessoas. Para contatos SEM RESPONSAVEL, mencione que precisam ser atribuidos primeiro.
2. pesquisar_internet — Pesquisa na internet. Use quando o usuario pedir ajuda sobre como abordar um cliente, informacoes de mercado, tecnicas de venda, dados sobre uma empresa/setor, ou qualquer informacao externa.

REGRAS:
- Responda em portugues brasileiro, direto e pratico
- Sugira acoes concretas (ligar para X, enviar proposta para Y)
- Seja breve (2-4 paragrafos max)
- Use os dados reais do pipeline — NUNCA invente contatos ou dados
- Quando notificar, pergunte ao responsavel o que ele precisa para dar o proximo passo com aquele contato
- Quando o usuario responder o que precisa, use pesquisar_internet para buscar informacoes uteis
- Ao listar contatos, use o nome real, nunca o ID
- Se perguntarem de contatos sem responsavel, sugira atribuicao`;

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

      return 'Ferramenta desconhecida.';
    };

    const { content, toolResults } = await chatCompletionWithTools({
      messages: msgs,
      tools: TOOLS,
      executeToolCall,
      maxTokens: 1200,
      temperature: 0.7,
    });

    return NextResponse.json({
      reply: content,
      actions: {
        notificationsSent,
        searchesPerformed,
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
