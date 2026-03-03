import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/suporte/stats - Dashboard KPIs
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

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('project_id');

    // Fetch all tickets for this org to compute stats
    let query = admin
      .from('support_tickets')
      .select('id, status, ticket_type, priority, due_date, project_id')
      .eq('organization_id', orgId);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: tickets, error } = await query;

    if (error) throw error;

    const allTickets = tickets || [];

    // Count by status
    const by_status: Record<string, number> = {};
    const statuses = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO', 'RESOLVIDO', 'FECHADO'];
    statuses.forEach((s) => { by_status[s] = 0; });
    allTickets.forEach((t: any) => {
      by_status[t.status] = (by_status[t.status] || 0) + 1;
    });

    // Count by type
    const by_type: Record<string, number> = {};
    const types = ['SUPORTE', 'TAREFA', 'BUG'];
    types.forEach((t) => { by_type[t] = 0; });
    allTickets.forEach((t: any) => {
      by_type[t.ticket_type] = (by_type[t.ticket_type] || 0) + 1;
    });

    // Count by priority
    const by_priority: Record<string, number> = {};
    const priorities = ['URGENTE', 'ALTA', 'NORMAL', 'BAIXA'];
    priorities.forEach((p) => { by_priority[p] = 0; });
    allTickets.forEach((t: any) => {
      by_priority[t.priority] = (by_priority[t.priority] || 0) + 1;
    });

    // Count by project
    const by_project: Record<string, number> = {};
    allTickets.forEach((t: any) => {
      const pid = t.project_id || '_none';
      by_project[pid] = (by_project[pid] || 0) + 1;
    });

    // Count overdue
    const today = new Date().toISOString().split('T')[0];
    const overdue = allTickets.filter((t: any) =>
      t.due_date &&
      t.due_date < today &&
      t.status !== 'RESOLVIDO' &&
      t.status !== 'FECHADO'
    ).length;

    return NextResponse.json({
      by_status,
      by_type,
      by_priority,
      by_project,
      overdue,
      total: allTickets.length,
    });
  } catch (error: any) {
    console.error('Error fetching support stats:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao buscar estatisticas' },
      { status: 500 }
    );
  }
}
