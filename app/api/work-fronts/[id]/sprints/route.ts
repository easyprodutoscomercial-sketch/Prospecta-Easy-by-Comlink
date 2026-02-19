import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { workFrontSprintSchema } from '@/lib/utils/validation';

// GET /api/work-fronts/:id/sprints - Listar sprints da frente
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

    const { data: sprints, error } = await admin
      .from('work_front_sprints')
      .select('*')
      .eq('work_front_id', id)
      .order('starts_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ sprints: sprints || [] });
  } catch (error: any) {
    console.error('Error listing sprints:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar sprints' },
      { status: 500 }
    );
  }
}

// POST /api/work-fronts/:id/sprints - Criar sprint
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
    const validated = workFrontSprintSchema.parse(body);

    const { data: sprint, error } = await admin
      .from('work_front_sprints')
      .insert({
        work_front_id: id,
        ...validated,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(sprint, { status: 201 });
  } catch (error: any) {
    console.error('Error creating sprint:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao criar sprint' },
      { status: 500 }
    );
  }
}
