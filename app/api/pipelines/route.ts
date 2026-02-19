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

    const { data: pipelines, error } = await admin
      .from('pipelines')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('position', { ascending: true });

    if (error) throw error;

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

    // Criar pipeline
    const { data: pipeline, error: pipError } = await admin
      .from('pipelines')
      .insert({
        organization_id: profile.organization_id,
        name: validated.name,
        description: validated.description || null,
        pipeline_type: validated.pipeline_type || 'PADRAO',
        is_default: isDefault,
        position: nextPosition,
      })
      .select()
      .single();

    if (pipError) throw pipError;

    // Criar stages
    const stagesToInsert = validated.stages.map((s, i) => {
      const stageRow: Record<string, any> = {
        pipeline_id: pipeline.id,
        name: s.name,
        slug: s.slug,
        color: s.color || '#a3a3a3',
        position: s.position ?? i,
        is_terminal: s.is_terminal || false,
        terminal_type: s.terminal_type || null,
        allow_meeting: s.allow_meeting || false,
      };
      if (s.icon) stageRow.icon = s.icon;
      return stageRow;
    });

    let stages: any[] = [];
    const { data: stagesData, error: stagesError } = await admin
      .from('pipeline_stages')
      .insert(stagesToInsert)
      .select();

    if (stagesError) {
      // Retry without optional columns (allow_meeting, icon) if they don't exist yet
      console.warn('Stages insert failed, retrying without optional cols:', stagesError.message);
      const safeStagesToInsert = stagesToInsert.map(({ allow_meeting, icon, ...rest }) => rest);
      const { data: retryData, error: retryErr } = await admin
        .from('pipeline_stages')
        .insert(safeStagesToInsert)
        .select();
      if (retryErr) throw retryErr;
      stages = retryData || [];
    } else {
      stages = stagesData || [];
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
