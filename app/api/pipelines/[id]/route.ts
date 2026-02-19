import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { pipelineUpdateSchema } from '@/lib/utils/validation';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/pipelines/:id - Detalhe de um pipeline
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

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();

    const { data: pipeline, error } = await admin
      .from('pipelines')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !pipeline) {
      return NextResponse.json({ error: 'Pipeline nao encontrado' }, { status: 404 });
    }

    const [stagesRes, membersRes] = await Promise.all([
      admin
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', id)
        .order('position', { ascending: true }),
      admin
        .from('pipeline_members')
        .select('*')
        .eq('pipeline_id', id),
    ]);

    return NextResponse.json({
      ...pipeline,
      stages: stagesRes.data || [],
      members: membersRes.error ? [] : (membersRes.data || []),
    });
  } catch (error: any) {
    console.error('Error fetching pipeline:', error);
    return NextResponse.json({ error: error.message || 'Erro ao buscar pipeline' }, { status: 500 });
  }
}

// PUT /api/pipelines/:id - Editar pipeline + stages (admin only)
export async function PUT(
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

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem editar pipelines' }, { status: 403 });
    }

    const admin = getAdminClient();

    // Verificar que o pipeline pertence a org
    const { data: existing } = await admin
      .from('pipelines')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Pipeline nao encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validated = pipelineUpdateSchema.parse(body);

    // Atualizar pipeline
    const updateData: Record<string, any> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.pipeline_type !== undefined) updateData.pipeline_type = validated.pipeline_type;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await admin
        .from('pipelines')
        .update(updateData)
        .eq('id', id);
      if (updateError) throw updateError;
    }

    // Se stages foram enviados, sincronizar
    if (validated.stages) {
      // Buscar stages atuais
      const { data: currentStages } = await admin
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', id);

      const currentIds = new Set((currentStages || []).map((s: any) => s.id));
      const newIds = new Set(validated.stages.filter(s => s.id).map(s => s.id));

      // Stages a deletar (existem no banco mas nao no payload)
      const toDelete = [...currentIds].filter(sid => !newIds.has(sid));

      // Verificar se algum stage a deletar tem contatos
      if (toDelete.length > 0) {
        const { count: contactCount } = await admin
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .in('stage_id', toDelete);

        if (contactCount && contactCount > 0) {
          return NextResponse.json(
            { error: `Nao e possivel remover stages com contatos vinculados (${contactCount} contatos)` },
            { status: 409 }
          );
        }

        await admin.from('pipeline_stages').delete().in('id', toDelete);
      }

      // Upsert stages (update existentes, insert novos)
      for (const stage of validated.stages) {
        if (stage.id && currentIds.has(stage.id)) {
          // Update
          await admin
            .from('pipeline_stages')
            .update({
              name: stage.name,
              slug: stage.slug,
              color: stage.color || '#a3a3a3',
              position: stage.position,
              is_terminal: stage.is_terminal || false,
              terminal_type: stage.terminal_type || null,
            })
            .eq('id', stage.id);
        } else {
          // Insert
          await admin
            .from('pipeline_stages')
            .insert({
              pipeline_id: id,
              name: stage.name,
              slug: stage.slug,
              color: stage.color || '#a3a3a3',
              position: stage.position,
              is_terminal: stage.is_terminal || false,
              terminal_type: stage.terminal_type || null,
            });
        }
      }
    }

    // Sync membros se member_user_ids foi enviado
    if (validated.member_user_ids !== undefined) {
      // Deletar membros atuais
      await admin
        .from('pipeline_members')
        .delete()
        .eq('pipeline_id', id);

      // Inserir novos membros
      if (validated.member_user_ids.length > 0) {
        const membersToInsert = validated.member_user_ids.map((uid: string) => ({
          pipeline_id: id,
          user_id: uid,
        }));

        await admin
          .from('pipeline_members')
          .insert(membersToInsert);
      }
    }

    // Retornar pipeline atualizado com stages e members
    const { data: pipeline } = await admin
      .from('pipelines')
      .select('*')
      .eq('id', id)
      .single();

    const [stagesRes, membersRes] = await Promise.all([
      admin
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', id)
        .order('position', { ascending: true }),
      admin
        .from('pipeline_members')
        .select('*')
        .eq('pipeline_id', id),
    ]);

    return NextResponse.json({
      ...pipeline,
      stages: stagesRes.data || [],
      members: membersRes.data || [],
    });
  } catch (error: any) {
    console.error('Error updating pipeline:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados invalidos', details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: error.message || 'Erro ao atualizar pipeline' }, { status: 500 });
  }
}

// DELETE /api/pipelines/:id - Excluir pipeline (admin only, se sem contatos)
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

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem excluir pipelines' }, { status: 403 });
    }

    const admin = getAdminClient();

    // Verificar que pipeline pertence a org
    const { data: pipeline } = await admin
      .from('pipelines')
      .select('id, is_default, organization_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline nao encontrado' }, { status: 404 });
    }

    // Nao pode deletar pipeline default
    if (pipeline.is_default) {
      return NextResponse.json({ error: 'Nao e possivel excluir o pipeline padrao' }, { status: 409 });
    }

    // Verificar se tem contatos
    const { count } = await admin
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('pipeline_id', id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Nao e possivel excluir pipeline com ${count} contatos vinculados. Mova os contatos antes.` },
        { status: 409 }
      );
    }

    // Deletar stages e members primeiro (cascade deveria fazer, mas por seguranca)
    await admin.from('pipeline_members').delete().eq('pipeline_id', id);
    await admin.from('pipeline_stages').delete().eq('pipeline_id', id);

    // Deletar pipeline
    const { error } = await admin.from('pipelines').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting pipeline:', error);
    return NextResponse.json({ error: error.message || 'Erro ao excluir pipeline' }, { status: 500 });
  }
}
