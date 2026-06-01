// Filtros compartilhados de contatos.
// Usado por: /api/contacts (listagem) e /api/contacts/export (xlsx).
//
// Por que existe: antes a logica estava duplicada nos 2 lugares e ja tinha
// divergido — o export nao filtrava is_draft/inexistente, entao planilha
// vinha com 2500 linhas que a tela mostrava 2300, vendedor reclamava.

import { normalizePhone, normalizeCPF, normalizeCNPJ } from '@/lib/utils/normalize';

export type ContactFilters = {
  search?: string;
  status?: string | null;
  tipo?: string | null;
  pipeline_id?: string | null;
  stage_id?: string | null;
  assigned?: string | null;
  // Quem CADASTROU. Diferente de assigned (dono atual).
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
};

export function applyContactFilters(query: any, filters: ContactFilters) {
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
    query = query.eq('assigned_to_user_id', filters.assigned);
  }

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

  // *_normalized pra que vendedor digite com ou sem mascara e bate igual.
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

  // Rascunho: default exclude. Listagem normal nunca mostra rascunho.
  if (filters.draft_mode === 'only') {
    query = query.eq('is_draft', true);
  } else if (filters.draft_mode === 'all') {
    // sem filtro
  } else {
    query = query.eq('is_draft', false);
  }

  // Descartado: default exclude. Vendedor que marca como descartado quer
  // que SUMA da listagem — senao parece que nao funcionou.
  if (filters.inexistente_mode === 'only') {
    query = query.eq('inexistente', true);
  } else if (filters.inexistente_mode === 'all') {
    // sem filtro
  } else {
    query = query.eq('inexistente', false);
  }

  return query;
}
