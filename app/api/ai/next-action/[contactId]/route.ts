import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { suggestNextAction } from '@/lib/ai/next-action-engine';
import { analyzeContact } from '@/lib/ai/rules-engine';
import { ContactForAnalysis } from '@/lib/ai/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const admin = getAdminClient();

    // Fetch contact
    const { data: contact, error: contactError } = await admin
      .from('contacts')
      .select('id, name, status, temperatura, origem, proxima_acao_tipo, proxima_acao_data, valor_estimado, assigned_to_user_id, created_at, updated_at, company')
      .eq('id', contactId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    // Fetch interactions
    const { data: interactions } = await admin
      .from('interactions')
      .select('type, outcome, happened_at, created_at')
      .eq('contact_id', contactId)
      .eq('organization_id', profile.organization_id)
      .order('happened_at', { ascending: false })
      .limit(10);

    const contactForAnalysis: ContactForAnalysis = {
      ...contact,
      interactions: interactions || [],
    };

    // Get risks and next action
    const risks = analyzeContact(contactForAnalysis);
    const nextAction = suggestNextAction(contactForAnalysis);

    return NextResponse.json({
      risks,
      nextAction,
      contact: {
        id: contact.id,
        name: contact.name,
        status: contact.status,
        daysInStage: Math.floor((Date.now() - new Date(contact.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
        interactionCount: (interactions || []).length,
        lastInteraction: interactions?.[0] || null,
      },
    });
  } catch (error: any) {
    console.error('Error in next action:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
