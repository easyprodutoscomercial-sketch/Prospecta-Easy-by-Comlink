import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { contactSchema } from '@/lib/utils/validation';
import { normalizeContactData, normalizePhone, normalizeCPF, normalizeCNPJ, normalizeEmail } from '@/lib/utils/normalize';
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
    // 'me' | 'unassigned' | UUID — quem CADASTROU o contato (created_by_user_id).
    // Diferente de assigned (dono atual). Vendedor que cadastra reclamava de
    // ver leads sumirem quando outro vendedor "apontava" pra si.
    created_by?: string | null;
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
    event_id?: string | null;
    exclude_quiz?: boolean;
    draft_mode?: 'exclude' | 'only' | 'all';
    inexistente_mode?: 'exclude' | 'only' | 'all';
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
  if (filters.tipo && filters.tipo !== 'all') {
    if (filters.tipo === 'AMBOS') {
      query = query.contains('tipo', ['FORNECEDOR', 'COMPRADOR']);
    } else {
      query = query.contains('tipo', [filters.tipo]);
    }
  }
  if (filters.pipeline_id) query = query.eq('pipeline_id', filters.pipeline_id);
  if (filters.stage_id) query = query.eq('stage_id', filters.stage_id);
  if (filters.assigned === 'me' && filters.userId) query = query.eq('assigned_to_user_id', filters.userId);
  else if (filters.assigned === 'unassigned') query = query.is('assigned_to_user_id', null);
  else if (filters.assigned && filters.assigned !== 'all' && filters.assigned.length >= 32) {
    // UUID direto (ex: vindo da lista de vendedores do evento)
    query = query.eq('assigned_to_user_id', filters.assigned);
  }
  // Filtro por CADASTRADOR (created_by_user_id) — quem inseriu o contato.
  // 'unknown' = quiz/import (created_by_user_id null), pra dar visibilidade.
  if (filters.created_by === 'me' && filters.userId) query = query.eq('created_by_user_id', filters.userId);
  else if (filters.created_by === 'unknown') query = query.is('created_by_user_id', null);
  else if (filters.created_by && filters.created_by !== 'all' && filters.created_by.length >= 32) {
    query = query.eq('created_by_user_id', filters.created_by);
  }
  if (filters.temperatura && filters.temperatura !== 'all') query = query.eq('temperatura', filters.temperatura);
  if (filters.origem && filters.origem !== 'all') query = query.eq('origem', filters.origem);
  if (filters.classe && filters.classe !== 'all') query = query.eq('classe', filters.classe);
  if (filters.cidade) query = query.ilike('cidade', `%${filters.cidade}%`);
  if (filters.estado && filters.estado !== 'all') query = query.eq('estado', filters.estado);
  // Filtros de telefone/cpf/cnpj/whatsapp/email comparam por *_normalized pra que
  // o vendedor consiga digitar com mascara ou sem (ex: "(11) 98765-4321" ou
  // "11987654321") e bater igual. Comparar campo cru gerava falso negativo
  // (digitado sem mascara nao batia com banco salvo com mascara) e fazia
  // vendedor criar duplicata achando que nao existia.
  if (filters.telefone) {
    const norm = normalizePhone(filters.telefone);
    if (norm) query = query.ilike('phone_normalized', `%${norm}%`);
  }
  if (filters.cpf) {
    const norm = normalizeCPF(filters.cpf);
    if (norm) query = query.ilike('cpf_digits', `%${norm}%`);
  }
  if (filters.cnpj) {
    const norm = normalizeCNPJ(filters.cnpj);
    if (norm) query = query.ilike('cnpj_digits', `%${norm}%`);
  }
  if (filters.whatsapp) {
    const norm = normalizePhone(filters.whatsapp);
    if (norm) query = query.ilike('phone_normalized', `%${norm}%`);
  }
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
  if (filters.event_id && filters.event_id !== 'all') query = query.eq('event_id', filters.event_id);

  // Filtro de rascunho: exclude (default) = so contatos finalizados;
  // only = so rascunhos; all = tudo (usado internamente).
  if (filters.draft_mode === 'only') {
    query = query.eq('is_draft', true);
  } else if (filters.draft_mode === 'all') {
    // sem filtro
  } else {
    query = query.eq('is_draft', false);
  }

  // Filtro de descartados (inexistente=true): exclude (default) = so ativos;
  // only = so descartados; all = tudo.
  // Por que default exclude: Descartar tem que TIRAR da pipeline / lista; senao
  // o vendedor marca e o contato continua aparecendo, da impressao que nao funcionou.
  if (filters.inexistente_mode === 'only') {
    query = query.eq('inexistente', true);
  } else if (filters.inexistente_mode === 'all') {
    // sem filtro
  } else {
    query = query.eq('inexistente', false);
  }

  return query;
}

