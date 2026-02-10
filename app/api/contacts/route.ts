import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { contactSchema } from '@/lib/utils/validation';
import { normalizeContactData } from '@/lib/utils/normalize';

// GET /api/contacts - Listar contatos com filtros
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Pegar organization_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const assigned = searchParams.get('assigned'); // 'me' | 'unassigned' | 'all'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id);

    // Filtro de busca
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%`);
    }

    // Filtro de status
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Filtro de atribuição
    if (assigned === 'me') {
      query = query.eq('assigned_to_user_id', user.id);
    } else if (assigned === 'unassigned') {
      query = query.is('assigned_to_user_id', null);
    }

    // Paginação e ordenação
    const { data: contacts, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      contacts,
      total: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });

  } catch (error: any) {
    console.error('Error listing contacts:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar contatos' },
      { status: 500 }
    );
  }
}

// POST /api/contacts - Criar contato com deduplicação
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Pegar profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const body = await request.json();
    
    // Validar dados
    const validated = contactSchema.parse(body);
    
    // Normalizar dados
    const normalized = normalizeContactData(validated);

    // DEDUPLICAÇÃO - buscar duplicados
    const duplicateChecks = [];
    
    if (normalized.email_normalized) {
      duplicateChecks.push(
        supabase
          .from('contacts')
          .select('id, name, email, phone')
          .eq('organization_id', profile.organization_id)
          .eq('email_normalized', normalized.email_normalized)
          .limit(1)
          .single()
      );
    }
    
    if (normalized.phone_normalized) {
      duplicateChecks.push(
        supabase
          .from('contacts')
          .select('id, name, email, phone')
          .eq('organization_id', profile.organization_id)
          .eq('phone_normalized', normalized.phone_normalized)
          .limit(1)
          .single()
      );
    }
    
    if (normalized.cpf_digits) {
      duplicateChecks.push(
        supabase
          .from('contacts')
          .select('id, name, email, phone')
          .eq('organization_id', profile.organization_id)
          .eq('cpf_digits', normalized.cpf_digits)
          .limit(1)
          .single()
      );
    }
    
    if (normalized.cnpj_digits) {
      duplicateChecks.push(
        supabase
          .from('contacts')
          .select('id, name, email, phone')
          .eq('organization_id', profile.organization_id)
          .eq('cnpj_digits', normalized.cnpj_digits)
          .limit(1)
          .single()
      );
    }

    // Executar todas as verificações
    const results = await Promise.all(duplicateChecks);
    
    // Procurar por duplicado (ignorar erros de "not found")
    const duplicate = results.find(r => r.data && !r.error);
    
    if (duplicate && duplicate.data) {
      return NextResponse.json(
        {
          error: 'Contato já existe',
          duplicate: duplicate.data,
        },
        { status: 409 }
      );
    }

    // Criar contato
    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({
        organization_id: profile.organization_id,
        ...normalized,
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(newContact, { status: 201 });

  } catch (error: any) {
    console.error('Error creating contact:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Erro ao criar contato' },
      { status: 500 }
    );
  }
}
