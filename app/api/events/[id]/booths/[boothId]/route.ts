import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// PATCH /api/events/[id]/booths/[boothId] — update booth position on map
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; boothId: string }> }
) {
  try {
    const { id, boothId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const body = await request.json();
    const updates: { position_x?: number | null; position_y?: number | null } = {};

    const validatePct = (v: any): number | null | undefined => {
      if (v === null) return null;
      if (v === undefined) return undefined;
      const n = Number(v);
      if (!Number.isFinite(n)) return undefined;
      if (n < 0 || n > 100) return undefined;
      return n;
    };

    if ('position_x' in body) {
      const x = validatePct(body.position_x);
      if (x === undefined && body.position_x !== undefined) {
        return NextResponse.json({ error: 'position_x inválido (esperado 0..100 ou null)' }, { status: 400 });
      }
      updates.position_x = x as number | null;
    }
    if ('position_y' in body) {
      const y = validatePct(body.position_y);
      if (y === undefined && body.position_y !== undefined) {
        return NextResponse.json({ error: 'position_y inválido (esperado 0..100 ou null)' }, { status: 400 });
      }
      updates.position_y = y as number | null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: booth, error } = await admin
      .from('event_booths')
      .update(updates)
      .eq('id', boothId)
      .eq('event_id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error || !booth) {
      return NextResponse.json({ error: error?.message || 'Stand não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ booth });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao atualizar posição do stand' }, { status: 500 });
  }
}

// DELETE /api/events/[id]/booths/[boothId] — delete a booth and its visits
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; boothId: string }> }
) {
  try {
    const { id, boothId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const admin = getAdminClient();

    // Verify booth belongs to this event and org
    const { data: booth } = await admin
      .from('event_booths')
      .select('id')
      .eq('id', boothId)
      .eq('event_id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!booth) {
      return NextResponse.json({ error: 'Stand não encontrado' }, { status: 404 });
    }

    // Delete visits first (cascade should handle, but be explicit)
    await admin
      .from('booth_visits')
      .delete()
      .eq('booth_id', boothId);

    // Delete booth
    const { error } = await admin
      .from('event_booths')
      .delete()
      .eq('id', boothId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao deletar stand' }, { status: 500 });
  }
}
