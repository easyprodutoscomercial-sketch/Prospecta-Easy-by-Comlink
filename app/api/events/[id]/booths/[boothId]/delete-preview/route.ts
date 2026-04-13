import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/events/[id]/booths/[boothId]/delete-preview
// Conta os registros que v\u00e3o cair em cascata ao apagar um stand.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; boothId: string }> }
) {
  try {
    const { id: eventId, boothId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();

    const { data: booth } = await admin
      .from('event_booths')
      .select('id, company_name, booth_number, status')
      .eq('id', boothId)
      .eq('event_id', eventId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!booth) {
      return NextResponse.json({ error: 'Stand nao encontrado' }, { status: 404 });
    }

    // Visitas do stand (essas caem no cascade)
    const { count: visitsCount } = await admin
      .from('booth_visits')
      .select('id', { count: 'exact', head: true })
      .eq('booth_id', boothId)
      .eq('organization_id', profile.organization_id);

    return NextResponse.json({
      booth_id: booth.id,
      company_name: booth.company_name,
      booth_number: booth.booth_number,
      status: booth.status,
      counts: {
        visits: visitsCount || 0,
      },
    });
  } catch (error: any) {
    console.error('[delete-preview booth] error:', error);
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
