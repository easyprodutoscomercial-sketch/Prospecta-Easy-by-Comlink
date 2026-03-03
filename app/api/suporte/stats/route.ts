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
      .select('*')
      .eq('organization_id', orgId);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: tickets, error } = await query;

    if (error) throw error;

    const allTickets = tickets || [];

    // Fetch SUPORTE pipeline stages for stage-based stats
    let stages: any[] = [];
    const terminalStageIds = new Set<string>();
    const stageMap: Record<string, any> = {};

    try {
      const { data: suportePipeline } = await admin
        .from('pipelines')
        .select('id')
        .eq('organization_id', orgId)
        .eq('pipeline_type', 'SUPORTE')
        .eq('is_default', true)
        .limit(1)
        .single();

      if (suportePipeline) {
        const { data: stagesData } = await admin
          .from('pipeline_stages')
          .select('*')
          .eq('pipeline_id', suportePipeline.id)
          .order('position', { ascending: true });

        stages = stagesData || [];
        stages.forEach((s: any) => {
          stageMap[s.id] = s;
          if (s.is_terminal) terminalStageIds.add(s.id);
        });
      }
    } catch {
      // Pipeline may not exist yet
    }

    // Count by status (legacy)
    const by_status: Record<string, number> = {};
    const statuses = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO', 'RESOLVIDO', 'FECHADO'];
    statuses.forEach((s) => { by_status[s] = 0; });
    allTickets.forEach((t: any) => {
      by_status[t.status] = (by_status[t.status] || 0) + 1;
    });

    // Count by stage
    const by_stage: Record<string, number> = {};
    stages.forEach((s: any) => { by_stage[s.id] = 0; });
    allTickets.forEach((t: any) => {
      if (t.stage_id && by_stage[t.stage_id] !== undefined) {
        by_stage[t.stage_id] = (by_stage[t.stage_id] || 0) + 1;
      }
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

    // Count overdue - use terminal stages if available, fallback to status
    const today = new Date().toISOString().split('T')[0];
    const overdue = allTickets.filter((t: any) => {
      if (!t.due_date || t.due_date >= today) return false;
      if (terminalStageIds.size > 0 && t.stage_id) {
        return !terminalStageIds.has(t.stage_id);
      }
      return t.status !== 'RESOLVIDO' && t.status !== 'FECHADO';
    }).length;

    return NextResponse.json({
      by_status,
      by_stage,
      by_type,
      by_priority,
      by_project,
      overdue,
      total: allTickets.length,
      stages: stages.map((s: any) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        color: s.color,
        position: s.position,
        is_terminal: s.is_terminal,
        terminal_type: s.terminal_type,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching support stats:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao buscar estatisticas' },
      { status: 500 }
    );
  }
}
