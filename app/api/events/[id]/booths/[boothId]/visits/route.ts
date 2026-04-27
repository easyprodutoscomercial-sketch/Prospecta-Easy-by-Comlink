import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/events/[id]/booths/[boothId]/visits
// Retorna TODAS as visits do stand (de todos os vendedores), pra somar
// fotos, contatos e historico no detalhe do stand.
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
    const { data: visits, error } = await admin
      .from('booth_visits')
      .select('id, user_id, user_name, contact_id, contact_name, contact_role, prospect_type, photo_facade_url, photo_contact_url, notes, visited_at, created_at')
      .eq('event_id', eventId)
      .eq('booth_id', boothId)
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ visits: visits || [] });
  } catch (error: any) {
    console.error('Error listing booth visits:', error);
    return NextResponse.json({ error: error.message || 'Erro ao buscar visitas' }, { status: 500 });
  }
}
