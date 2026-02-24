'use client';

import { WIDGET_REGISTRY, type WidgetLayout } from './widget-registry';

interface WidgetCatalogProps {
  currentLayout: WidgetLayout[];
  onAdd: (widgetId: string) => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  kpi: 'KPIs',
  chart: 'Graficos',
  list: 'Listas',
  other: 'Outros',
};

const CATEGORY_ORDER = ['kpi', 'chart', 'list', 'other'];

export function WidgetCatalog({ currentLayout, onAdd, onClose }: WidgetCatalogProps) {
  const activeIds = new Set(currentLayout.map(w => w.widgetId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#120826] border border-purple-800/30 rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-purple-800/20 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-emerald-400">Adicionar Widget</h2>
          <button onClick={onClose} className="text-purple-300/50 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {CATEGORY_ORDER.map(cat => {
            const widgets = WIDGET_REGISTRY.filter(w => w.category === cat);
            if (widgets.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-xs font-bold text-purple-300/50 uppercase tracking-wider mb-3">{CATEGORY_LABELS[cat]}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {widgets.map(w => {
                    const isActive = activeIds.has(w.id);
                    return (
                      <div key={w.id} className={`p-3 rounded-lg border transition-colors ${isActive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#1e0f35] border-purple-800/20 hover:border-purple-600/40'}`}>
                        <p className="text-sm font-medium text-neutral-200">{w.name}</p>
                        <p className="text-[10px] text-purple-300/40 mt-0.5">{w.description}</p>
                        <button
                          onClick={() => !isActive && onAdd(w.id)}
                          disabled={isActive}
                          className={`mt-2 px-3 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-400/50 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {isActive ? 'Adicionado' : 'Adicionar'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
