import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { computeLeadScoreDetailed } from '@/lib/utils/lead-score';

// POST /api/lead-scores/snapshot - Batch score all active contacts (admin only)
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas admins' }, { status: 403 });
    }

    const admin = getAdminClient();
    const orgId = profile.organization_id;

    // Fetch all active contacts
    const { data: contacts } = await admin
      .from('contacts')
      .select('*')
      .eq('organization_id', orgId)
      .in('status', ['NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA']);

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ scored: 0 });
    }

    // Fetch interactions for all contacts
    const contactIds = contacts.map((c) => c.id);
    const { data: interactions } = await admin
      .from('interactions')
      .select('contact_id, outcome, happened_at')
      .eq('organization_id', orgId)
      .in('contact_id', contactIds);

    const interactionsByContact = new Map<string, any[]>();
    for (const i of (interactions || [])) {
      const list = interactionsByContact.get(i.contact_id) || [];
      list.push(i);
      interactionsByContact.set(i.contact_id, list);
    }

    // Score each contact
    const historyRows: any[] = [];
    const updates: { id: string; lead_score: number }[] = [];

    for (const contact of contacts) {
      const detailed = computeLeadScoreDetailed({
        ...contact,
        interactions: interactionsByContact.get(contact.id) || [],
      });

      updates.push({ id: contact.id, lead_score: detailed.total });
      historyRows.push({
        organization_id: orgId,
        contact_id: contact.id,
        score: detailed.total,
        breakdown: detailed.breakdown,
      });
    }

    // Batch update contacts
    for (const u of updates) {
      await admin.from('contacts').update({ lead_score: u.lead_score }).eq('id', u.id);
    }

    // Insert history
    if (historyRows.length > 0) {
      await admin.from('lead_score_history').insert(historyRows);
    }

    return NextResponse.json({ scored: contacts.length });
  } catch (error: any) {
    console.error('Error in lead score snapshot:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
