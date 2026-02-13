import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { chatCompletion } from '@/lib/ai/openai';

const ACTIVE_STATUSES = ['NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA'];

const STATUS_LABELS: Record<string, string> = {
  NOVO: 'Novo',
  EM_PROSPECCAO: 'Em Prospecção',
  CONTATADO: 'Contatado',
  REUNIAO_MARCADA: 'Reunião Marcada',
};

interface PendingContact {
  id: string;
  name: string;
  company: string | null;
  status: string;
  valor_estimado: number | null;
  proxima_acao_tipo: string | null;
  proxima_acao_data: string | null;
  updated_at: string;
  temperatura: string | null;
  assigned_to_user_id: string | null;
  daysSinceUpdate: number;
  reason: 'stale' | 'overdue' | 'today' | 'no_owner';
  lastInteraction: { type: string; outcome: string; happened_at: string } | null;
}

// Gera dicas da IA para um lote de contatos de um responsavel
async function generateAITips(
  ownerName: string,
  contacts: PendingContact[]
): Promise<Map<string, string>> {
  const tips = new Map<string, string>();

  // Se OpenAI nao configurada, retorna dicas genéricas
  if (!process.env.OPENAI_API_KEY) {
    for (const c of contacts) {
      tips.set(c.id, getGenericTip(c));
    }
    return tips;
  }

  // Montar lista de contatos para a IA analisar
  const contactList = contacts.map((c, i) => {
    let line = `${i + 1}. [${c.id}] ${c.name}`;
    if (c.company) line += ` (${c.company})`;
    line += ` | Etapa: ${STATUS_LABELS[c.status] || c.status}`;
    line += ` | Parado: ${c.daysSinceUpdate} dias`;
    if (c.valor_estimado) line += ` | Valor: R$${c.valor_estimado.toLocaleString('pt-BR')}`;
    if (c.temperatura) line += ` | Temperatura: ${c.temperatura}`;
    if (c.proxima_acao_tipo) {
      line += ` | Proxima acao: ${c.proxima_acao_tipo}`;
      if (c.proxima_acao_data) line += ` (${c.proxima_acao_data.split('T')[0]})`;
    }
    if (c.lastInteraction) {
      line += ` | Ultima interacao: ${c.lastInteraction.type} (${c.lastInteraction.outcome}) em ${c.lastInteraction.happened_at.split('T')[0]}`;
    }
    line += ` | Motivo alerta: ${c.reason === 'stale' ? 'parado' : c.reason === 'overdue' ? 'acao atrasada' : c.reason === 'today' ? 'acao para hoje' : 'sem responsavel'}`;
    return line;
  }).join('\n');

  try {
    const response = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: `Voce e um coach de vendas. Analise os contatos abaixo do vendedor ${ownerName} e gere uma dica pratica e ESPECIFICA para cada um.

REGRAS:
- Para cada contato, gere exatamente UMA dica curta (2-3 frases max)
- Seja direto: diga exatamente O QUE fazer (ligar, enviar email, mandar proposta, reagendar, etc)
- Use o contexto: etapa, tempo parado, temperatura, ultima interacao
- Se o contato tem valor alto, destaque a urgencia
- Se esta em "Novo" ha muito tempo, sugira primeiro contato
- Se esta em "Contatado", sugira follow-up ou reuniao
- Se esta em "Reuniao Marcada", sugira enviar proposta ou fechar
- Se a acao esta atrasada, sugira executar hoje com uma abordagem especifica
- Responda APENAS no formato JSON: { "dicas": { "ID_DO_CONTATO": "dica aqui", ... } }
- Use os IDs exatos entre colchetes [ID] de cada contato`,
        },
        {
          role: 'user',
          content: `Contatos de ${ownerName} que precisam de atencao:\n\n${contactList}`,
        },
      ],
      maxTokens: 1000,
      temperature: 0.7,
    });

    // Parse JSON da resposta
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const dicas = parsed.dicas || parsed;
      for (const [id, dica] of Object.entries(dicas)) {
        if (typeof dica === 'string') {
          tips.set(id, dica);
        }
      }
    }
  } catch (err) {
    console.error('[daily-notify] Erro ao gerar dicas IA:', err);
  }

  // Fallback: contatos sem dica da IA ganham dica generica
  for (const c of contacts) {
    if (!tips.has(c.id)) {
      tips.set(c.id, getGenericTip(c));
    }
  }

  return tips;
}

