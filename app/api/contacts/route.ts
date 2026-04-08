import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { contactSchema } from '@/lib/utils/validation';
import { normalizeContactData } from '@/lib/utils/normalize';
import { ensureProfile } from '@/lib/ensure-profile';
// Visibility is now handled by pipeline membership (members see all contacts in their pipelines)

// Supabase limita a 1000 rows por request
const SUPABASE_MAX_ROWS = 1000;

// Aplica todos os filtros de busca a uma query de contatos
function applyContactFilters(
  query: any,
  filters: {
    search?: string;
    status?: string | null;
    tipo?: string | null;
    pipeline_id?: string | null;
    stage_id?: string | null;
    assigned?: string | null;
    userId?: string;
    allowedPipelineIds?: string[] | null;
    temperatura?: string | null;
    origem?: string | null;
    classe?: string | null;
    cidade?: string | null;
    estado?: string | null;
    telefone?: string | null;
    cpf?: string | null;
    cnpj?: string | null;
    whatsapp?: string | null;
    empresa?: string | null;
    referencia?: string | null;
    contato_nome?: string | null;
    cargo?: string | null;
    endereco?: string | null;
    cep?: string | null;
    website?: string | null;
    instagram?: string | null;
    proxima_acao_tipo?: string | null;
    produtos_fornecidos?: string | null;
  }
) {
  // Filtrar por pipelines permitidas (non-admin)
  if (filters.allowedPipelineIds !== null && filters.allowedPipelineIds !== undefined && filters.allowedPipelineIds.length > 0) {
    query = query.in('pipeline_id', filters.allowedPipelineIds);
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,company.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
  }
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.tipo && filters.tipo !== 'all') query = query.contains('tipo', [filters.tipo]);
  if (filters.pipeline_id) query = query.eq('pipeline_id', filters.pipeline_id);
  if (filters.stage_id) query = query.eq('stage_id', filters.stage_id);
  if (filters.assigned === 'me' && filters.userId) query = query.eq('assigned_to_user_id', filters.userId);
  else if (filters.assigned === 'unassigned') query = query.is('assigned_to_user_id', null);
  if (filters.temperatura && filters.temperatura !== 'all') query = query.eq('temperatura', filters.temperatura);
  if (filters.origem && filters.origem !== 'all') query = query.eq('origem', filters.origem);
  if (filters.classe && filters.classe !== 'all') query = query.eq('classe', filters.classe);
  if (filters.cidade) query = query.ilike('cidade', `%${filters.cidade}%`);
  if (filters.estado && filters.estado !== 'all') query = query.eq('estado', filters.estado);
  if (filters.telefone) query = query.ilike('phone', `%${filters.telefone}%`);
  if (filters.cpf) query = query.ilike('cpf', `%${filters.cpf}%`);
  if (filters.cnpj) query = query.ilike('cnpj', `%${filters.cnpj}%`);
  if (filters.whatsapp) query = query.ilike('whatsapp', `%${filters.whatsapp}%`);
  if (filters.empresa) query = query.ilike('company', `%${filters.empresa}%`);
  if (filters.referencia) query = query.ilike('referencia', `%${filters.referencia}%`);
  if (filters.contato_nome) query = query.ilike('contato_nome', `%${filters.contato_nome}%`);
  if (filters.cargo) query = query.ilike('cargo', `%${filters.cargo}%`);
  if (filters.endereco) query = query.ilike('endereco', `%${filters.endereco}%`);
  if (filters.cep) query = query.ilike('cep', `%${filters.cep}%`);
  if (filters.website) query = query.ilike('website', `%${filters.website}%`);
  if (filters.instagram) query = query.ilike('instagram', `%${filters.instagram}%`);
  if (filters.proxima_acao_tipo && filters.proxima_acao_tipo !== 'all') query = query.eq('proxima_acao_tipo', filters.proxima_acao_tipo);
  if (filters.produtos_fornecidos) query = query.ilike('produtos_fornecidos', `%${filters.produtos_fornecidos}%`);

  return query;
}

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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortDir = searchParams.get('sortDir') === 'asc' ? true : false;
    const allowedSortFields = ['name', 'company', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

    // Se NAO e admin, buscar pipelines onde o usuario e membro
    let allowedPipelineIds: string[] | null = null;
    if (profile.role !== 'admin') {
      const { data: myMemberships } = await admin
        .from('pipeline_members')
        .select('pipeline_id')
        .eq('user_id', user.id);

      allowedPipelineIds = (myMemberships || []).map((m: any) => m.pipeline_id);
    }

    if (allowedPipelineIds !== null && allowedPipelineIds.length === 0) {
      // Sem membership em nenhum pipeline — nao retorna contatos
      return NextResponse.json({ contacts: [], total: 0, page, limit, totalPages: 0 });
    }

    // Montar objeto de filtros a partir dos search params
    const filters = {
      search: searchParams.get('search') || '',
      status: searchParams.get('status'),
      tipo: searchParams.get('tipo'),
      pipeline_id: searchParams.get('pipeline_id'),
      stage_id: searchParams.get('stage_id'),
      assigned: searchParams.get('assigned'),
      userId: user.id,
      allowedPipelineIds,
      temperatura: searchParams.get('temperatura'),
      origem: searchParams.get('origem'),
      classe: searchParams.get('classe'),
      cidade: searchParams.get('cidade'),
      estado: searchParams.get('estado'),
      telefone: searchParams.get('telefone'),
      cpf: searchParams.get('cpf'),
      cnpj: searchParams.get('cnpj'),
      whatsapp: searchParams.get('whatsapp'),
      empresa: searchParams.get('empresa'),
      referencia: searchParams.get('referencia'),
      contato_nome: searchParams.get('contato_nome'),
      cargo: searchParams.get('cargo'),
      endereco: searchParams.get('endereco'),
      cep: searchParams.get('cep'),
      website: searchParams.get('website'),
      instagram: searchParams.get('instagram'),
      proxima_acao_tipo: searchParams.get('proxima_acao_tipo'),
      produtos_fornecidos: searchParams.get('produtos_fornecidos'),
    };

    // Helper para criar query filtrada
    const buildQuery = (withCount: boolean) => {
      let q = admin
        .from('contacts')
        .select('*', withCount ? { count: 'exact' } : {})
        .eq('organization_id', profile.organization_id);
      return applyContactFilters(q, filters);
    };

    // Se cabe em uma unica request, buscar direto
    if (limit <= SUPABASE_MAX_ROWS) {
      const { data: contacts, error, count } = await buildQuery(true)
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
    }

    // limit > 1000: buscar em lotes sequenciais
    let allContacts: any[] = [];
    let totalCount: number | null = null;
    let currentOffset = offset;

    while (true) {
      const remaining = limit - allContacts.length;
      if (remaining <= 0) break;
      const batchSize = Math.min(SUPABASE_MAX_ROWS, remaining);

      const isFirstBatch = currentOffset === offset;
      const { data: batch, error: batchError, count: batchCount } = await buildQuery(isFirstBatch)
        .order(sortField, { ascending: sortDir })
        .range(currentOffset, currentOffset + batchSize - 1);

      if (batchError) throw batchError;
      if (isFirstBatch && batchCount !== undefined) totalCount = batchCount;

      allContacts.push(...(batch || []));

      // Se retornou menos que o pedido, nao tem mais dados
      if (!batch || batch.length < batchSize) break;
      currentOffset += batch.length;
    }

    return NextResponse.json({
      contacts: allContacts,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil((totalCount || 0) / limit),
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

    // Limpar strings vazias → null (formulario envia "" para campos opcionais)
    const REQUIRED_FIELDS = ['name'];
    const cleanedBody = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [
        key,
        value === '' && !REQUIRED_FIELDS.includes(key) ? null : value,
      ])
    );
    console.log('[API CONTACTS POST] Body limpo:', JSON.stringify(cleanedBody, null, 2));

    // Validar dados
    let validated;
    try {
      validated = contactSchema.parse(cleanedBody);
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

    // Determinar pipeline_id e stage_id
    let contactPipelineId = body.pipeline_id || null;
    let contactStageId = body.stage_id || null;

    // Se nao informou pipeline, usar o default da org
    if (!contactPipelineId) {
      const { data: defaultPipeline } = await admin
        .from('pipelines')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .eq('is_default', true)
        .limit(1)
        .single();

      if (defaultPipeline) {
        contactPipelineId = defaultPipeline.id;
      }
    }

    // Se tem pipeline mas nao tem stage, usar o primeiro stage
    if (contactPipelineId && !contactStageId) {
      const { data: firstStage } = await admin
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', contactPipelineId)
        .order('position', { ascending: true })
        .limit(1)
        .single();

      if (firstStage) {
        contactStageId = firstStage.id;
      }
    }

    // Criar contato (sem responsável — só via "Apontar")
    const { data: newContact, error } = await admin
      .from('contacts')
      .insert({
        organization_id: profile.organization_id,
        ...normalized,
        created_by_user_id: user.id,
        ...(contactPipelineId ? { pipeline_id: contactPipelineId } : {}),
        ...(contactStageId ? { stage_id: contactStageId } : {}),
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
