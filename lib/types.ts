export type ContactStatus =
  | 'NOVO'
  | 'EM_PROSPECCAO'
  | 'CONTATADO'
  | 'REUNIAO_MARCADA'
  | 'CONVERTIDO'
  | 'PERDIDO';

export type ContactType = 'FORNECEDOR' | 'COMPRADOR';

export type InteractionType =
  | 'LIGACAO'
  | 'WHATSAPP'
  | 'EMAIL'
  | 'REUNIAO'
  | 'OUTRO'
  | 'VISITA'
  | 'PROPOSTA_ENVIADA'
  | 'FOLLOW_UP'
  | 'NEGOCIACAO'
  | 'POS_VENDA'
  | 'SUPORTE'
  | 'INDICACAO'
  | 'APRESENTACAO'
  | 'ORCAMENTO';

export type InteractionOutcome =
  | 'SEM_RESPOSTA'
  | 'RESPONDEU'
  | 'REUNIAO_MARCADA'
  | 'NAO_INTERESSADO'
  | 'CONVERTIDO'
  | 'SEGUIR_TENTANDO'
  | 'PROPOSTA_ACEITA'
  | 'AGUARDANDO_RETORNO'
  | 'EM_NEGOCIACAO'
  | 'INDICOU_TERCEIRO'
  | 'FECHADO_PARCIAL';

export interface Contact {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  cnpj: string | null;
  company: string | null;
  notes: string | null;
  // Tipo e classificação
  tipo: ContactType[];
  referencia: string | null;
  classe: string | null;
  produtos_fornecidos: string | null;
  // Pessoa de contato
  contato_nome: string | null;
  cargo: string | null;
  // Endereço
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  // Presença digital
  website: string | null;
  instagram: string | null;
  whatsapp: string | null;
  // Normalizados
  name_normalized: string;
  phone_normalized: string | null;
  email_normalized: string | null;
  cpf_digits: string | null;
  cnpj_digits: string | null;
  // Status e atribuição
  status: ContactStatus;
  assigned_to_user_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  organization_id: string;
  contact_id: string;
  type: InteractionType;
  outcome: InteractionOutcome;
  note: string | null;
  happened_at: string;
  created_by_user_id: string;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  user_id: string;
  organization_id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface ImportResult {
  total_rows: number;
  created_count: number;
  duplicate_count: number;
  invalid_count: number;
  items: {
    row_number: number;
    status: 'created' | 'duplicate' | 'invalid';
    contact_id?: string;
    error_message?: string;
    data: any;
  }[];
}

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  email: string;
  contacts_created: number;
  interactions_count: number;
  meetings_count: number;
  conversions_count: number;
}
