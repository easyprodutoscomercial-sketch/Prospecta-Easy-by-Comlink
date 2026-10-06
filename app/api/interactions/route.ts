import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { interactionSchema } from '@/lib/utils/validation';
import { ensureProfile } from '@/lib/ensure-profile';
import { computeLeadScoreDetailed } from '@/lib/utils/lead-score';
import { exigeProximoPasso, CODIGO_PROXIMO_PASSO } from '@/lib/utils/proximo-passo';

// GET /api/interactions - Listar interações
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
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 5000);
    const contactId = url.searchParams.get('contact_id');

    let query = admin
      .from('interactions')
      .select('id, contact_id, type, outcome, note, happened_at, created_at, created_by_user_id, created_by_name')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    const { data: interactions, error } = await query;

    if (error) throw error;

    return NextResponse.json({ interactions: interactions || [] });
  } catch (error: any) {
    console.error('Error fetching interactions:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar interações' },
      { status: 500 }
    );
  }
}

// POST /api/interactions - Criar interação
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
    const body = await request.json();
    const validated = interactionSchema.parse(body);

    // Pegar contact para verificar organization_id e ownership
    const { data: contact } = await admin
      .from('contacts')
      .select('organization_id, status, assigned_to_user_id, proxima_acao_data')
      .eq('id', validated.contact_id)
      .single();

    if (!contact) {
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    // Ownership: só o responsável ou admin podem criar interações
    if (profile.role !== 'admin') {
      if (!contact.assigned_to_user_id) {
        return NextResponse.json({ error: 'Este contato não tem responsável. Aponte para você primeiro.' }, { status: 403 });
      }
      if (contact.assigned_to_user_id !== user.id) {
        return NextResponse.json({ error: 'Apenas o responsável ou admin pode registrar interações neste contato.' }, { status: 403 });
      }
    }

    // Regra do dono (06/10): atividade que nao encerra o negocio exige proximo passo (o que + quando).
    // Dispensa se o contato ja tem um proximo passo no futuro. Ver lib/utils/proximo-passo.ts.
    const informouProximo = !!(validated.proxima_acao_tipo && validated.proxima_acao_data);
    if (informouProximo && new Date(validated.proxima_acao_data as string).getTime() < Date.now() - 5 * 60_000) {
      return NextResponse.json({ error: 'A data do próximo passo precisa ser no futuro.', codigo: CODIGO_PROXIMO_PASSO }, { status: 422 });
    }
    const jaTemProximo = !!contact.proxima_acao_data && new Date(contact.proxima_acao_data).getTime() > Date.now();
    if (exigeProximoPasso(validated.outcome) && !informouProximo && !jaTemProximo) {
      return NextResponse.json({
        error: 'Informe o próximo passo (o que vai fazer e quando) antes de registrar.',
        codigo: CODIGO_PROXIMO_PASSO,
      }, { status: 422 });
    }

    // Criar interação
    const { data: interaction, error } = await admin
      .from('interactions')
      .insert({
        organization_id: contact.organization_id,
        contact_id: validated.contact_id,
        type: validated.type,
        outcome: validated.outcome,
        note: validated.note || null,
        happened_at: validated.happened_at || new Date().toISOString(),
        created_by_user_id: user.id,
        created_by_name: profile.name,
        created_by_email: profile.email,
      })
      .select()
      .single();

    if (error) throw error;

    // Atualizar status do contato baseado no outcome
    let newStatus = contact.status;
    if (validated.outcome === 'REUNIAO_MARCADA') {
      newStatus = 'REUNIAO_MARCADA';
    } else if (validated.outcome === 'CONVERTIDO' || validated.outcome === 'PROPOSTA_ACEITA') {
      newStatus = 'CONVERTIDO';
    } else if (validated.outcome === 'NAO_INTERESSADO') {
      newStatus = 'PERDIDO';
    } else if (validated.outcome === 'RESPONDEU' && contact.status === 'NOVO') {
      newStatus = 'CONTATADO';
    } else if (validated.outcome === 'EM_NEGOCIACAO' || validated.outcome === 'AGUARDANDO_RETORNO') {
      newStatus = 'EM_PROSPECCAO';
    } else if (validated.outcome === 'FECHADO_PARCIAL') {
      newStatus = 'CONVERTIDO';
    }

    // status novo + proximo passo informado numa gravacao so; negocio encerrado limpa o proximo passo
    const mudancas: Record<string, unknown> = {};
    if (newStatus !== contact.status) mudancas.status = newStatus;
    if (informouProximo) {
      mudancas.proxima_acao_tipo = validated.proxima_acao_tipo;
      mudancas.proxima_acao_data = validated.proxima_acao_data;
    } else if (!exigeProximoPasso(validated.outcome)) {
      mudancas.proxima_acao_tipo = null;
      mudancas.proxima_acao_data = null;
    }
    if (Object.keys(mudancas).length) {
      await admin
        .from('contacts')
        .update(mudancas)
        .eq('id', validated.contact_id)
        .eq('organization_id', contact.organization_id);
    }

    // Recalculate lead score after new interaction
    try {
      const [contactRes, intRes] = await Promise.all([
        admin.from('contacts').select('*').eq('id', validated.contact_id).single(),
        admin.from('interactions').select('outcome, happened_at').eq('contact_id', validated.contact_id).order('happened_at', { ascending: false }).limit(50),
      ]);
      if (contactRes.data) {
        const detailed = computeLeadScoreDetailed({ ...contactRes.data, interactions: intRes.data || [] });
        await admin.from('contacts').update({ lead_score: detailed.total }).eq('id', validated.contact_id);
      }
    } catch { /* non-blocking */ }

    return NextResponse.json(interaction, { status: 201 });

  } catch (error: any) {
    console.error('Error creating interaction:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao criar interação' },
      { status: 500 }
    );
  }
}
