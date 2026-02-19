import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { workFrontSchema } from '@/lib/utils/validation';

// GET /api/work-fronts/:id - Detalhe da frente com membros, sprints e bugs
export async function GET(
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

    // Buscar work front
    const { data: workFront, error } = await admin
      .from('work_fronts')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !workFront) {
      return NextResponse.json({ error: 'Frente de trabalho nao encontrada' }, { status: 404 });
    }

    // Buscar membros
    const { data: rawMembers } = await admin
      .from('work_front_members')
      .select('*')
      .eq('work_front_id', id);

    // Enriquecer membros com dados do profile
    const memberUserIds = (rawMembers || []).map((m: any) => m.user_id);
    let profilesMap: Record<string, any> = {};
    if (memberUserIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('user_id, name, email, avatar_url')
        .in('user_id', memberUserIds);
      (profiles || []).forEach((p: any) => {
        profilesMap[p.user_id] = p;
      });
    }
    const members = (rawMembers || []).map((m: any) => ({
      ...m,
      user_name: profilesMap[m.user_id]?.name || null,
      user_email: profilesMap[m.user_id]?.email || null,
      avatar_url: profilesMap[m.user_id]?.avatar_url || null,
    }));

    // Buscar sprints
    const { data: sprints } = await admin
      .from('work_front_sprints')
      .select('*')
      .eq('work_front_id', id)
      .order('starts_at', { ascending: false });

    // Contar bugs
    const { count: bugCount } = await admin
      .from('bug_reports')
      .select('id', { count: 'exact', head: true })
      .eq('work_front_id', id);

    return NextResponse.json({
      work_front: workFront,
      members: members || [],
      sprints: sprints || [],
      bug_count: bugCount || 0,
    });
  } catch (error: any) {
    console.error('Error fetching work front:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar frente de trabalho' },
      { status: 500 }
    );
  }
}

// PATCH /api/work-fronts/:id - Atualizar frente de trabalho
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

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);

    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    // Verificar que pertence a org
    const { data: existing } = await admin
      .from('work_fronts')
      .select('id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Frente de trabalho nao encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const validated = workFrontSchema.partial().parse(body);

    const { data: workFront, error } = await admin
      .from('work_fronts')
      .update(validated)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(workFront);
  } catch (error: any) {
    console.error('Error updating work front:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar frente de trabalho' },
      { status: 500 }
    );
  }
}

// DELETE /api/work-fronts/:id - Excluir frente de trabalho
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

    // Verificar que pertence a org
    const { data: existing } = await admin
      .from('work_fronts')
      .select('id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Frente de trabalho nao encontrada' }, { status: 404 });
    }

    // Deletar (cascades para members, sprints, etc.)
    const { error } = await admin
      .from('work_fronts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting work front:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao excluir frente de trabalho' },
      { status: 500 }
    );
  }
}
