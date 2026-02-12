import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { contactSchema } from '@/lib/utils/validation';
import { normalizeContactData } from '@/lib/utils/normalize';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/contacts - Listar contatos com filtros
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
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const tipo = searchParams.get('tipo'); // 'FORNECEDOR' | 'COMPRADOR'
    const assigned = searchParams.get('assigned'); // 'me' | 'unassigned' | 'all'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortDir = searchParams.get('sortDir') === 'asc' ? true : false;
    const allowedSortFields = ['name', 'company', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

    let query = admin
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

    // Filtro de tipo
    if (tipo && tipo !== 'all') {
      query = query.contains('tipo', [tipo]);
    }

    // Filtro de atribuição
    if (assigned === 'me') {
      query = query.eq('assigned_to_user_id', user.id);
    } else if (assigned === 'unassigned') {
      query = query.is('assigned_to_user_id', null);
    }

    // Filtros adicionais
    const temperatura = searchParams.get('temperatura');
    if (temperatura && temperatura !== 'all') {
      query = query.eq('temperatura', temperatura);
    }

    const origem = searchParams.get('origem');
    if (origem && origem !== 'all') {
      query = query.eq('origem', origem);
    }

    const classe = searchParams.get('classe');
    if (classe && classe !== 'all') {
      query = query.eq('classe', classe);
    }

    const cidade = searchParams.get('cidade');
    if (cidade) {
      query = query.ilike('cidade', `%${cidade}%`);
    }

    const estado = searchParams.get('estado');
    if (estado && estado !== 'all') {
      query = query.eq('estado', estado);
    }

    const telefone = searchParams.get('telefone');
    if (telefone) {
      query = query.ilike('phone', `%${telefone}%`);
    }

    const cpf = searchParams.get('cpf');
    if (cpf) {
      query = query.ilike('cpf', `%${cpf}%`);
    }

    const cnpj = searchParams.get('cnpj');
    if (cnpj) {
      query = query.ilike('cnpj', `%${cnpj}%`);
    }

    const whatsapp = searchParams.get('whatsapp');
    if (whatsapp) {
      query = query.ilike('whatsapp', `%${whatsapp}%`);
    }

    const empresa = searchParams.get('empresa');
    if (empresa) {
      query = query.ilike('company', `%${empresa}%`);
    }

    const referencia = searchParams.get('referencia');
    if (referencia) {
      query = query.ilike('referencia', `%${referencia}%`);
    }

    const contato_nome = searchParams.get('contato_nome');
    if (contato_nome) {
      query = query.ilike('contato_nome', `%${contato_nome}%`);
    }

    const cargo = searchParams.get('cargo');
    if (cargo) {
      query = query.ilike('cargo', `%${cargo}%`);
    }

    const endereco = searchParams.get('endereco');
    if (endereco) {
      query = query.ilike('endereco', `%${endereco}%`);
    }

    const cep = searchParams.get('cep');
    if (cep) {
      query = query.ilike('cep', `%${cep}%`);
    }

    const website = searchParams.get('website');
    if (website) {
      query = query.ilike('website', `%${website}%`);
    }

    const instagram = searchParams.get('instagram');
    if (instagram) {
      query = query.ilike('instagram', `%${instagram}%`);
    }

    const proxima_acao_tipo = searchParams.get('proxima_acao_tipo');
    if (proxima_acao_tipo && proxima_acao_tipo !== 'all') {
      query = query.eq('proxima_acao_tipo', proxima_acao_tipo);
    }

    const produtos_fornecidos = searchParams.get('produtos_fornecidos');
    if (produtos_fornecidos) {
      query = query.ilike('produtos_fornecidos', `%${produtos_fornecidos}%`);
    }

    // Paginação e ordenação
    const { data: contacts, error, count } = await query
      .order(sortField, { ascending: sortDir })
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

    const profile = await ensureProfile(supabase, user);

    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();
    const body = await request.json();

    console.log('[API CONTACTS POST] Body recebido:', JSON.stringify(body, null, 2));
    console.log('[API CONTACTS POST] CPF:', body.cpf, '| CNPJ:', body.cnpj);
    console.log('[API CONTACTS POST] CPF digits:', (body.cpf || '').replace(/\D/g, '').length, '| CNPJ digits:', (body.cnpj || '').replace(/\D/g, '').length);

    // Validar dados
    let validated;
    try {
      validated = contactSchema.parse(body);
      console.log('[API CONTACTS POST] Validacao OK');
    } catch (validationErr: any) {
      console.error('[API CONTACTS POST] Erro de validacao:', JSON.stringify(validationErr.errors || validationErr.message, null, 2));
      throw validationErr;
    }

    // Converter proxima_acao_data para ISO se presente
    if (validated.proxima_acao_data) {
      validated.proxima_acao_data = new Date(validated.proxima_acao_data).toISOString();
    }

    // Normalizar dados
    const normalized = normalizeContactData(validated);
    console.log('[API CONTACTS POST] Dados normalizados:', JSON.stringify(normalized, null, 2));

    // DEDUPLICAÇÃO - buscar duplicados
    const duplicateChecks = [];

    if (normalized.email_normalized) {
      duplicateChecks.push(
        admin
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
        admin
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
        admin
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
        admin
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
      console.warn('[API CONTACTS POST] Duplicado encontrado:', JSON.stringify(duplicate.data));
      return NextResponse.json(
        {
          error: 'Contato já existe',
          duplicate: duplicate.data,
        },
        { status: 409 }
      );
    }

    // Criar contato (sem responsável — só via "Apontar")
    const { data: newContact, error } = await admin
      .from('contacts')
      .insert({
        organization_id: profile.organization_id,
        ...normalized,
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[API CONTACTS POST] Erro ao inserir no Supabase:', error);
      throw error;
    }

    console.log('[API CONTACTS POST] Contato criado com sucesso, ID:', newContact?.id);
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
