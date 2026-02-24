'use client';

import { useState, useMemo } from 'react';
import { useDashboardLayout } from '@/lib/dashboard-layout-context';
import { usePipeline } from '@/lib/pipeline-context';
import { getWidgetDef } from './widget-registry';
import { WidgetWrapper } from './widget-wrapper';
import { WidgetCatalog } from './widget-catalog';
import { KpiWidget } from './widgets/kpi-widget';
import { ChartWidget } from './widgets/chart-widget';
import { ListWidget } from './widgets/list-widget';
import { RankingWidget } from './widgets/ranking-widget';
import { QuickActionsWidget } from './widgets/quick-actions-widget';
import { TEMPERATURA_LABELS, ORIGEM_LABELS } from '@/lib/utils/labels';

interface DashboardGridProps {
  contacts: any[];
  interactions: any[];
  meetings: any[];
  recentContacts: any[];
  teamData: { name: string; score: number }[];
}

export function DashboardGrid({ contacts, interactions, meetings, recentContacts, teamData }: DashboardGridProps) {
  const { layout, editMode, setEditMode, addWidget, removeWidget, saveLayout, resetLayout, loading } = useDashboardLayout();
  const { currentPipeline } = usePipeline();
  const [showCatalog, setShowCatalog] = useState(false);

  const stages = currentPipeline?.stages || [];

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = contacts.filter(c => new Date(c.created_at) >= monthStart).length;
    const meetingsThisMonth = meetings.filter(m => new Date(m.meeting_at) >= monthStart).length;
    const interactionsThisMonth = interactions.filter(i => new Date(i.happened_at) >= monthStart).length;
    const converted = contacts.filter(c => c.status === 'CONVERTIDO').length;
    const conversionRate = contacts.length > 0 ? Math.round((converted / contacts.length) * 100) : 0;

    const byStage = stages.map(s => ({
      label: s.name,
      value: contacts.filter(c => c.stage_id === s.id).length,
      color: s.color || '#a3a3a3',
    }));

    const byTemp = (['FRIO', 'MORNO', 'QUENTE'] as const).map(t => ({
      label: TEMPERATURA_LABELS[t] || t,
      value: contacts.filter(c => c.temperatura === t).length,
      color: t === 'FRIO' ? '#3b82f6' : t === 'MORNO' ? '#f59e0b' : '#ef4444',
    }));

    const byOrigin = Object.keys(ORIGEM_LABELS).map(o => ({
      label: (ORIGEM_LABELS as any)[o] || o,
      value: contacts.filter(c => c.origem === o).length,
      color: '#8b5cf6',
    })).filter(o => o.value > 0);

    const recentList = recentContacts.slice(0, 8).map(c => ({
      id: c.id,
      title: c.name,
      subtitle: c.company || c.email || '',
      badge: c.status,
      badgeColor: 'bg-purple-800/30 text-purple-300/60',
    }));

    const meetingList = meetings
      .filter(m => new Date(m.meeting_at) >= now)
      .sort((a: any, b: any) => new Date(a.meeting_at).getTime() - new Date(b.meeting_at).getTime())
      .slice(0, 8)
      .map((m: any) => ({
        id: m.id,
        title: m.title,
        subtitle: new Date(m.meeting_at).toLocaleDateString('pt-BR'),
      }));

    return { total: contacts.length, newThisMonth, meetingsThisMonth, interactionsThisMonth, conversionRate, byStage, byTemp, byOrigin, recentList, meetingList };
  }, [contacts, interactions, meetings, recentContacts, stages]);

  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case 'total-contacts':
        return <KpiWidget value={stats.total} subtitle="no pipeline" color="text-emerald-400" />;
      case 'new-contacts-month':
        return <KpiWidget value={stats.newThisMonth} subtitle="este mes" color="text-blue-400" />;
      case 'meetings-month':
        return <KpiWidget value={stats.meetingsThisMonth} subtitle="reunioes" color="text-cyan-400" />;
      case 'interactions-month':
        return <KpiWidget value={stats.interactionsThisMonth} subtitle="interacoes" color="text-amber-400" />;
      case 'conversion-rate':
        return <KpiWidget value={`${stats.conversionRate}%`} subtitle="convertidos" color="text-emerald-400" />;
      case 'contacts-by-stage':
        return <ChartWidget bars={stats.byStage} />;
      case 'contacts-by-temperature':
        return <ChartWidget bars={stats.byTemp} />;
      case 'contacts-by-origin':
        return <ChartWidget bars={stats.byOrigin} />;
      case 'recent-contacts':
        return <ListWidget items={stats.recentList} emptyMessage="Nenhum contato recente" />;
      case 'upcoming-meetings':
        return <ListWidget items={stats.meetingList} emptyMessage="Nenhuma reuniao proxima" />;
      case 'team-ranking':
        return <RankingWidget entries={teamData} />;
      case 'quick-actions':
        return <QuickActionsWidget />;
      default:
        return <p className="text-xs text-purple-300/30">Widget desconhecido</p>;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={`bg-[#1e0f35] border border-purple-800/30 rounded-xl p-6 animate-pulse ${i > 4 ? 'col-span-2' : ''}`}>
            <div className="h-4 bg-purple-800/30 rounded w-1/2 mb-3" />
            <div className="h-8 bg-purple-800/20 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (editMode) saveLayout();
              setEditMode(!editMode);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              editMode
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
                : 'text-purple-300/60 border-purple-800/30 hover:text-emerald-400 hover:border-emerald-500/30'
            }`}
          >
            {editMode ? 'Salvar Layout' : 'Personalizar'}
          </button>
          {editMode && (
            <>
              <button
                onClick={() => setShowCatalog(true)}
                className="px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 transition-colors"
              >
                + Widget
              </button>
              <button
                onClick={resetLayout}
                className="px-3 py-1.5 text-xs font-medium text-red-400/60 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                Resetar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-4">
        {layout.map(item => {
          const def = getWidgetDef(item.widgetId);
          if (!def) return null;
          return (
            <div
              key={item.widgetId}
              className={`${item.w >= 2 ? 'col-span-2' : 'col-span-1'}`}
              style={{ minHeight: item.h > 1 ? `${item.h * 120}px` : undefined }}
            >
              <WidgetWrapper
                title={def.name}
                editMode={editMode}
                onRemove={() => removeWidget(item.widgetId)}
                className="h-full"
              >
                {renderWidget(item.widgetId)}
              </WidgetWrapper>
            </div>
          );
        })}
      </div>

      {/* Catalog modal */}
      {showCatalog && (
        <WidgetCatalog
          currentLayout={layout}
          onAdd={(id) => { addWidget(id); setShowCatalog(false); }}
          onClose={() => setShowCatalog(false)}
        />
      )}
    </div>
  );
}
