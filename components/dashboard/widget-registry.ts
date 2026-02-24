export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  defaultW: number;
  defaultH: number;
  category: 'kpi' | 'chart' | 'list' | 'other';
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  // KPIs
  { id: 'total-contacts', name: 'Total de Contatos', description: 'Total de contatos no pipeline', defaultW: 1, defaultH: 1, category: 'kpi' },
  { id: 'new-contacts-month', name: 'Novos no Mes', description: 'Contatos criados este mes', defaultW: 1, defaultH: 1, category: 'kpi' },
  { id: 'meetings-month', name: 'Reunioes no Mes', description: 'Reunioes agendadas este mes', defaultW: 1, defaultH: 1, category: 'kpi' },
  { id: 'interactions-month', name: 'Interacoes no Mes', description: 'Total de interacoes este mes', defaultW: 1, defaultH: 1, category: 'kpi' },
  { id: 'conversion-rate', name: 'Taxa de Conversao', description: 'Percentual de contatos convertidos', defaultW: 1, defaultH: 1, category: 'kpi' },
  // Charts
  { id: 'contacts-by-stage', name: 'Por Estagio', description: 'Distribuicao por estagio do pipeline', defaultW: 2, defaultH: 2, category: 'chart' },
  { id: 'contacts-by-temperature', name: 'Por Temperatura', description: 'Distribuicao por temperatura', defaultW: 2, defaultH: 2, category: 'chart' },
  { id: 'contacts-by-origin', name: 'Por Origem', description: 'Distribuicao por origem', defaultW: 2, defaultH: 2, category: 'chart' },
  // Lists
  { id: 'recent-contacts', name: 'Contatos Recentes', description: 'Ultimos contatos criados', defaultW: 2, defaultH: 2, category: 'list' },
  { id: 'upcoming-meetings', name: 'Proximas Reunioes', description: 'Reunioes agendadas', defaultW: 2, defaultH: 2, category: 'list' },
  { id: 'team-ranking', name: 'Ranking da Equipe', description: 'Performance da equipe', defaultW: 2, defaultH: 2, category: 'list' },
  // Other
  { id: 'quick-actions', name: 'Acoes Rapidas', description: 'Atalhos para acoes comuns', defaultW: 2, defaultH: 1, category: 'other' },
];

export interface WidgetLayout {
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DEFAULT_LAYOUT: WidgetLayout[] = [
  { widgetId: 'total-contacts', x: 0, y: 0, w: 1, h: 1 },
  { widgetId: 'new-contacts-month', x: 1, y: 0, w: 1, h: 1 },
  { widgetId: 'meetings-month', x: 2, y: 0, w: 1, h: 1 },
  { widgetId: 'interactions-month', x: 3, y: 0, w: 1, h: 1 },
  { widgetId: 'contacts-by-stage', x: 0, y: 1, w: 2, h: 2 },
  { widgetId: 'team-ranking', x: 2, y: 1, w: 2, h: 2 },
  { widgetId: 'recent-contacts', x: 0, y: 3, w: 2, h: 2 },
  { widgetId: 'quick-actions', x: 2, y: 3, w: 2, h: 1 },
];

export function getWidgetDef(id: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find(w => w.id === id);
}
