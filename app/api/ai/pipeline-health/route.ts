import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { analyzeContacts, ACTIVE_STATUSES } from '@/lib/ai/rules-engine';
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

    // Fetch active contacts
    const { data: contacts, error: contactsError } = await admin
      .from('contacts')
      .select('id, name, status, temperatura, origem, proxima_acao_tipo, proxima_acao_data, valor_estimado, assigned_to_user_id, created_at, updated_at, company')
      .eq('organization_id', orgId)
      .in('status', ACTIVE_STATUSES);

    if (contactsError) throw contactsError;

    const activeContacts = contacts || [];

    // Fetch interactions
    const contactIds = activeContacts.map((c) => c.id);
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

    const contactsForAnalysis: ContactForAnalysis[] = activeContacts.map((c) => ({
      ...c,
      interactions: (interactionsByContact.get(c.id) || []).slice(0, 10),
    }));

    // Run rules engine
    const alerts = analyzeContacts(contactsForAnalysis);

    // Compute metrics
    const now = new Date();
    const byStage: Record<string, number> = {};
    const daysInStageSum: Record<string, number> = {};
    const daysInStageCount: Record<string, number> = {};
    let noOwner = 0;
    let noNextAction = 0;

    for (const c of activeContacts) {
      byStage[c.status] = (byStage[c.status] || 0) + 1;

      const days = Math.floor((now.getTime() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      daysInStageSum[c.status] = (daysInStageSum[c.status] || 0) + days;
      daysInStageCount[c.status] = (daysInStageCount[c.status] || 0) + 1;

      if (!c.assigned_to_user_id) noOwner++;
      if (!c.proxima_acao_tipo && !c.proxima_acao_data) noNextAction++;
    }

    const avgDaysInStage: Record<string, number> = {};
    for (const [stage, sum] of Object.entries(daysInStageSum)) {
      avgDaysInStage[stage] = Math.round(sum / (daysInStageCount[stage] || 1));
    }

    // Get conversion stats (all time)
    const { count: totalConverted } = await admin
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'CONVERTIDO');

    const { count: totalAll } = await admin
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    const conversionRate = totalAll && totalAll > 0
      ? Math.round(((totalConverted || 0) / totalAll) * 100)
      : 0;

    const totalValue = activeContacts.reduce((sum, c) => sum + (c.valor_estimado || 0), 0);

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
