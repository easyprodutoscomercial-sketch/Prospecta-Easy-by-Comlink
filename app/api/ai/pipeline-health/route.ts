import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { analyzeContacts } from '@/lib/ai/rules-engine';
import { ContactForAnalysis, PipelineHealth } from '@/lib/ai/types';
import { chatCompletionJSON } from '@/lib/ai/openai';
import { buildCoachingPrompt } from '@/lib/ai/prompts';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const admin = getAdminClient();
    const orgId = profile.organization_id;

    // Fetch all pipelines for the org
    const { data: pipelines } = await admin
      .from('pipelines')
      .select('id')
      .eq('organization_id', orgId);

    const pipelineIds = (pipelines || []).map((p: any) => p.id);

    // Fetch stages for those pipelines
    const { data: stages } = await admin
      .from('pipeline_stages')
      .select('id, name, is_terminal, terminal_type')
      .in('pipeline_id', pipelineIds.length > 0 ? pipelineIds : ['__none__']);

    const activeStageIds = new Set<string>();
    const wonStageIds = new Set<string>();
    const stageNameMap = new Map<string, string>();

    for (const s of stages || []) {
      stageNameMap.set(s.id, s.name);
      if (s.is_terminal) {
        if (s.terminal_type === 'won') wonStageIds.add(s.id);
      } else {
        activeStageIds.add(s.id);
      }
    }

    // Fetch active contacts using stage_id (not old status field)
    let activeContacts: any[] = [];
    if (activeStageIds.size > 0) {
      const { data, error } = await admin
        .from('contacts')
        .select('*')
        .eq('organization_id', orgId)
        .in('stage_id', Array.from(activeStageIds));

      if (error) {
        console.error('Pipeline health: contacts query error:', error.message);
      }
      activeContacts = data || [];
    }

    // Fetch interactions for active contacts
    const contactIds = activeContacts.map((c: any) => c.id);
    let interactions: any[] = [];
    if (contactIds.length > 0) {
      const { data: intData } = await admin
        .from('interactions')
        .select('contact_id, type, outcome, happened_at, created_at')
        .eq('organization_id', orgId)
        .in('contact_id', contactIds)
        .order('happened_at', { ascending: false });
      interactions = intData || [];
    }

    // Group interactions by contact
    const interactionsByContact = new Map<string, any[]>();
    for (const i of interactions) {
      const list = interactionsByContact.get(i.contact_id) || [];
      list.push(i);
      interactionsByContact.set(i.contact_id, list);
    }

    const contactsForAnalysis: ContactForAnalysis[] = activeContacts.map((c: any) => ({
      ...c,
      stage_name: stageNameMap.get(c.stage_id) || null,
      interactions: (interactionsByContact.get(c.id) || []).slice(0, 10),
    }));

    // Run rules engine with stage_id awareness
    const alerts = analyzeContacts(contactsForAnalysis, { activeStageIds });

    // Compute metrics by stage name
    const now = new Date();
    const byStage: Record<string, number> = {};
    const daysInStageSum: Record<string, number> = {};
    const daysInStageCount: Record<string, number> = {};
    let noOwner = 0;
    let noNextAction = 0;

    for (const c of activeContacts) {
      const stageName = stageNameMap.get(c.stage_id) || 'Desconhecido';
      byStage[stageName] = (byStage[stageName] || 0) + 1;

      const days = Math.floor((now.getTime() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      daysInStageSum[stageName] = (daysInStageSum[stageName] || 0) + days;
      daysInStageCount[stageName] = (daysInStageCount[stageName] || 0) + 1;

      if (!c.assigned_to_user_id) noOwner++;
      if (!c.proxima_acao_tipo && !c.proxima_acao_data) noNextAction++;
    }

    const avgDaysInStage: Record<string, number> = {};
    for (const [stage, sum] of Object.entries(daysInStageSum)) {
      avgDaysInStage[stage] = Math.round(sum / (daysInStageCount[stage] || 1));
    }

    // Get conversion stats using won stage_ids
    let totalConverted = 0;
    if (wonStageIds.size > 0) {
      const { count } = await admin
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('stage_id', Array.from(wonStageIds));
      totalConverted = count || 0;
    }

    const { count: totalAll } = await admin
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    const conversionRate = totalAll && totalAll > 0
      ? Math.round((totalConverted / totalAll) * 100)
      : 0;

    const totalValue = activeContacts.reduce((sum: number, c: any) => sum + (c.valor_estimado || 0), 0);

    const atRiskContacts = new Set(
      alerts.filter((a) => a.level === 'CRITICAL' || a.level === 'HIGH').map((a) => a.contactId)
    );
    const staleContacts = new Set(
      alerts.filter((a) => a.rule === 'STALE_DEAL').map((a) => a.contactId)
    );

    // Try to get coaching from cache
    let coachingTips: string[] = [];
    const cacheKey = `pipeline_${orgId}`;
    let cachedCoaching: any = null;
    try {
      const { data } = await admin
        .from('ai_analysis_cache')
        .select('result, expires_at')
        .eq('organization_id', orgId)
        .eq('analysis_type', 'coaching')
        .eq('cache_key', cacheKey)
        .gte('expires_at', now.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      cachedCoaching = data;
    } catch { /* table may not exist yet */ }

    if (cachedCoaching) {
      coachingTips = cachedCoaching.result as string[];
    } else {
      // Generate coaching with OpenAI
      try {
        const prompt = buildCoachingPrompt({
          totalActive: activeContacts.length,
          byStage,
          avgDaysInStage,
          atRiskCount: atRiskContacts.size,
          staleCount: staleContacts.size,
          noOwnerCount: noOwner,
          noNextActionCount: noNextAction,
          conversionRate,
          totalValue,
        });

        coachingTips = await chatCompletionJSON<string[]>({
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          maxTokens: 500,
          temperature: 0.7,
        });

        // Cache for 6 hours (silently fail if table not ready)
        try {
          const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
          await admin.from('ai_analysis_cache').insert({
            organization_id: orgId,
            analysis_type: 'coaching',
            cache_key: cacheKey,
            result: coachingTips,
            expires_at: expiresAt,
          });
        } catch { /* table may not exist yet */ }
      } catch (e) {
        console.error('Error generating coaching tips:', e);
        coachingTips = ['Configure a OPENAI_API_KEY para receber dicas de coaching com IA.'];
      }
    }

    const health: PipelineHealth = {
      atRisk: atRiskContacts.size,
      stale: staleContacts.size,
      noOwner,
      noNextAction,
      totalActive: activeContacts.length,
      totalValue,
      avgDaysInStage,
      conversionRate,
      coachingTips,
    };

    return NextResponse.json(health);
  } catch (error: any) {
    console.error('Error in pipeline health:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