function getGenericTip(c: PendingContact): string {
  if (c.reason === 'overdue') {
    return `Execute a ação "${c.proxima_acao_tipo || 'pendente'}" o quanto antes para não esfriar o contato.`;
  }
  if (c.reason === 'today') {
    return `Você tem "${c.proxima_acao_tipo || 'ação'}" agendada para hoje. Prepare-se e execute!`;
  }
  if (c.status === 'NOVO') {
    return `Faça o primeiro contato o mais rápido possível. Quanto mais demora, menor a chance de conversão.`;
  }
  if (c.status === 'CONTATADO') {
    return `Já fez contato — agora proponha uma reunião ou envie mais informações para avançar.`;
  }
  if (c.status === 'REUNIAO_MARCADA') {
    return `Reunião marcada — prepare uma proposta personalizada e confirme o horário.`;
  }
  return `Retome o contato com ${c.name}. Um follow-up rápido pode reativar a negociação.`;
}

// GET /api/cron/daily-notify
// Roda de 1 em 1 hora. IA analisa contatos e envia dicas personalizadas.
export async function GET(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && secret !== cronSecret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const admin = getAdminClient();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const { data: orgs } = await admin.from('organizations').select('id');
    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ message: 'Nenhuma organizacao encontrada', notified: 0 });
    }

    let totalNotifications = 0;
    const orgResults: any[] = [];

    for (const org of orgs) {
      const orgId = org.id;

      // Buscar contatos ativos
      const { data: contacts } = await admin
        .from('contacts')
        .select('id, name, company, status, valor_estimado, proxima_acao_tipo, proxima_acao_data, updated_at, temperatura, assigned_to_user_id')
        .eq('organization_id', orgId)
        .in('status', ACTIVE_STATUSES);

      if (!contacts || contacts.length === 0) continue;

      // Buscar profiles
      const { data: profiles } = await admin
        .from('profiles')
        .select('user_id, name, role')
        .eq('organization_id', orgId);

      const profileMap = new Map<string, string>();
      const adminIds: string[] = [];
      for (const p of profiles || []) {
        profileMap.set(p.user_id, p.name);
        if (p.role === 'admin') adminIds.push(p.user_id);
      }

      // Buscar ultima interacao de cada contato
      const contactIds = contacts.map(c => c.id);
      let interactionMap = new Map<string, any>();
      if (contactIds.length > 0) {
        const { data: interactions } = await admin
          .from('interactions')
          .select('contact_id, type, outcome, happened_at')
          .eq('organization_id', orgId)
          .in('contact_id', contactIds)
          .order('happened_at', { ascending: false });

        for (const inter of interactions || []) {
          if (!interactionMap.has(inter.contact_id)) {
            interactionMap.set(inter.contact_id, inter);
          }
        }
      }

      // Anti-duplicata: ultimas 6h
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
      const { data: recentNotifs } = await admin
        .from('notifications')
        .select('contact_id, user_id, type')
        .eq('organization_id', orgId)
        .gte('created_at', sixHoursAgo)
        .in('type', ['NEXT_ACTION', 'STALE_DEAL', 'NO_OWNER', 'COACHING_TIP']);

      const recentKeys = new Set(
        (recentNotifs || []).map(n => `${n.contact_id}:${n.user_id}:${n.type}`)
      );

      // Classificar contatos que precisam de atencao
      const pendingByUser = new Map<string, PendingContact[]>();

      for (const contact of contacts) {
        const daysSinceUpdate = Math.floor(
          (now.getTime() - new Date(contact.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        const hasOwner = !!contact.assigned_to_user_id;
        const lastInteraction = interactionMap.get(contact.id) || null;

        const base = { ...contact, daysSinceUpdate, lastInteraction };

        // Contato parado 5+ dias (com dono)
        if (daysSinceUpdate >= 5 && hasOwner) {
          const userId = contact.assigned_to_user_id!;
          const key = `${contact.id}:${userId}:STALE_DEAL`;
          if (!recentKeys.has(key)) {
            const list = pendingByUser.get(userId) || [];
            list.push({ ...base, reason: 'stale' });
            pendingByUser.set(userId, list);
          }
        }

        // Acao atrasada (com dono)
        if (contact.proxima_acao_data && contact.proxima_acao_data.split('T')[0] < todayStr && hasOwner) {
          const userId = contact.assigned_to_user_id!;
          const key = `${contact.id}:${userId}:NEXT_ACTION`;
          if (!recentKeys.has(key)) {
            const existing = pendingByUser.get(userId) || [];
            // Evitar duplicar se ja adicionou como stale
            if (!existing.find(e => e.id === contact.id)) {
              existing.push({ ...base, reason: 'overdue' });
              pendingByUser.set(userId, existing);
            }
          }
        }

        // Acao para hoje (com dono)
        if (contact.proxima_acao_data && contact.proxima_acao_data.split('T')[0] === todayStr && hasOwner) {
          const userId = contact.assigned_to_user_id!;
          const key = `${contact.id}:${userId}:NEXT_ACTION`;
          if (!recentKeys.has(key)) {
            const existing = pendingByUser.get(userId) || [];
            if (!existing.find(e => e.id === contact.id)) {
              existing.push({ ...base, reason: 'today' });
              pendingByUser.set(userId, existing);
            }
          }
        }

        // Sem responsavel 3+ dias (notificar admins)
        if (!hasOwner && daysSinceUpdate >= 3) {
          for (const adminId of adminIds) {
            const key = `${contact.id}:${adminId}:NO_OWNER`;
            if (!recentKeys.has(key)) {
              const existing = pendingByUser.get(adminId) || [];
              if (!existing.find(e => e.id === contact.id)) {
                existing.push({ ...base, reason: 'no_owner' });
                pendingByUser.set(adminId, existing);
              }
            }
          }
        }
      }

      // Para cada responsavel, gerar dicas com IA e criar notificacoes
      const notificationsToInsert: any[] = [];

      for (const [userId, userContacts] of pendingByUser) {
        const ownerName = profileMap.get(userId) || 'Vendedor';

        // Limitar a 15 contatos por usuario por rodada (performance)
        const batch = userContacts.slice(0, 15);

        // Chamar IA para gerar dicas (1 call por usuario)
        const tips = await generateAITips(ownerName, batch);

        for (const contact of batch) {
          const tip = tips.get(contact.id) || getGenericTip(contact);

          if (contact.reason === 'no_owner') {
            notificationsToInsert.push({
              organization_id: orgId,
              user_id: userId,
              type: 'NO_OWNER',
              title: `⚠️ Sem responsável: ${contact.name}`,
              body: `${contact.name}${contact.company ? ` (${contact.company})` : ''} está em "${STATUS_LABELS[contact.status] || contact.status}" há ${contact.daysSinceUpdate} dias sem responsável.${contact.valor_estimado ? ` Valor: R$ ${contact.valor_estimado.toLocaleString('pt-BR')}.` : ''}\n\n💡 Dica IA: ${tip}`,
              contact_id: contact.id,
              metadata: { source: 'cron_ai', days_stale: contact.daysSinceUpdate, ai_tip: tip },
            });
          } else if (contact.reason === 'overdue') {
            const actionDate = contact.proxima_acao_data?.split('T')[0] || '';
            notificationsToInsert.push({
              organization_id: orgId,
              user_id: userId,
              type: 'NEXT_ACTION',
              title: `🔴 Ação atrasada: ${contact.name}`,
              body: `A ação "${contact.proxima_acao_tipo || 'Pendente'}" com ${contact.name}${contact.company ? ` (${contact.company})` : ''} está atrasada desde ${actionDate}.\n\n💡 Dica IA: ${tip}`,
              contact_id: contact.id,
              metadata: { source: 'cron_ai', action_type: contact.proxima_acao_tipo, due_date: actionDate, ai_tip: tip },
            });
          } else if (contact.reason === 'today') {
            notificationsToInsert.push({
              organization_id: orgId,
              user_id: userId,
              type: 'NEXT_ACTION',
              title: `📋 Ação para hoje: ${contact.name}`,
              body: `Hoje: "${contact.proxima_acao_tipo || 'Ação'}" com ${contact.name}${contact.company ? ` (${contact.company})` : ''}.\n\n💡 Dica IA: ${tip}`,
              contact_id: contact.id,
              metadata: { source: 'cron_ai', action_type: contact.proxima_acao_tipo, due_date: todayStr, ai_tip: tip },
            });
          } else {
            // stale
            notificationsToInsert.push({
              organization_id: orgId,
              user_id: userId,
              type: 'STALE_DEAL',
              title: `⏰ ${contact.name} parado há ${contact.daysSinceUpdate} dias`,
              body: `${contact.name}${contact.company ? ` (${contact.company})` : ''} está em "${STATUS_LABELS[contact.status] || contact.status}" há ${contact.daysSinceUpdate} dias.${contact.valor_estimado ? ` Valor: R$ ${contact.valor_estimado.toLocaleString('pt-BR')}.` : ''}\n\n💡 Dica IA: ${tip}`,
              contact_id: contact.id,
              metadata: { source: 'cron_ai', days_stale: contact.daysSinceUpdate, ai_tip: tip },
            });
          }
        }
      }

      // Inserir em batch
      if (notificationsToInsert.length > 0) {
        const { error } = await admin.from('notifications').insert(notificationsToInsert);
        if (error) {
          console.error(`[daily-notify] Erro org ${orgId}:`, error.message);
        } else {
          totalNotifications += notificationsToInsert.length;
        }
      }

      orgResults.push({
        org_id: orgId,
        contacts_analyzed: contacts.length,
        users_notified: pendingByUser.size,
        notifications_created: notificationsToInsert.length,
      });
    }

    console.log(`[daily-notify] Concluido: ${totalNotifications} notificacoes com dicas IA em ${orgs.length} org(s)`);

    return NextResponse.json({
      success: true,
      total_notifications: totalNotifications,
      organizations: orgResults,
      executed_at: now.toISOString(),
    });
  } catch (error: any) {
    console.error('[daily-notify] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
