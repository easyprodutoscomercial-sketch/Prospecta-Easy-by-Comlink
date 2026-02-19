import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/work-fronts/:id/members - Adicionar membro a frente
export async function POST(
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

    const body = await request.json();
    const { user_id, role } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id e obrigatorio' }, { status: 400 });
    }

    if (role && !['lead', 'member'].includes(role)) {
      return NextResponse.json({ error: 'role deve ser lead ou member' }, { status: 400 });
    }

    // Verificar se o usuario pertence a mesma org
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('user_id')
      .eq('user_id', user_id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: 'Usuario nao pertence a esta organizacao' }, { status: 400 });
    }

    // Inserir membro
    const { data: member, error } = await admin
      .from('work_front_members')
      .insert({
        work_front_id: id,
        user_id,
        role: role || 'member',
      })
      .select('*, profile:profiles(name, email, avatar_url)')
      .single();

    if (error) {
      // Duplicate key = membro ja existe
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Usuario ja e membro desta frente' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(member, { status: 201 });
  } catch (error: any) {
    console.error('Error adding member to work front:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao adicionar membro' },
      { status: 500 }
    );
  }
}
