import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  phone: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  cpf: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const interactionSchema = z.object({
  contact_id: z.string().uuid(),
  type: z.enum(['LIGACAO', 'WHATSAPP', 'EMAIL', 'REUNIAO', 'OUTRO']),
  outcome: z.enum([
    'SEM_RESPOSTA',
    'RESPONDEU',
    'REUNIAO_MARCADA',
    'NAO_INTERESSADO',
    'CONVERTIDO',
    'SEGUIR_TENTANDO',
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
});
