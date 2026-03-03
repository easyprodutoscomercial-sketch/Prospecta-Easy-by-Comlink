import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { computeLeadScoreDetailed } from '@/lib/utils/lead-score';

// GET /api/contacts/:id/score - Get lead score + breakdown + history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();

    // Fetch contact + interactions
    const [contactRes, interactionsRes, historyRes] = await Promise.all([
      admin.from('contacts').select('*').eq('id', id).single(),
      admin.from('interactions').select('outcome, happened_at').eq('contact_id', id).order('happened_at', { ascending: false }).limit(50),
      admin.from('lead_score_history').select('score, breakdown, scored_at').eq('contact_id', id).order('scored_at', { ascending: false }).limit(10),
    ]);

    if (contactRes.error || !contactRes.data) {
      return NextResponse.json({ error: 'Contato nao encontrado' }, { status: 404 });
    }

    const contact = contactRes.data;
    const interactions = interactionsRes.data || [];
    const history = historyRes.data || [];

    const detailed = computeLeadScoreDetailed({
      ...contact,
      interactions,
    });

    // Calculate weekly trend
    let weeklyDelta = 0;
    if (history.length >= 2) {
      weeklyDelta = history[0].score - history[1].score;
    }

    return NextResponse.json({
      score: detailed.total,
      breakdown: detailed.breakdown,
      history,
      weeklyDelta,
    });
  } catch (error: any) {
    console.error('Error fetching lead score:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
