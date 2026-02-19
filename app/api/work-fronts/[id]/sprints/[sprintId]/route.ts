import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { workFrontSprintSchema } from '@/lib/utils/validation';

// PATCH /api/work-fronts/:id/sprints/:sprintId - Atualizar sprint
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  try {
    const { id, sprintId } = await params;
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

    // Verificar que o sprint pertence a esta work front
    const { data: existingSprint } = await admin
      .from('work_front_sprints')
      .select('id')
      .eq('id', sprintId)
      .eq('work_front_id', id)
      .single();

    if (!existingSprint) {
      return NextResponse.json({ error: 'Sprint nao encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validated = workFrontSprintSchema.partial().parse(body);

    const { data: sprint, error } = await admin
      .from('work_front_sprints')
      .update(validated)
      .eq('id', sprintId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(sprint);
  } catch (error: any) {
    console.error('Error updating sprint:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar sprint' },
      { status: 500 }
    );
  }
}

// DELETE /api/work-fronts/:id/sprints/:sprintId - Excluir sprint
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  try {
    const { id, sprintId } = await params;
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

    // Verificar que o sprint pertence a esta work front
    const { data: existingSprint } = await admin
      .from('work_front_sprints')
      .select('id')
      .eq('id', sprintId)
      .eq('work_front_id', id)
      .single();

    if (!existingSprint) {
      return NextResponse.json({ error: 'Sprint nao encontrado' }, { status: 404 });
    }

    const { error } = await admin
      .from('work_front_sprints')
      .delete()
      .eq('id', sprintId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting sprint:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao excluir sprint' },
      { status: 500 }
    );
  }
}
