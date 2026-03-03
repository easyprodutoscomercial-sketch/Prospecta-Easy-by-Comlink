import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/reports - Comprehensive analytics data
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();
    const orgId = profile.organization_id;
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = searchParams.get('to') || new Date().toISOString().split('T')[0];
    const pipelineId = searchParams.get('pipeline_id');

    const fromDate = `${from}T00:00:00`;
    const toDate = `${to}T23:59:59`;

    // Parallel data fetches
    const [contactsRes, interactionsRes, stagesRes, profilesRes] = await Promise.all([
      admin.from('contacts').select('id, name, status, stage_id, pipeline_id, temperatura, origem, valor_estimado, assigned_to_user_id, created_at, updated_at, lead_score')
        .eq('organization_id', orgId),
      admin.from('interactions').select('id, contact_id, type, outcome, created_by_user_id, happened_at, created_at')
        .eq('organization_id', orgId)
        .gte('happened_at', fromDate)
        .lte('happened_at', toDate),
      pipelineId
        ? admin.from('pipeline_stages').select('id, name, slug, position, is_terminal, terminal_type').eq('pipeline_id', pipelineId).order('position')
        : Promise.resolve({ data: [] }),
      admin.from('profiles').select('user_id, name').eq('organization_id', orgId),
    ]);

    const contacts = contactsRes.data || [];
    const interactions = interactionsRes.data || [];
    const stages = stagesRes.data || [];
    const profiles = profilesRes.data || [];

    const filteredContacts = pipelineId
      ? contacts.filter((c) => c.pipeline_id === pipelineId)
      : contacts;

    // Stage conversion — contacts per stage
    const stageConversion = stages.map((s: any) => ({
      stage_id: s.id,
      stage_name: s.name,
      count: filteredContacts.filter((c) => c.stage_id === s.id).length,
      value: filteredContacts.filter((c) => c.stage_id === s.id).reduce((sum, c) => sum + (c.valor_estimado || 0), 0),
      is_terminal: s.is_terminal,
      terminal_type: s.terminal_type,
    }));

    // Lost by stage — contacts in lost/terminal stages
    const lostContacts = filteredContacts.filter((c) => c.status === 'PERDIDO');
    const lostByStageMap: Record<string, number> = {};
    for (const c of lostContacts) {
      const key = c.stage_id || 'unknown';
      lostByStageMap[key] = (lostByStageMap[key] || 0) + 1;
    }
    const lostByStage = Object.entries(lostByStageMap).map(([stage_id, count]) => ({ stage_id, count }));

    // Revenue forecast
    const activeContacts = filteredContacts.filter((c) => !['CONVERTIDO', 'PERDIDO'].includes(c.status));
    const totalPipeline = activeContacts.reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
    const avgConversionRate = filteredContacts.length > 0
      ? filteredContacts.filter((c) => c.status === 'CONVERTIDO').length / filteredContacts.length
      : 0;

    const forecast = {
      total_pipeline: totalPipeline,
      avg_conversion_rate: avgConversionRate,
      forecast_30d: Math.round(totalPipeline * avgConversionRate * 0.3),
      forecast_60d: Math.round(totalPipeline * avgConversionRate * 0.6),
      forecast_90d: Math.round(totalPipeline * avgConversionRate * 0.9),
      won_value: filteredContacts.filter((c) => c.status === 'CONVERTIDO').reduce((sum, c) => sum + (c.valor_estimado || 0), 0),
    };

    // User performance
    const userMap = new Map(profiles.map((p: any) => [p.user_id, p.name]));
    const userPerformanceMap: Record<string, any> = {};
    for (const c of filteredContacts) {
      const uid = c.assigned_to_user_id || 'unassigned';
      if (!userPerformanceMap[uid]) {
        userPerformanceMap[uid] = {
          user_id: uid,
          user_name: userMap.get(uid) || 'Sem responsavel',
          contacts_total: 0,
          contacts_won: 0,
          contacts_lost: 0,
          interactions_count: 0,
          total_value: 0,
        };
      }
      userPerformanceMap[uid].contacts_total++;
      if (c.status === 'CONVERTIDO') userPerformanceMap[uid].contacts_won++;
      if (c.status === 'PERDIDO') userPerformanceMap[uid].contacts_lost++;
      userPerformanceMap[uid].total_value += c.valor_estimado || 0;
    }
    for (const i of interactions) {
      const uid = i.created_by_user_id || 'unknown';
      if (userPerformanceMap[uid]) userPerformanceMap[uid].interactions_count++;
    }
    const userPerformance = Object.values(userPerformanceMap).sort((a: any, b: any) => b.total_value - a.total_value);

    // Activity timeline — daily interaction counts
    const activityMap: Record<string, number> = {};
    for (const i of interactions) {
      const day = i.happened_at.split('T')[0];
      activityMap[day] = (activityMap[day] || 0) + 1;
    }
    const activityTimeline = Object.entries(activityMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Temperature distribution
    const tempMap: Record<string, number> = {};
    for (const c of filteredContacts) {
      const temp = c.temperatura || 'SEM';
      tempMap[temp] = (tempMap[temp] || 0) + 1;
    }
    const temperatureDistribution = Object.entries(tempMap).map(([name, value]) => ({ name, value }));

    // Origin distribution
    const originMap: Record<string, number> = {};
    for (const c of filteredContacts) {
      const origin = c.origem || 'OUTRO';
      originMap[origin] = (originMap[origin] || 0) + 1;
    }
    const originDistribution = Object.entries(originMap).map(([name, value]) => ({ name, value }));

    return NextResponse.json({
      stageConversion,
      lostByStage,
      forecast,
      userPerformance,
      activityTimeline,
      temperatureDistribution,
      originDistribution,
      period: { from, to },
      total_contacts: filteredContacts.length,
      total_interactions: interactions.length,
    });
  } catch (error: any) {
    console.error('Error in reports:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
