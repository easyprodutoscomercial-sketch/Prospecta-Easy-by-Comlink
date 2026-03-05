import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { pcClientSchema } from '@/lib/utils/validation';

// GET /api/pedidos-cotacoes/clients - Listar clientes com filtros
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
    const status_sac = searchParams.get('status_sac');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = admin
      .from('pc_clients')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id);

    if (search) {
      query = query.ilike('fornecedor', `%${search}%`);
    }

    if (status_sac && status_sac !== 'all') {
      query = query.eq('status_sac', status_sac);
    }

    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to + 'T23:59:59');
    }

    const { data: clients, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      clients: clients || [],
      total: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error: any) {
    console.error('Error listing pc_clients:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar clientes' },
      { status: 500 }
    );
  }
}

// POST /api/pedidos-cotacoes/clients - Criar cliente
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const body = await request.json();
    const validated = pcClientSchema.parse(body);

    // Extract cnpj_digits from cnpj
    const cnpj_digits = validated.cnpj ? validated.cnpj.replace(/\D/g, '') : null;

    const { data: client, error } = await admin
      .from('pc_clients')
      .insert({
        ...validated,
        cnpj_digits,
        created_by: user.id,
        organization_id: profile.organization_id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(client, { status: 201 });
  } catch (error: any) {
    console.error('Error creating pc_client:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao criar cliente' },
      { status: 500 }
    );
  }
}
