import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// PATCH /api/lead-capture-links/[id] - Ativar/desativar link
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();
    const body = await request.json();

    const { data: link, error } = await admin
      .from('lead_capture_links')
      .update({
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) throw error;
    if (!link) {
      return NextResponse.json({ error: 'Link nao encontrado' }, { status: 404 });
    }

    return NextResponse.json(link);
  } catch (error: any) {
    console.error('Error updating lead capture link:', error);
    return NextResponse.json({ error: error.message || 'Erro ao atualizar link' }, { status: 500 });
  }
}

// DELETE /api/lead-capture-links/[id] - Remover link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();

    const { error } = await admin
      .from('lead_capture_links')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('organization_id', profile.organization_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting lead capture link:', error);
    return NextResponse.json({ error: error.message || 'Erro ao excluir link' }, { status: 500 });
  }
}
