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
  segmento: z.string().max(100).optional().nullable(),
  origem: z.enum(['MANUAL', 'INDICACAO', 'FEIRA', 'LINKEDIN', 'SITE', 'WHATSAPP_INBOUND', 'OUTRO', 'QRCODE']).optional().nullable(),
  proxima_acao_tipo: z.enum(['LIGAR', 'ENVIAR_WHATSAPP', 'ENVIAR_EMAIL', 'REUNIAO', 'VISITA', 'FOLLOW_UP', 'ENVIAR_PROPOSTA', 'OUTRO']).optional().nullable(),
  proxima_acao_data: z.string().optional().nullable(),
  motivo_ganho_perdido: z.string().optional().nullable(),
  valor_estimado: z.union([z.number(), z.string().transform((v) => v === '' ? null : Number(v)), z.null()]).optional().nullable(),
  sem_documento: z.boolean().optional().default(false),
}).refine((data) => {
  if (data.sem_documento) return true;
  const cpfDigits = data.cpf?.replace(/\D/g, '') || '';
  const cnpjDigits = data.cnpj?.replace(/\D/g, '') || '';
  return (cpfDigits.length === 11) || (cnpjDigits.length === 14);
}, { message: 'CPF ou CNPJ é obrigatório', path: ['cpf'] });

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
  pipeline_id: z.string().uuid().optional().nullable(),
  stage_id: z.string().uuid().optional().nullable(),
  assigned_to_user_id: z.string().uuid().optional().nullable(),
  // All editable fields
  name: z.string().min(1).max(200).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  cpf: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  sem_documento: z.boolean().optional(),
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
  segmento: z.string().max(100).optional().nullable(),
  origem: z.enum(['MANUAL', 'INDICACAO', 'FEIRA', 'LINKEDIN', 'SITE', 'WHATSAPP_INBOUND', 'OUTRO', 'QRCODE']).optional().nullable(),
  proxima_acao_tipo: z.enum(['LIGAR', 'ENVIAR_WHATSAPP', 'ENVIAR_EMAIL', 'REUNIAO', 'VISITA', 'FOLLOW_UP', 'ENVIAR_PROPOSTA', 'OUTRO']).optional().nullable(),
  proxima_acao_data: z.string().optional().nullable(),
  motivo_ganho_perdido: z.string().optional().nullable(),
  valor_estimado: z.union([z.number(), z.string().transform((v) => v === '' ? null : Number(v)), z.null()]).optional().nullable(),
  inexistente: z.boolean().optional(),
  telefones_adicionais: z.array(z.object({
    phone: z.string().min(1),
    nome_contato: z.string().optional().default(''),
    correto: z.boolean().default(true),
  })).optional().nullable(),
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
  broadcast_notifications: z.boolean().optional(),
  broadcast_duration_minutes: z.number().min(1).max(30).optional(),
  banner_toggle_visible: z.boolean().optional(),
});

// Pipeline CRUD schemas
export const pipelineStageSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Nome do stage obrigatorio').max(50),
  slug: z.string().min(1).max(50),
  color: z.string().min(4).max(9).default('#a3a3a3'),
  icon: z.string().max(50).nullable().optional().default(null),
  position: z.number().int().min(0),
  is_terminal: z.boolean().default(false),
  terminal_type: z.enum(['won', 'lost']).nullable().default(null),
  allow_meeting: z.boolean().default(false),
});

export const pipelineCreateSchema = z.object({
  name: z.string().min(1, 'Nome do pipeline obrigatorio').max(100),
  description: z.string().max(500).optional().nullable(),
  pipeline_type: z.enum(['PADRAO', 'BUGS', 'SUPORTE']).default('PADRAO'),
  stages: z.array(pipelineStageSchema).min(1, 'Pelo menos 1 stage obrigatorio'),
  member_user_ids: z.array(z.string().uuid()).optional(),
});

export const pipelineUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  pipeline_type: z.enum(['PADRAO', 'BUGS', 'SUPORTE']).optional(),
  stages: z.array(pipelineStageSchema).min(1, 'Pelo menos 1 stage obrigatorio').optional(),
  member_user_ids: z.array(z.string().uuid()).optional(),
});

