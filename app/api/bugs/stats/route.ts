import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bugs/stats - Dashboard KPIs
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const orgId = profile.organization_id;

    // Fetch all bugs for this org to compute stats
    const { data: bugs, error } = await admin
      .from('bug_reports')
      .select('id, status, severity, work_front_id')
      .eq('organization_id', orgId);

    if (error) throw error;

    const allBugs = bugs || [];

    // Count by status
    const by_status: Record<string, number> = {};
    const statuses = ['ABERTO', 'EM_ANALISE', 'CORRIGINDO', 'TESTE', 'RESOLVIDO'];
    statuses.forEach((s) => { by_status[s] = 0; });
    allBugs.forEach((bug: any) => {
      by_status[bug.status] = (by_status[bug.status] || 0) + 1;
    });

    // Count by severity
    const by_severity: Record<string, number> = {};
    const severities = ['CRITICO', 'ALTO', 'MEDIO', 'BAIXO'];
    severities.forEach((s) => { by_severity[s] = 0; });
    allBugs.forEach((bug: any) => {
      by_severity[bug.severity] = (by_severity[bug.severity] || 0) + 1;
    });

    // Count by work front
    const workFrontCounts: Record<string, number> = {};
    allBugs.forEach((bug: any) => {
      if (bug.work_front_id) {
        workFrontCounts[bug.work_front_id] = (workFrontCounts[bug.work_front_id] || 0) + 1;
      }
    });

    // Fetch work front names
    let by_work_front: { id: string; name: string; count: number }[] = [];
    const wfIds = Object.keys(workFrontCounts);
    if (wfIds.length > 0) {
      const { data: workFronts } = await admin
        .from('work_fronts')
        .select('id, name')
        .in('id', wfIds);

      by_work_front = (workFronts || []).map((wf: any) => ({
        id: wf.id,
        name: wf.name,
        count: workFrontCounts[wf.id] || 0,
      }));
    }

    return NextResponse.json({
      by_status,
      by_severity,
      by_work_front,
      total: allBugs.length,
    });
  } catch (error: any) {
    console.error('Error fetching bug stats:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar estatisticas' },
      { status: 500 }
    );
  }
}