// Enrich a list of contacts with their linked event info (id, name, cover_image_url)
async function attachEventsToContacts(admin: any, contacts: any[], organizationId: string) {
  if (!contacts || contacts.length === 0) return contacts;
  const eventIds = Array.from(
    new Set(contacts.map((c: any) => c.event_id).filter(Boolean))
  );
  if (eventIds.length === 0) return contacts;

  const { data: events } = await admin
    .from('events')
    .select('id, name, cover_image_url')
    .eq('organization_id', organizationId)
    .in('id', eventIds);

  const eventMap: Record<string, any> = {};
  for (const e of events || []) eventMap[e.id] = e;

  for (const c of contacts) {
    if (c.event_id && eventMap[c.event_id]) {
      c.event = eventMap[c.event_id];
    }
  }
  return contacts;
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
      created_by: searchParams.get('created_by'),
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
      event_id: searchParams.get('event_id'),
      exclude_quiz: searchParams.get('exclude_quiz') === 'true',
      draft_mode: (searchParams.get('drafts') === 'true'
        ? 'only'
        : searchParams.get('drafts') === 'all'
          ? 'all'
          : 'exclude') as 'exclude' | 'only' | 'all',
      // ?descartados=only -> ver so descartados; ?descartados=all -> ver tudo;
      // default (sem param ou qualquer outro valor) -> esconde descartados.
      inexistente_mode: (searchParams.get('descartados') === 'only'
        ? 'only'
        : searchParams.get('descartados') === 'all'
          ? 'all'
          : 'exclude') as 'exclude' | 'only' | 'all',
    };

    // Helper para criar query filtrada
    const buildQuery = (withCount: boolean) => {
      let q = admin
        .from('contacts')
        .select('*', withCount ? { count: 'exact' } : {})
        .eq('organization_id', profile.organization_id);
      return applyContactFilters(q, filters);
    };

    // Se vem ?exclude_quiz=true (usado pela visualizacao da feira), busca os
    // contact_id do quiz pra filtrar em memoria (PostgREST nao suporta NOT IN
    // com subquery). Nao afeta a tela global /contacts — so quem opt-in.
    let quizContactIds: Set<string> | null = null;
    if (filters.exclude_quiz) {
      const { getQuizContactIds } = await import('@/lib/utils/quiz-filter');
      quizContactIds = await getQuizContactIds(admin, profile.organization_id);
    }

    // Se cabe em uma unica request, buscar direto
    if (limit <= SUPABASE_MAX_ROWS) {
      const { data: contacts, error, count } = await buildQuery(true)
        .order(sortField, { ascending: sortDir })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      let result = contacts || [];
      let total = count || 0;
      if (quizContactIds && quizContactIds.size > 0) {
        const before = result.length;
        result = result.filter((c: any) => !quizContactIds!.has(c.id));
        total -= before - result.length;
      }

      await attachEventsToContacts(admin, result, profile.organization_id);

      return NextResponse.json({
        contacts: result,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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

    let finalContacts = allContacts;
    let finalTotal = totalCount || 0;
    if (quizContactIds && quizContactIds.size > 0) {
      const before = finalContacts.length;
      finalContacts = finalContacts.filter((c: any) => !quizContactIds!.has(c.id));
      finalTotal -= before - finalContacts.length;
    }

    await attachEventsToContacts(admin, finalContacts, profile.organization_id);

    return NextResponse.json({
      contacts: finalContacts,
      total: finalTotal,
      page,
      limit,
      totalPages: Math.ceil(finalTotal / limit),
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

    // Log sem dados sensiveis (nao vazar PII em logs do Vercel)
    console.log('[API CONTACTS POST] Body recebido. fields=', Object.keys(body).length);

    // Limpar strings vazias → null (formulario envia "" para campos opcionais)
    const REQUIRED_FIELDS = ['name'];
    const cleanedBody = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [
        key,
        value === '' && !REQUIRED_FIELDS.includes(key) ? null : value,
      ])
    );

    // Validar dados
    let validated;
    try {
      validated = contactSchema.parse(cleanedBody);
    } catch (validationErr: any) {
      // Loga apenas os campos com erro, nao os valores
      const fields = (validationErr.errors || []).map((e: any) => e.path?.join('.')).join(', ');
      console.error('[API CONTACTS POST] Erro de validacao em:', fields);
      throw validationErr;
    }

    // Converter proxima_acao_data para ISO se presente
    if (validated.proxima_acao_data) {
      validated.proxima_acao_data = new Date(validated.proxima_acao_data).toISOString();
    }

    // Normalizar dados
    const normalized = normalizeContactData(validated);

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
        ...(validated.origem ? { origem: validated.origem } : {}),
        ...(validated.event_id ? { event_id: validated.event_id } : {}),
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
