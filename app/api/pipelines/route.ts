import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { pipelineCreateSchema } from '@/lib/utils/validation';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/pipelines - Lista pipelines da org com stages
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();
    const typeFilter = request.nextUrl.searchParams.get('type');

    // Try with pipeline_type first; fall back to without if column doesn't exist
    let pipelines: any[] | null = null;
    let query = admin
      .from('pipelines')
      .select('*')
      .eq('organization_id', profile.organization_id);

    if (typeFilter) {
      query = query.eq('pipeline_type', typeFilter);
    }

    const { data: pipelinesData, error } = await query
      .order('position', { ascending: true });

    if (error && error.message?.includes('pipeline_type')) {
      // Column doesn't exist yet — select without it and default to PADRAO
      const { data: fallbackData, error: fallbackError } = await admin
        .from('pipelines')
        .select('id, organization_id, name, description, is_default, position, created_at, updated_at')
        .eq('organization_id', profile.organization_id)
        .order('position', { ascending: true });

      if (fallbackError) throw fallbackError;
      pipelines = (fallbackData || []).map((p: any) => ({ ...p, pipeline_type: 'PADRAO' }));
    } else if (error) {
      throw error;
    } else {
      pipelines = pipelinesData;
    }

    const pipelineIds = (pipelines || []).map((p: any) => p.id);

    let stages: any[] = [];
    let members: any[] = [];

    if (pipelineIds.length > 0) {
      const [stagesRes, membersRes] = await Promise.all([
        admin
          .from('pipeline_stages')
          .select('*')
          .in('pipeline_id', pipelineIds)
          .order('position', { ascending: true }),
        admin
          .from('pipeline_members')
          .select('*')
          .in('pipeline_id', pipelineIds),
      ]);

      if (stagesRes.error) throw stagesRes.error;
      stages = stagesRes.data || [];

      // pipeline_members table may not exist yet — treat error as empty
      if (!membersRes.error) {
        members = membersRes.data || [];
      }
    }

    // Montar resposta com stages e members embutidos
    let pipelinesWithStages = (pipelines || []).map((p: any) => ({
      ...p,
      stages: stages.filter((s: any) => s.pipeline_id === p.id),
      members: members.filter((m: any) => m.pipeline_id === p.id),
    }));

    // Se NAO e admin, filtrar apenas pipelines onde o usuario e membro
    if (profile.role !== 'admin' && members.length > 0) {
      pipelinesWithStages = pipelinesWithStages.filter((p: any) =>
        p.members.some((m: any) => m.user_id === user.id)
      );
    }

    return NextResponse.json({ pipelines: pipelinesWithStages });
  } catch (error: any) {
    console.error('Error listing pipelines:', error);
    return NextResponse.json({ error: error.message || 'Erro ao listar pipelines' }, { status: 500 });
  }
}

// POST /api/pipelines - Criar pipeline com stages (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem criar pipelines' }, { status: 403 });
    }

    const admin = getAdminClient();
    const body = await request.json();
    const validated = pipelineCreateSchema.parse(body);

    // Obter proxima posicao
    const { data: existing } = await admin
      .from('pipelines')
      .select('position')
      .eq('organization_id', profile.organization_id)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

    // Verificar se ja existe algum pipeline (se nao, este sera o default)
    const { count } = await admin
      .from('pipelines')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id);

    const isDefault = (count || 0) === 0;

    // Criar pipeline — try with pipeline_type, fall back without
    const insertData: Record<string, any> = {
      organization_id: profile.organization_id,
      name: validated.name,
      description: validated.description || null,
      pipeline_type: validated.pipeline_type || 'PADRAO',
      is_default: isDefault,
      position: nextPosition,
    };

    let pipeline: any;
    const { data: pipData, error: pipError } = await admin
      .from('pipelines')
      .insert(insertData)
      .select()
      .single();

    if (pipError && pipError.message?.includes('pipeline_type')) {
      // Column doesn't exist — insert without it
      delete insertData.pipeline_type;
      const { data: fallbackData, error: fallbackError } = await admin
        .from('pipelines')
        .insert(insertData)
        .select()
        .single();
      if (fallbackError) throw fallbackError;
      pipeline = { ...fallbackData, pipeline_type: 'PADRAO' };
    } else if (pipError) {
      throw pipError;
    } else {
      pipeline = pipData;
    }

    // Criar stages — campos basicos primeiro, depois opcionais individualmente
    const baseStagesToInsert = validated.stages.map((s, i) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      slug: s.slug,
      color: s.color || '#a3a3a3',
      position: s.position ?? i,
      is_terminal: s.is_terminal || false,
      terminal_type: s.terminal_type || null,
    }));

    const { data: stagesData, error: stagesError } = await admin
      .from('pipeline_stages')
      .insert(baseStagesToInsert)
      .select();

    if (stagesError) throw stagesError;
    const stages = stagesData || [];

    // Agora tentar salvar campos opcionais (icon, allow_meeting) individualmente por stage
    for (let i = 0; i < stages.length; i++) {
      const stageRow = stages[i];
      const original = validated.stages[i];
      if (!stageRow || !original) continue;

      const optionalUpdates: Record<string, any> = {};
      if (original.icon) optionalUpdates.icon = original.icon;
      if (original.allow_meeting) optionalUpdates.allow_meeting = true;

      if (Object.keys(optionalUpdates).length > 0) {
        // Tentar todos juntos primeiro
        const { error } = await admin.from('pipeline_stages').update(optionalUpdates).eq('id', stageRow.id);
        if (error) {
          // Se falhou, tentar cada campo individualmente
          for (const [field, value] of Object.entries(optionalUpdates)) {
            const { error: fieldErr } = await admin.from('pipeline_stages').update({ [field]: value }).eq('id', stageRow.id);
            if (fieldErr) console.warn(`[PIPELINE POST] Campo "${field}" nao salvou (${original.name}): ${fieldErr.message}`);
            else console.log(`[PIPELINE POST] Campo "${field}" = ${JSON.stringify(value)} salvo OK (${original.name})`);
          }
        }
      }
    }

    // Inserir membros do pipeline
    const memberUserIds = validated.member_user_ids && validated.member_user_ids.length > 0
      ? validated.member_user_ids
      : [user.id]; // Se nenhum membro enviado, inserir admin criador

    const membersToInsert = memberUserIds.map((uid) => ({
      pipeline_id: pipeline.id,
      user_id: uid,
    }));

    const { data: members } = await admin
      .from('pipeline_members')
      .insert(membersToInsert)
      .select();

    return NextResponse.json({ ...pipeline, stages: stages || [], members: members || [] }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating pipeline:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados invalidos', details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: error.message || 'Erro ao criar pipeline' }, { status: 500 });
  }
}
