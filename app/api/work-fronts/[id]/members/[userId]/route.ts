import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/work-fronts/:id/members/:userId - Remover membro da frente
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id, userId } = await params;
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

    // Verificar que a work front pertence a org
    const { data: workFront } = await admin
      .from('work_fronts')
      .select('id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!workFront) {
      return NextResponse.json({ error: 'Frente de trabalho nao encontrada' }, { status: 404 });
    }

    // Remover membro
    const { error } = await admin
      .from('work_front_members')
      .delete()
      .eq('work_front_id', id)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing member from work front:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao remover membro' },
      { status: 500 }
    );
  }
}
