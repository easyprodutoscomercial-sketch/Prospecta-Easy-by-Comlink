import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/work-fronts/active - Obter frente de trabalho ativa do usuario
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

    // Buscar frente ativa do usuario
    const { data: activeRecord, error } = await admin
      .from('user_active_work_front')
      .select('*, work_front:work_fronts(*)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      active_work_front: activeRecord?.work_front || null,
      work_front_id: activeRecord?.work_front_id || null,
      record: activeRecord,
    });
  } catch (error: any) {
    console.error('Error fetching active work front:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar frente ativa' },
      { status: 500 }
    );
  }
}

// PUT /api/work-fronts/active - Definir frente de trabalho ativa
export async function PUT(request: NextRequest) {
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
    const { work_front_id } = body;

    if (!work_front_id) {
      return NextResponse.json(
        { error: 'work_front_id e obrigatorio' },
        { status: 400 }
      );
    }

    // Verificar que a work front pertence a org do usuario
    const { data: workFront, error: wfError } = await admin
      .from('work_fronts')
      .select('id')
      .eq('id', work_front_id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (wfError || !workFront) {
      return NextResponse.json(
        { error: 'Frente de trabalho nao encontrada' },
        { status: 404 }
      );
    }

    // Upsert: user_id e PK
    const { data: record, error } = await admin
      .from('user_active_work_front')
      .upsert(
        { user_id: user.id, work_front_id },
        { onConflict: 'user_id' }
      )
      .select('*, work_front:work_fronts(*)')
      .single();

    if (error) throw error;

    return NextResponse.json({
      active_work_front: record?.work_front || null,
      record,
    });
  } catch (error: any) {
    console.error('Error setting active work front:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao definir frente ativa' },
      { status: 500 }
    );
  }
}
