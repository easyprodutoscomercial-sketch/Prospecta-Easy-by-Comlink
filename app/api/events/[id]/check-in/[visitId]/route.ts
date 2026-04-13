import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// DELETE /api/events/[id]/check-in/[visitId] — delete a visit
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; visitId: string }> }
) {
  try {
    const { id, visitId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const admin = getAdminClient();

    // Get visit to find booth_id
    const { data: visit } = await admin
      .from('booth_visits')
      .select('id, booth_id')
      .eq('id', visitId)
      .eq('event_id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!visit) {
      return NextResponse.json({ error: 'Visita não encontrada' }, { status: 404 });
    }

    // Delete the visit
    const { error } = await admin
      .from('booth_visits')
      .delete()
      .eq('id', visitId);

    if (error) throw error;

    // Check if booth has other visits; if not, set back to PENDENTE
    const { data: remaining } = await admin
      .from('booth_visits')
      .select('id')
      .eq('booth_id', visit.booth_id)
      .limit(1);

    if (!remaining || remaining.length === 0) {
      await admin
        .from('event_booths')
        .update({ status: 'PENDENTE' })
        .eq('id', visit.booth_id);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao deletar visita' }, { status: 500 });
  }
}
