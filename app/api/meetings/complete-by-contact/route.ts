import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// POST /api/meetings/complete-by-contact
// Marca todas as reunioes SCHEDULED de um contato como COMPLETED
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const body = await request.json();
    const { contact_id } = body;

    if (!contact_id) {
      return NextResponse.json({ error: 'contact_id e obrigatorio' }, { status: 400 });
    }

    const admin = getAdminClient();

    // Verificar se o contato pertence a organizacao
    const { data: contact } = await admin
      .from('contacts')
      .select('id')
      .eq('id', contact_id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!contact) {
      return NextResponse.json({ error: 'Contato nao encontrado' }, { status: 404 });
    }

    // Buscar reunioes SCHEDULED deste contato
    const { data: meetings } = await admin
      .from('meetings')
      .select('id')
      .eq('contact_id', contact_id)
      .eq('organization_id', profile.organization_id)
      .eq('status', 'SCHEDULED');

    if (!meetings || meetings.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const meetingIds = meetings.map(m => m.id);

    // Atualizar para COMPLETED
    const { error: updateError } = await admin
      .from('meetings')
      .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
      .in('id', meetingIds);

    if (updateError) {
      console.error('Error completing meetings:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Dispensar notificacoes pendentes dessas reunioes
    for (const meetingId of meetingIds) {
      const { data: pendingNotifs } = await admin
        .from('notifications')
        .select('id')
        .eq('type', 'MEETING_REMINDER')
        .eq('dismissed', false)
        .filter('metadata->>meeting_id', 'eq', meetingId);

      if (pendingNotifs && pendingNotifs.length > 0) {
        const ids = pendingNotifs.map(n => n.id);
        await admin
          .from('notifications')
          .update({ dismissed: true })
          .in('id', ids);
      }
    }

    return NextResponse.json({ updated: meetingIds.length });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
