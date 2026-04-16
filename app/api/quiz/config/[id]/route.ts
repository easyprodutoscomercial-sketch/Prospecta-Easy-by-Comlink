import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/quiz/config/[id] — Delete quiz (admin only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem excluir quizzes' }, { status: 403 });
    }

    const admin = getAdminClient();

    // Verify the quiz belongs to this org
    const { data: quiz } = await admin
      .from('quiz_configuracoes')
      .select('id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz não encontrado' }, { status: 404 });
    }

    // Count participants before deleting
    const { count: deletedParticipants } = await admin
      .from('quiz_participantes')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_config_id', id);

    // Delete participants first (FK constraint)
    await admin
      .from('quiz_participantes')
      .delete()
      .eq('quiz_config_id', id);

    // Delete quiz config
    const { error } = await admin
      .from('quiz_configuracoes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting quiz:', error);
      return NextResponse.json({ error: 'Erro ao excluir quiz' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted_participants: deletedParticipants || 0,
    });
  } catch (error: any) {
    console.error('Error deleting quiz:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