// ============================================
// Work Fronts
// ============================================

export const workFrontSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio').max(100),
  description: z.string().max(500).optional().nullable(),
  color: z.string().min(4).max(9).default('#8B5CF6'),
  icon: z.string().max(50).default('folder'),
  is_active: z.boolean().default(true),
});

export const workFrontTagSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio').max(50),
  color: z.string().min(4).max(9).default('#6366F1'),
});

export const workFrontSprintSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio').max(100),
  goal: z.string().max(500).optional().nullable(),
  starts_at: z.string().min(1, 'Data inicio e obrigatoria'),
  ends_at: z.string().min(1, 'Data fim e obrigatoria'),
  status: z.enum(['PLANEJADA', 'ATIVA', 'CONCLUIDA', 'CANCELADA']).default('PLANEJADA'),
});

// ============================================
// Bug Reports
// ============================================

export const bugReportSchema = z.object({
  title: z.string().min(1, 'Titulo e obrigatorio').max(200),
  description: z.string().max(5000).optional().nullable(),
  severity: z.enum(['CRITICO', 'ALTO', 'MEDIO', 'BAIXO']).default('MEDIO'),
  priority: z.enum(['URGENTE', 'ALTA', 'NORMAL', 'BAIXA']).default('NORMAL'),
  work_front_id: z.string().uuid().optional().nullable(),
  sprint_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  tag_ids: z.array(z.string().uuid()).optional().default([]),
});

export const bugReportUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  severity: z.enum(['CRITICO', 'ALTO', 'MEDIO', 'BAIXO']).optional(),
  priority: z.enum(['URGENTE', 'ALTA', 'NORMAL', 'BAIXA']).optional(),
  status: z.enum(['ABERTO', 'EM_ANALISE', 'CORRIGINDO', 'TESTE', 'RESOLVIDO']).optional(),
  work_front_id: z.string().uuid().optional().nullable(),
  sprint_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  resolution_notes: z.string().max(5000).optional().nullable(),
  tag_ids: z.array(z.string().uuid()).optional(),
});

export const bugCommentSchema = z.object({
  content: z.string().min(1, 'Comentario e obrigatorio').max(5000),
});

// ============================================
// Support Tickets
// ============================================

export const supportTicketSchema = z.object({
  title: z.string().min(1, 'Titulo e obrigatorio').max(200),
  description: z.string().max(5000).optional().nullable(),
  ticket_type: z.enum(['SUPORTE', 'TAREFA', 'BUG']).default('SUPORTE'),
  category: z.enum(['ERRO', 'DUVIDA', 'MELHORIA', 'ENTREGA', 'CONFIGURACAO', 'GERAL']).default('GERAL'),
  priority: z.enum(['URGENTE', 'ALTA', 'NORMAL', 'BAIXA']).default('NORMAL'),
  severity: z.enum(['CRITICO', 'ALTO', 'MEDIO', 'BAIXO']).optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

export const supportTicketUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  ticket_type: z.enum(['SUPORTE', 'TAREFA', 'BUG']).optional(),
  category: z.enum(['ERRO', 'DUVIDA', 'MELHORIA', 'ENTREGA', 'CONFIGURACAO', 'GERAL']).optional(),
  priority: z.enum(['URGENTE', 'ALTA', 'NORMAL', 'BAIXA']).optional(),
  severity: z.enum(['CRITICO', 'ALTO', 'MEDIO', 'BAIXO']).optional().nullable(),
  status: z.enum(['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO', 'RESOLVIDO', 'FECHADO']).optional(),
  pipeline_id: z.string().uuid().optional().nullable(),
  stage_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
  resolution_notes: z.string().max(5000).optional().nullable(),
});

export const supportProjectSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio').max(100),
  description: z.string().max(500).optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
});

export const supportProjectUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const supportCommentSchema = z.object({
  content: z.string().min(1, 'Comentario e obrigatorio').max(5000),
});
