export interface PipelineTemplate {
  name: string;
  description: string;
  stages: {
    name: string;
    slug: string;
    color: string;
    position: number;
    is_terminal: boolean;
    terminal_type: 'won' | 'lost' | null;
  }[];
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    name: 'SaaS / Software',
    description: 'Pipeline para vendas de software e servicos digitais',
    stages: [
      { name: 'Lead', slug: 'NOVO', color: '#6b7280', position: 0, is_terminal: false, terminal_type: null },
      { name: 'Qualificacao', slug: 'EM_PROSPECCAO', color: '#f59e0b', position: 1, is_terminal: false, terminal_type: null },
      { name: 'Demo Agendada', slug: 'REUNIAO_MARCADA', color: '#3b82f6', position: 2, is_terminal: false, terminal_type: null },
      { name: 'Proposta Enviada', slug: 'CONTATADO', color: '#8b5cf6', position: 3, is_terminal: false, terminal_type: null },
      { name: 'Negociacao', slug: 'NEGOCIACAO', color: '#06b6d4', position: 4, is_terminal: false, terminal_type: null },
      { name: 'Fechado Ganho', slug: 'CONVERTIDO', color: '#10b981', position: 5, is_terminal: true, terminal_type: 'won' },
      { name: 'Fechado Perdido', slug: 'PERDIDO', color: '#ef4444', position: 6, is_terminal: true, terminal_type: 'lost' },
    ],
  },
  {
    name: 'Consultoria',
    description: 'Pipeline para servicos de consultoria',
    stages: [
      { name: 'Prospect', slug: 'NOVO', color: '#6b7280', position: 0, is_terminal: false, terminal_type: null },
      { name: 'Primeiro Contato', slug: 'CONTATADO', color: '#3b82f6', position: 1, is_terminal: false, terminal_type: null },
      { name: 'Levantamento', slug: 'EM_PROSPECCAO', color: '#f59e0b', position: 2, is_terminal: false, terminal_type: null },
      { name: 'Proposta', slug: 'PROPOSTA', color: '#8b5cf6', position: 3, is_terminal: false, terminal_type: null },
      { name: 'Apresentacao', slug: 'REUNIAO_MARCADA', color: '#06b6d4', position: 4, is_terminal: false, terminal_type: null },
      { name: 'Contratado', slug: 'CONVERTIDO', color: '#10b981', position: 5, is_terminal: true, terminal_type: 'won' },
      { name: 'Declinado', slug: 'PERDIDO', color: '#ef4444', position: 6, is_terminal: true, terminal_type: 'lost' },
    ],
  },
  {
    name: 'Varejo',
    description: 'Pipeline para vendas no varejo',
    stages: [
      { name: 'Interesse', slug: 'NOVO', color: '#6b7280', position: 0, is_terminal: false, terminal_type: null },
      { name: 'Visitou Loja', slug: 'CONTATADO', color: '#3b82f6', position: 1, is_terminal: false, terminal_type: null },
      { name: 'Orcamento', slug: 'EM_PROSPECCAO', color: '#f59e0b', position: 2, is_terminal: false, terminal_type: null },
      { name: 'Negociacao', slug: 'NEGOCIACAO', color: '#8b5cf6', position: 3, is_terminal: false, terminal_type: null },
      { name: 'Vendido', slug: 'CONVERTIDO', color: '#10b981', position: 4, is_terminal: true, terminal_type: 'won' },
      { name: 'Desistiu', slug: 'PERDIDO', color: '#ef4444', position: 5, is_terminal: true, terminal_type: 'lost' },
    ],
  },
  {
    name: 'Telecom',
    description: 'Pipeline para vendas de telecomunicacoes',
    stages: [
      { name: 'Lead', slug: 'NOVO', color: '#6b7280', position: 0, is_terminal: false, terminal_type: null },
      { name: 'Contato Realizado', slug: 'CONTATADO', color: '#3b82f6', position: 1, is_terminal: false, terminal_type: null },
      { name: 'Analise de Viabilidade', slug: 'EM_PROSPECCAO', color: '#f59e0b', position: 2, is_terminal: false, terminal_type: null },
      { name: 'Proposta Tecnica', slug: 'PROPOSTA', color: '#8b5cf6', position: 3, is_terminal: false, terminal_type: null },
      { name: 'Reuniao Tecnica', slug: 'REUNIAO_MARCADA', color: '#06b6d4', position: 4, is_terminal: false, terminal_type: null },
      { name: 'Contrato Assinado', slug: 'CONVERTIDO', color: '#10b981', position: 5, is_terminal: true, terminal_type: 'won' },
      { name: 'Perdido', slug: 'PERDIDO', color: '#ef4444', position: 6, is_terminal: true, terminal_type: 'lost' },
    ],
  },
  {
    name: 'Imobiliario',
    description: 'Pipeline para vendas de imoveis',
    stages: [
      { name: 'Prospect', slug: 'NOVO', color: '#6b7280', position: 0, is_terminal: false, terminal_type: null },
      { name: 'Qualificado', slug: 'CONTATADO', color: '#3b82f6', position: 1, is_terminal: false, terminal_type: null },
      { name: 'Visita Agendada', slug: 'REUNIAO_MARCADA', color: '#f59e0b', position: 2, is_terminal: false, terminal_type: null },
      { name: 'Proposta', slug: 'PROPOSTA', color: '#8b5cf6', position: 3, is_terminal: false, terminal_type: null },
      { name: 'Documentacao', slug: 'DOCUMENTACAO', color: '#06b6d4', position: 4, is_terminal: false, terminal_type: null },
      { name: 'Escritura', slug: 'CONVERTIDO', color: '#10b981', position: 5, is_terminal: true, terminal_type: 'won' },
      { name: 'Desistencia', slug: 'PERDIDO', color: '#ef4444', position: 6, is_terminal: true, terminal_type: 'lost' },
    ],
  },
];
