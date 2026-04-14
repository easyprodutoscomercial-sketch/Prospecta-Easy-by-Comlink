import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// POST /api/contacts/draft
//
// Cria um contato em RASCUNHO (is_draft=true) assim que o vendedor clica
// "Contato Avulso" ou "Novo contato". Isso da um ID real no banco desde o
// primeiro clique, permitindo:
//   - ver rascunhos de qualquer dispositivo
//   - voltar e finalizar depois
//   - rastrear contatos que nunca terminaram de ser cadastrados
//
// O rascunho fica fora das listagens normais (contacts, kanban, relatorios,
// dedupe, lead score, notificacoes). So aparece na aba "Rascunhos".
//
// Body (opcional):
//   - event_id: uuid — se vier, valida que o evento esta ATIVO, seta
//     origem=FEIRA e usa pipeline/stage do evento.
//
// Retorna o contato criado com is_draft=true.
export async function POST(request: NextRequest) {
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
    const body = await request.json().catch(() => ({}));
    const eventId: string | null = body.event_id || null;

    let pipelineId: string | null = null;
    let stageId: string | null = null;
    let origem: string | null = null;

    if (eventId) {
      // Valida que o evento existe, pertence a org e esta ATIVO.
      const { data: event } = await admin
        .from('events')
        .select('pipeline_id, stage_id, status')
        .eq('id', eventId)
        .eq('organization_id', profile.organization_id)
        .single();

      if (!event) {
        return NextResponse.json({ error: 'Evento nao encontrado' }, { status: 404 });
      }

      if (event.status !== 'ATIVO') {
        return NextResponse.json(
          { error: 'Feira nao esta ativa. Peca ao admin para ativar antes de capturar contatos.' },
          { status: 403 }
        );
      }

      pipelineId = event.pipeline_id || null;
      stageId = event.stage_id || null;
      origem = 'FEIRA';
    } else {
      // Sem evento: usa o pipeline default da org.
      const { data: defaultPipeline } = await admin
        .from('pipelines')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .eq('is_default', true)
        .limit(1)
        .maybeSingle();

      if (defaultPipeline?.id) {
        pipelineId = defaultPipeline.id;
        const { data: firstStage } = await admin
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', pipelineId)
          .order('position', { ascending: true })
          .limit(1)
          .maybeSingle();
        stageId = firstStage?.id || null;
      }
    }

    // Nome placeholder — a validacao de "nome obrigatorio" so bate na
    // finalizacao (walk-in endpoint com contact_id), nao agora.
    const placeholderName = '(rascunho)';

    const { data: draft, error } = await admin
      .from('contacts')
      .insert({
        organization_id: profile.organization_id,
        name: placeholderName,
        name_normalized: placeholderName,
        is_draft: true,
        created_by_user_id: user.id,
        assigned_to_user_id: user.id,
        pipeline_id: pipelineId,
        stage_id: stageId,
        event_id: eventId,
        origem,
        status: 'NOVO',
        tipo: [],
      })
      .select()
      .single();

    if (error) {
      console.error('[API CONTACTS DRAFT] erro ao inserir:', error);
      return NextResponse.json(
        { error: error.message || 'Erro ao criar rascunho' },
        { status: 500 }
      );
    }

    return NextResponse.json(draft, { status: 201 });
  } catch (error: any) {
    console.error('[API CONTACTS DRAFT] erro inesperado:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar rascunho' },
      { status: 500 }
    );
  }
}
