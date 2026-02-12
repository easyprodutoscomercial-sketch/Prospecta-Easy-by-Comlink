import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  phone: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  cpf: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Tipo e classificação
  tipo: z.array(z.enum(['FORNECEDOR', 'COMPRADOR'])).optional().default([]),
  referencia: z.string().optional().nullable(),
  classe: z.enum(['A', 'B', 'C', 'D']).optional().nullable(),
  produtos_fornecidos: z.string().optional().nullable(),
  // Pessoa de contato
  contato_nome: z.string().optional().nullable(),
  cargo: z.string().optional().nullable(),
  // Endereço
  endereco: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  // Presença digital
  website: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  // Qualificação
  temperatura: z.enum(['FRIO', 'MORNO', 'QUENTE']).optional().nullable(),
  origem: z.enum(['MANUAL', 'INDICACAO', 'FEIRA', 'LINKEDIN', 'SITE', 'WHATSAPP_INBOUND', 'OUTRO']).optional().nullable(),
  proxima_acao_tipo: z.enum(['LIGAR', 'ENVIAR_WHATSAPP', 'ENVIAR_EMAIL', 'REUNIAO', 'VISITA', 'FOLLOW_UP', 'ENVIAR_PROPOSTA', 'OUTRO']).optional().nullable(),
  proxima_acao_data: z.string().optional().nullable(),
  motivo_ganho_perdido: z.string().optional().nullable(),
  valor_estimado: z.union([z.number(), z.string().transform((v) => v === '' ? null : Number(v)), z.null()]).optional().nullable(),
});

export const interactionSchema = z.object({
  contact_id: z.string().uuid(),
  type: z.enum([
    'LIGACAO', 'WHATSAPP', 'EMAIL', 'REUNIAO', 'OUTRO',
    'VISITA', 'PROPOSTA_ENVIADA', 'FOLLOW_UP', 'NEGOCIACAO',
    'POS_VENDA', 'SUPORTE', 'INDICACAO', 'APRESENTACAO', 'ORCAMENTO',
  ]),
  outcome: z.enum([
    'SEM_RESPOSTA', 'RESPONDEU', 'REUNIAO_MARCADA', 'NAO_INTERESSADO', 'CONVERTIDO', 'SEGUIR_TENTANDO',
    'PROPOSTA_ACEITA', 'AGUARDANDO_RETORNO', 'EM_NEGOCIACAO', 'INDICOU_TERCEIRO', 'FECHADO_PARCIAL',
  ]),
  note: z.string().optional().nullable(),
  happened_at: z.string().datetime().optional(),
});

export const contactUpdateSchema = z.object({
  status: z.enum([
    'NOVO',
    'EM_PROSPECCAO',
    'CONTATADO',
    'REUNIAO_MARCADA',
    'CONVERTIDO',
    'PERDIDO',
  ]).optional(),
  assigned_to_user_id: z.string().uuid().optional().nullable(),
  // All editable fields
  name: z.string().min(1).max(200).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  cpf: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tipo: z.array(z.enum(['FORNECEDOR', 'COMPRADOR'])).optional(),
  referencia: z.string().optional().nullable(),
  classe: z.enum(['A', 'B', 'C', 'D']).optional().nullable(),
  produtos_fornecidos: z.string().optional().nullable(),
  contato_nome: z.string().optional().nullable(),
  cargo: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  temperatura: z.enum(['FRIO', 'MORNO', 'QUENTE']).optional().nullable(),
  origem: z.enum(['MANUAL', 'INDICACAO', 'FEIRA', 'LINKEDIN', 'SITE', 'WHATSAPP_INBOUND', 'OUTRO']).optional().nullable(),
  proxima_acao_tipo: z.enum(['LIGAR', 'ENVIAR_WHATSAPP', 'ENVIAR_EMAIL', 'REUNIAO', 'VISITA', 'FOLLOW_UP', 'ENVIAR_PROPOSTA', 'OUTRO']).optional().nullable(),
  proxima_acao_data: z.string().optional().nullable(),
  motivo_ganho_perdido: z.string().optional().nullable(),
  valor_estimado: z.union([z.number(), z.string().transform((v) => v === '' ? null : Number(v)), z.null()]).optional().nullable(),
});

export const accessRequestSchema = z.object({
  contact_id: z.string().uuid(),
});

export const accessRequestResolveSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export const pipelineSettingsSchema = z.object({
  columns: z.record(
    z.enum(['NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA', 'CONVERTIDO', 'PERDIDO']),
    z.object({
      label: z.string().min(1).max(50),
      color: z.string().min(4).max(9),
    })
  ),
});
