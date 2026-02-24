import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/focus/queue - Fila priorizada de contatos para Focus Mode / Power Dialer
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
    const searchParams = request.nextUrl.searchParams;
    const pipelineId = searchParams.get('pipeline_id');

    if (!pipelineId) {
      return NextResponse.json(
        { error: 'pipeline_id é obrigatório' },
        { status: 400 }
      );
    }

    // 1. Buscar stages não-terminais do pipeline
    const { data: nonTerminalStages, error: stagesError } = await admin
      .from('pipeline_stages')
      .select('id')
      .eq('pipeline_id', pipelineId)
      .eq('is_terminal', false);

    if (stagesError) throw stagesError;

    const nonTerminalStageIds = (nonTerminalStages || []).map((s: any) => s.id);

    if (nonTerminalStageIds.length === 0) {
      return NextResponse.json({ contacts: [] });
    }

    // 2. Buscar contatos com telefone, em stages não-terminais
    //    Usamos três queries separadas para montar a fila priorizada:
    //
    //    Prioridade 1: proxima_acao_tipo = 'LIGAR' e proxima_acao_data <= agora
    //    Prioridade 2: temperatura = 'FRIO'
    //    Prioridade 3: demais contatos (ordenados por updated_at ASC, os mais antigos primeiro)

    const now = new Date().toISOString();

    const baseFilter = (query: any) => {
      return query
        .eq('organization_id', profile.organization_id)
        .in('stage_id', nonTerminalStageIds)
        .not('phone', 'is', null)
        .neq('phone', '');
    };

    // Prioridade 1 — Ação "LIGAR" pendente (vencida ou no momento)
    const { data: priority1, error: p1Error } = await baseFilter(
      admin.from('contacts').select('*')
    )
      .eq('proxima_acao_tipo', 'LIGAR')
      .lte('proxima_acao_data', now)
      .order('proxima_acao_data', { ascending: true })
      .limit(50);

    if (p1Error) throw p1Error;

    const p1Ids = new Set((priority1 || []).map((c: any) => c.id));
    const remaining1 = 50 - (priority1 || []).length;

    // Prioridade 2 — Temperatura FRIO (excluindo já incluídos)
    let priority2: any[] = [];
    if (remaining1 > 0) {
      const { data, error: p2Error } = await baseFilter(
        admin.from('contacts').select('*')
      )
        .eq('temperatura', 'FRIO')
        .order('updated_at', { ascending: true })
        .limit(remaining1 + p1Ids.size);

      if (p2Error) throw p2Error;

      priority2 = (data || []).filter((c: any) => !p1Ids.has(c.id)).slice(0, remaining1);
    }

    const p2Ids = new Set(priority2.map((c: any) => c.id));
    const remaining2 = 50 - (priority1 || []).length - priority2.length;

    // Prioridade 3 — Restante por updated_at mais antigo (sem interações recentes)
    let priority3: any[] = [];
    if (remaining2 > 0) {
      const { data, error: p3Error } = await baseFilter(
        admin.from('contacts').select('*')
      )
        .order('updated_at', { ascending: true })
        .limit(remaining2 + p1Ids.size + p2Ids.size);

      if (p3Error) throw p3Error;

      priority3 = (data || [])
        .filter((c: any) => !p1Ids.has(c.id) && !p2Ids.has(c.id))
        .slice(0, remaining2);
    }

    const contacts = [...(priority1 || []), ...priority2, ...priority3];

    return NextResponse.json({ contacts });
  } catch (error: any) {
    console.error('Error fetching focus queue:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar fila de foco' },
      { status: 500 }
    );
  }
}
