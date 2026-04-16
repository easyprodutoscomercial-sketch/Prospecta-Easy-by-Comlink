import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/quiz/config — List all quizzes for this org (auth required)
// Optional ?id=xxx to get a single quiz config
export async function GET(request: NextRequest) {
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
    const singleId = request.nextUrl.searchParams.get('id');

    // Fetch pipelines for the selector
    const { data: pipelines } = await admin
      .from('pipelines')
      .select('id, name')
      .eq('organization_id', orgId)
      .order('position', { ascending: true });

    // Fetch events for the feira selector
    const { data: events } = await admin
      .from('events')
      .select('id, name, start_date, end_date, status, pipeline_id')
      .eq('organization_id', orgId)
      .in('status', ['ATIVO', 'RASCUNHO'])
      .order('start_date', { ascending: false });

    // Single quiz mode (for editing)
    if (singleId) {
      const { data: config } = await admin
        .from('quiz_configuracoes')
        .select('*')
        .eq('id', singleId)
        .eq('organization_id', orgId)
        .single();

      if (!config) {
        return NextResponse.json({ error: 'Quiz não encontrado' }, { status: 404 });
      }

      // Include linked event even if ENCERRADO
      let linkedEvent = null;
      if (config.event_id) {
        const alreadyIncluded = (events || []).some((e: any) => e.id === config.event_id);
        if (!alreadyIncluded) {
          const { data: ev } = await admin
            .from('events')
            .select('id, name, start_date, end_date, status, pipeline_id')
            .eq('id', config.event_id)
            .single();
          if (ev) linkedEvent = ev;
        }
      }

      return NextResponse.json({
        config,
        pipelines: pipelines || [],
        events: [...(events || []), ...(linkedEvent ? [linkedEvent] : [])],
      });
    }

    // List mode — all quizzes for this org
    const { data: quizzes } = await admin
      .from('quiz_configuracoes')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    // Count participants per quiz
    const quizzesWithCounts = await Promise.all(
      (quizzes || []).map(async (q: any) => {
        const { count } = await admin
          .from('quiz_participantes')
          .select('id', { count: 'exact', head: true })
          .eq('quiz_config_id', q.id);
        return { ...q, total_participantes: count || 0 };
      })
    );

    // Collect linked event IDs to fetch their names
    const linkedEventIds = (quizzes || [])
      .map((q: any) => q.event_id)
      .filter(Boolean);
    let linkedEvents: any[] = [];
    if (linkedEventIds.length > 0) {
      const { data } = await admin
        .from('events')
        .select('id, name, start_date, end_date, status')
        .in('id', linkedEventIds);
      linkedEvents = data || [];
    }

    return NextResponse.json({
      quizzes: quizzesWithCounts,
      pipelines: pipelines || [],
      events: [...(events || []), ...linkedEvents.filter(le => !(events || []).some((e: any) => e.id === le.id))],
    });
  } catch (error: any) {
    console.error('Error fetching quiz config:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

// POST /api/quiz/config — Create new quiz (auth required)
export async function POST(request: NextRequest) {
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

    const insertData: Record<string, any> = {
      organization_id: orgId,
    };

    // Optional fields from body
    const allowedFields = [
      'nome_evento', 'event_id', 'valor_exato', 'descricao_desafio',
      'mensagem_pausa', 'pipeline_id', 'crm_tag', 'telefone_vip',
      'data_inicio', 'dias_feira', 'dias_config',
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        insertData[field] = body[field];
      }
    }

    const { data: config, error } = await admin
      .from('quiz_configuracoes')
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating quiz:', error);
      return NextResponse.json({ error: 'Erro ao criar quiz' }, { status: 500 });
    }

    return NextResponse.json({ config }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating quiz:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

// PUT /api/quiz/config — Update config (auth required, requires ?id=xxx)
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
    const quizId = body.id;

    if (!quizId) {
      return NextResponse.json({ error: 'ID do quiz é obrigatório' }, { status: 400 });
    }

    const allowedFields = [
      'quiz_ativo', 'valor_exato', 'nome_evento', 'descricao_desafio',
      'mensagem_pausa', 'pipeline_id', 'crm_tag', 'crm_ativo',
      'telefone_vip', 'data_inicio', 'dias_feira', 'dias_config',
      'event_id',
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
      .eq('id', quizId)
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
