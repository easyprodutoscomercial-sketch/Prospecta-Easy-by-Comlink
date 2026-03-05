import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { pcPedidoSchema } from '@/lib/utils/validation';

// GET /api/pedidos-cotacoes/pedidos - Listar pedidos com filtros
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
    const situacao = searchParams.get('situacao');
    const finalizado = searchParams.get('finalizado');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = admin
      .from('pc_pedidos')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id);

    if (search) {
      query = query.or(`empresa.ilike.%${search}%,pedido_numero.ilike.%${search}%`);
    }

    if (situacao && situacao !== 'all') {
      query = query.eq('situacao', situacao);
    }

    if (finalizado === 'true') {
      query = query.eq('finalizado', true);
    } else if (finalizado === 'false') {
      query = query.eq('finalizado', false);
    }

    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to + 'T23:59:59');
    }

    const { data: pedidos, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      pedidos: pedidos || [],
      total: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error: any) {
    console.error('Error listing pc_pedidos:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar pedidos' },
      { status: 500 }
    );
  }
}

// POST /api/pedidos-cotacoes/pedidos - Criar pedido
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const body = await request.json();
    const validated = pcPedidoSchema.parse(body);

    // Auto-cadastro: se empresa informada, buscar/criar pc_client
    let pcClientId: string | undefined;
    const empresa = (validated as any).empresa?.trim();
    if (empresa) {
      const { data: existingClient } = await admin
        .from('pc_clients')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .ilike('fornecedor', empresa)
        .limit(1)
        .maybeSingle();

      if (existingClient) {
        pcClientId = existingClient.id;
      } else {
        const { data: newClient } = await admin
          .from('pc_clients')
          .insert({
            fornecedor: empresa,
            status_sac: 'PRE_CADASTRO',
            organization_id: profile.organization_id,
            created_by: user.id,
          })
          .select('id')
          .single();
        pcClientId = newClient?.id;
      }
    }

    const { data: pedido, error } = await admin
      .from('pc_pedidos')
      .insert({
        ...validated,
        ...(pcClientId ? { pc_client_id: pcClientId } : {}),
        created_by: user.id,
        organization_id: profile.organization_id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(pedido, { status: 201 });
  } catch (error: any) {
    console.error('Error creating pc_pedido:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao criar pedido' },
      { status: 500 }
    );
  }
}
