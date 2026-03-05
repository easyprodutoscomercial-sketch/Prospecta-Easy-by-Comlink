import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/pedidos-cotacoes/stats - Dashboard KPIs
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const orgId = profile.organization_id;
    if (!orgId) {
      return NextResponse.json({ error: 'Organization nao encontrada' }, { status: 400 });
    }

    // Fetch all pc_clients for this org
    const { data: clients, error: clientsError } = await admin
      .from('pc_clients')
      .select('*')
      .eq('organization_id', orgId);

    if (clientsError) throw clientsError;

    // Fetch all pc_cotacoes for this org
    const { data: cotacoes, error: cotacoesError } = await admin
      .from('pc_cotacoes')
      .select('*')
      .eq('organization_id', orgId);

    if (cotacoesError) throw cotacoesError;

    // Fetch all pc_pedidos for this org
    const { data: pedidos, error: pedidosError } = await admin
      .from('pc_pedidos')
      .select('*')
      .eq('organization_id', orgId);

    if (pedidosError) throw pedidosError;

    const allClients = clients || [];
    const allCotacoes = cotacoes || [];
    const allPedidos = pedidos || [];

    // Clients by status_sac
    const clients_by_status: Record<string, number> = {};
    allClients.forEach((c: any) => {
      const status = c.status_sac || 'PRE_CADASTRO';
      clients_by_status[status] = (clients_by_status[status] || 0) + 1;
    });

    // Cotacoes responderam / nao responderam
    const cotacoes_responderam = allCotacoes.filter((c: any) => c.resposta === 'RESPONDEU').length;
    const cotacoes_nao_responderam = allCotacoes.filter((c: any) => c.resposta !== 'RESPONDEU').length;

    // Pedidos by situacao
    const pedidos_by_situacao: Record<string, number> = {};
    allPedidos.forEach((p: any) => {
      const situacao = p.situacao || 'PENDENTE';
      pedidos_by_situacao[situacao] = (pedidos_by_situacao[situacao] || 0) + 1;
    });

    // Pedidos finalizados
    const pedidos_finalizados = allPedidos.filter((p: any) => p.finalizado === true).length;

    // Recent cotacoes (5 most recent)
    const recent_cotacoes = [...allCotacoes]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    // Recent pedidos (5 most recent)
    const recent_pedidos = [...allPedidos]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    // Top 10 fornecedores com mais cotações
    const fornecedorCount: Record<string, number> = {};
    allCotacoes.forEach((c: any) => {
      const f = c.fornecedor?.trim();
      if (f) {
        fornecedorCount[f] = (fornecedorCount[f] || 0) + 1;
      }
    });
    const top_fornecedores = Object.entries(fornecedorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Pedidos ativos (não finalizados)
    const pedidos_ativos = allPedidos.filter((p: any) => !p.finalizado).length;

    // Taxa de resposta percentual
    const taxa_resposta_pct = allCotacoes.length > 0
      ? Math.round((cotacoes_responderam / allCotacoes.length) * 100)
      : 0;

    // Alerts (Feature 4)
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const alerts: { type: 'warning' | 'danger'; message: string; entity: string; entity_id: string; days_old: number }[] = [];

    allCotacoes.forEach((c: any) => {
      if (c.resposta === 'NAO_RESPONDEU') {
        const daysOld = Math.floor((now - new Date(c.created_at).getTime()) / DAY_MS);
        if (daysOld > 7) {
          alerts.push({
            type: daysOld > 14 ? 'danger' : 'warning',
            message: `Cotacao #${c.cotacao_numero} - ${c.fornecedor} sem resposta ha ${daysOld} dias`,
            entity: 'cotacao',
            entity_id: c.id,
            days_old: daysOld,
          });
        }
      }
    });

    allPedidos.forEach((p: any) => {
      if (p.finalizado) return;
      const daysOld = Math.floor((now - new Date(p.created_at).getTime()) / DAY_MS);
      if (p.situacao === 'PENDENTE' && daysOld > 14) {
        alerts.push({
          type: daysOld > 21 ? 'danger' : 'warning',
          message: `Pedido #${p.pedido_numero} - ${p.empresa} pendente ha ${daysOld} dias`,
          entity: 'pedido',
          entity_id: p.id,
          days_old: daysOld,
        });
      } else if (p.situacao === 'EM_ANDAMENTO' && daysOld > 30) {
        alerts.push({
          type: 'warning',
          message: `Pedido #${p.pedido_numero} - ${p.empresa} em andamento ha ${daysOld} dias`,
          entity: 'pedido',
          entity_id: p.id,
          days_old: daysOld,
        });
      }
    });

    alerts.sort((a, b) => b.days_old - a.days_old);

    return NextResponse.json({
      total_clients: allClients.length,
      total_cotacoes: allCotacoes.length,
      total_pedidos: allPedidos.length,
      clients_by_status,
      cotacoes_responderam,
      cotacoes_nao_responderam,
      pedidos_by_situacao,
      pedidos_finalizados,
      recent_cotacoes,
      recent_pedidos,
      top_fornecedores,
      pedidos_ativos,
      taxa_resposta_pct,
      alerts,
    });
  } catch (error: any) {
    console.error('Error fetching pedidos-cotacoes stats:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao buscar estatisticas' },
      { status: 500 }
    );
  }
}
