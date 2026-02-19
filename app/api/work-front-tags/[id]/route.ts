import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/work-front-tags/:id - Excluir tag
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

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);

    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    // Verificar que a tag pertence a org
    const { data: tag } = await admin
      .from('work_front_tags')
      .select('id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!tag) {
      return NextResponse.json({ error: 'Tag nao encontrada' }, { status: 404 });
    }

    const { error } = await admin
      .from('work_front_tags')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting work front tag:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao excluir tag' },
      { status: 500 }
    );
  }
}
