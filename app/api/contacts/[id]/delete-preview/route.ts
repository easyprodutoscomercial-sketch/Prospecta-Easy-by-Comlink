import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/contacts/[id]/delete-preview
// Conta os registros que v\u00e3o cair em cascata ao apagar um contato.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();

    const { data: contact } = await admin
      .from('contacts')
      .select('id, name, valor_estimado')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!contact) {
      return NextResponse.json({ error: 'Contato nao encontrado' }, { status: 404 });
    }

    const [intR, meetR, attR, notifR, scoreR] = await Promise.all([
      admin.from('interactions').select('id', { count: 'exact', head: true }).eq('contact_id', id),
      admin.from('meetings').select('id', { count: 'exact', head: true }).eq('contact_id', id),
      admin.from('contact_attachments').select('id', { count: 'exact', head: true }).eq('contact_id', id),
      admin.from('notifications').select('id', { count: 'exact', head: true }).eq('contact_id', id),
      admin.from('lead_score_history').select('id', { count: 'exact', head: true }).eq('contact_id', id),
    ]);

    return NextResponse.json({
      contact_id: contact.id,
      contact_name: contact.name,
      counts: {
        interactions: intR.count || 0,
        meetings: meetR.count || 0,
        attachments: attR.count || 0,
        notifications: notifR.count || 0,
        score_history: scoreR.count || 0,
        valor_estimado: Number(contact.valor_estimado) || 0,
      },
    });
  } catch (error: any) {
    console.error('[delete-preview contact] error:', error);
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
