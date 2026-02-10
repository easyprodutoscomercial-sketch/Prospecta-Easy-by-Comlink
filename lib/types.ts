export type ContactStatus = 
  | 'NOVO'
  | 'EM_PROSPECCAO'
  | 'CONTATADO'
  | 'REUNIAO_MARCADA'
  | 'CONVERTIDO'
  | 'PERDIDO';

export type InteractionType = 
  | 'LIGACAO'
  | 'WHATSAPP'
  | 'EMAIL'
  | 'REUNIAO'
  | 'OUTRO';

export type InteractionOutcome = 
  | 'SEM_RESPOSTA'
  | 'RESPONDEU'
  | 'REUNIAO_MARCADA'
  | 'NAO_INTERESSADO'
  | 'CONVERTIDO'
  | 'SEGUIR_TENTANDO';

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
  name_normalized: string;
  phone_normalized: string | null;
  email_normalized: string | null;
  cpf_digits: string | null;
  cnpj_digits: string | null;
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
