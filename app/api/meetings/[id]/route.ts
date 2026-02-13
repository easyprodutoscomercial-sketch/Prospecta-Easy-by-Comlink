import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/meetings/[id]
export async function GET(
  request: NextRequest,
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

    const { data, error } = await admin
      .from('meetings')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Reuniao nao encontrada' }, { status: 404 });
    }

    return NextResponse.json({ meeting: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/meetings/[id]
export async function PATCH(
  request: NextRequest,
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
    const body = await request.json();

    // Verificar se a reuniao pertence a org
    const { data: existing } = await admin
      .from('meetings')
      .select('id, organization_id, created_by_user_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Reuniao nao encontrada' }, { status: 404 });
    }

    // Apenas o criador ou admin pode editar
    if (existing.created_by_user_id !== user.id && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas quem criou a reuniao ou um admin pode edita-la' }, { status: 403 });
    }

    const allowedFields = ['title', 'notes', 'location', 'meeting_at', 'duration_minutes', 'status'];
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    const { data, error } = await admin
      .from('meetings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Se cancelou, dispensar notificacoes pendentes
    if (body.status === 'CANCELLED') {
      await admin
        .from('notifications')
        .update({ dismissed: true })
        .eq('type', 'MEETING_REMINDER')
        .eq('read', false)
        .containedBy('metadata', { meeting_id: id } as any);

      // Fallback: buscar por metadata->meeting_id
      const { data: pendingNotifs } = await admin
        .from('notifications')
        .select('id')
        .eq('type', 'MEETING_REMINDER')
        .eq('dismissed', false)
        .filter('metadata->>meeting_id', 'eq', id);

      if (pendingNotifs && pendingNotifs.length > 0) {
        const ids = pendingNotifs.map(n => n.id);
        await admin
          .from('notifications')
          .update({ dismissed: true })
          .in('id', ids);
      }
    }

    return NextResponse.json({ meeting: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/meetings/[id]
export async function DELETE(
  request: NextRequest,
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

    // Verificar se a reuniao pertence a org
    const { data: existing } = await admin
      .from('meetings')
      .select('id, organization_id, created_by_user_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Reuniao nao encontrada' }, { status: 404 });
    }

    // Apenas o criador ou admin pode deletar
    if (existing.created_by_user_id !== user.id && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas quem criou a reuniao ou um admin pode exclui-la' }, { status: 403 });
    }

    // Dispensar notificacoes associadas
    const { data: pendingNotifs } = await admin
      .from('notifications')
      .select('id')
      .eq('type', 'MEETING_REMINDER')
      .filter('metadata->>meeting_id', 'eq', id);

    if (pendingNotifs && pendingNotifs.length > 0) {
      const ids = pendingNotifs.map(n => n.id);
      await admin
        .from('notifications')
        .update({ dismissed: true })
        .in('id', ids);
    }

    // Deletar reuniao
    const { error } = await admin
      .from('meetings')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
