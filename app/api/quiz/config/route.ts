import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/quiz/config — Full config for admin (auth required)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();
    const orgId = profile.organization_id;

    // Get or create config for this org
    let { data: config, error } = await admin
      .from('quiz_configuracoes')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!config) {
      // Auto-create default config
      const { data: newConfig, error: createError } = await admin
        .from('quiz_configuracoes')
        .insert({ organization_id: orgId })
        .select('*')
        .single();

      if (createError) {
        console.error('Error creating quiz config:', createError);
        return NextResponse.json({ error: 'Erro ao criar configuração' }, { status: 500 });
      }
      config = newConfig;
    }

    // Fetch pipelines for the selector
    const { data: pipelines } = await admin
      .from('pipelines')
      .select('id, name')
      .eq('organization_id', orgId)
      .order('position', { ascending: true });

    return NextResponse.json({ config, pipelines: pipelines || [] });
  } catch (error: any) {
    console.error('Error fetching quiz config:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

// PUT /api/quiz/config — Update config (auth required)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();
    const orgId = profile.organization_id;
    const body = await request.json();

    const allowedFields = [
      'quiz_ativo', 'valor_exato', 'nome_evento', 'descricao_desafio',
      'mensagem_pausa', 'pipeline_id', 'crm_tag', 'crm_ativo',
    ];

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data: config, error } = await admin
      .from('quiz_configuracoes')
      .update(updateData)
      .eq('organization_id', orgId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating quiz config:', error);
      return NextResponse.json({ error: 'Erro ao atualizar configuração' }, { status: 500 });
    }

    return NextResponse.json({ config });
  } catch (error: any) {
    console.error('Error updating quiz config:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
