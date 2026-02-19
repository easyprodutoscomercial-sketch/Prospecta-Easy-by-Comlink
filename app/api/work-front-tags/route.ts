import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { workFrontTagSchema } from '@/lib/utils/validation';

// GET /api/work-front-tags - Listar tags da organizacao
export async function GET(request: NextRequest) {
  try {
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

    const { data: tags, error } = await admin
      .from('work_front_tags')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ tags: tags || [] });
  } catch (error: any) {
    console.error('Error listing work front tags:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar tags' },
      { status: 500 }
    );
  }
}

// POST /api/work-front-tags - Criar tag
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const validated = workFrontTagSchema.parse(body);

    const { data: tag, error } = await admin
      .from('work_front_tags')
      .insert({
        organization_id: profile.organization_id,
        ...validated,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(tag, { status: 201 });
  } catch (error: any) {
    console.error('Error creating work front tag:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao criar tag' },
      { status: 500 }
    );
  }
}
