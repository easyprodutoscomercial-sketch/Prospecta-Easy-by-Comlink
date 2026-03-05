import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { pcCotacaoSchema } from '@/lib/utils/validation';

// GET /api/pedidos-cotacoes/cotacoes - Listar cotacoes com filtros
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const resposta = searchParams.get('resposta');
    const group_by = searchParams.get('group_by');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // When grouping by cotacao_numero, fetch all and group in-memory
    if (group_by === 'cotacao_numero') {
      let groupQuery = admin
        .from('pc_cotacoes')
        .select('*')
        .eq('organization_id', profile.organization_id);

      if (search) {
        groupQuery = groupQuery.or(`fornecedor.ilike.%${search}%,cotacao_numero.ilike.%${search}%`);
      }

      if (resposta && resposta !== 'all') {
        groupQuery = groupQuery.eq('resposta', resposta);
      }

      if (date_from) {
        groupQuery = groupQuery.gte('created_at', date_from);
      }
      if (date_to) {
        groupQuery = groupQuery.lte('created_at', date_to + 'T23:59:59');
      }

      const { data: allCotacoes, error } = await groupQuery
        .order('cotacao_numero', { ascending: false });

      if (error) throw error;

      // Group by cotacao_numero
      const grouped: Record<string, any[]> = {};
      (allCotacoes || []).forEach((c: any) => {
        if (!grouped[c.cotacao_numero]) {
          grouped[c.cotacao_numero] = [];
        }
        grouped[c.cotacao_numero].push(c);
      });

      // Sort keys descending and return
      const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
      const result = sortedKeys.map((key) => ({
        cotacao_numero: key,
        cotacao_nome: grouped[key][0]?.cotacao_nome || null,
        cotacoes: grouped[key],
      }));

      return NextResponse.json({ groups: result });
    }

    // Standard paginated listing
    let query = admin
      .from('pc_cotacoes')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id);

    if (search) {
      query = query.or(`fornecedor.ilike.%${search}%,cotacao_numero.ilike.%${search}%`);
    }

    if (resposta && resposta !== 'all') {
      query = query.eq('resposta', resposta);
    }

    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to + 'T23:59:59');
    }

    const { data: cotacoes, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      cotacoes: cotacoes || [],
      total: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error: any) {
    console.error('Error listing pc_cotacoes:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar cotacoes' },
      { status: 500 }
    );
  }
}

// POST /api/pedidos-cotacoes/cotacoes - Criar cotacao
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const body = await request.json();
    const validated = pcCotacaoSchema.parse(body);

    // Auto-cadastro: se fornecedor informado, buscar/criar pc_client
    let pcClientId: string | undefined;
    const fornecedor = (validated as any).fornecedor?.trim();
    if (fornecedor) {
      const { data: existingClient } = await admin
        .from('pc_clients')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .ilike('fornecedor', fornecedor)
        .limit(1)
        .maybeSingle();

      if (existingClient) {
        pcClientId = existingClient.id;
      } else {
        const { data: newClient } = await admin
          .from('pc_clients')
          .insert({
            fornecedor,
            cnpj: (validated as any).cnpj || null,
            status_sac: 'PRE_CADASTRO',
            organization_id: profile.organization_id,
            created_by: user.id,
          })
          .select('id')
          .single();
        pcClientId = newClient?.id;
      }
    }

    const { data: cotacao, error } = await admin
      .from('pc_cotacoes')
      .insert({
        ...validated,
        ...(pcClientId ? { pc_client_id: pcClientId } : {}),
        created_by: user.id,
        organization_id: profile.organization_id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(cotacao, { status: 201 });
  } catch (error: any) {
    console.error('Error creating pc_cotacao:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao criar cotacao' },
      { status: 500 }
    );
  }
}
