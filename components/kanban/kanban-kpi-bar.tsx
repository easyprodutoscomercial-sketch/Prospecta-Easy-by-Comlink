'use client';

import { useMemo } from 'react';
import type { Contact, PipelineStage } from '@/lib/types';

interface KpiData {
  totalValue: number;
  activeCount: number;
  conversionRate: number;
  convertidos: number;
  perdidos: number;
  noOwner: number;
}

interface KanbanKpiBarProps {
  kpis: KpiData;
  funnelStages: PipelineStage[];
  grouped: Record<string, Contact[]>;
  expanded: boolean;
  onToggle: () => void;
}

export function KanbanKpiBar({ kpis, funnelStages, grouped, expanded, onToggle }: KanbanKpiBarProps) {
  if (!expanded) {
    // === COMPACT MODE: single line ===
    return (
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6 py-2 border-b border-purple-500/10 bg-[#120826]/40 overflow-x-auto">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <span className="text-xs font-bold text-emerald-400 shrink-0">
            {kpis.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
          </span>
          <span className="w-px h-4 bg-purple-800/30 shrink-0" />
          <span className="text-xs text-neutral-300 shrink-0">
            <span className="font-bold">{kpis.activeCount}</span>
            <span className="text-purple-300/40 ml-1 hidden sm:inline">ativos</span>
          </span>
          <span className="w-px h-4 bg-purple-800/30 shrink-0" />
          <span className="text-xs text-neutral-300 shrink-0">
            <span className="font-bold">{kpis.conversionRate}%</span>
            <span className="text-purple-300/40 ml-1 hidden sm:inline">conv</span>
          </span>
          {kpis.noOwner > 0 && (
            <>
              <span className="w-px h-4 bg-purple-800/30 shrink-0" />
              <span className="text-xs text-amber-400 font-bold shrink-0">
                {kpis.noOwner}
                <span className="text-amber-400/50 ml-1 font-normal hidden sm:inline">sem resp</span>
              </span>
            </>
          )}
        </div>
        <button
          onClick={onToggle}
          className="text-[10px] text-purple-300/40 hover:text-purple-200 transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Expandir
        </button>
      </div>
    );
  }

  // === EXPANDED MODE: full KPI grid ===
  return (
    <div className="px-4 lg:px-6 py-3 border-b border-purple-500/10 bg-[#120826]/40">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-purple-300/30 uppercase tracking-wider font-medium">KPIs do Pipeline</span>
        <button
          onClick={onToggle}
          className="text-[10px] text-purple-300/40 hover:text-purple-200 transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          Compactar
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20">
          <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium">Valor no Pipeline</p>
          <p className="text-lg font-bold text-emerald-400 mt-0.5">
            {kpis.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20">
          <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium">Contatos Ativos</p>
          <p className="text-lg font-bold text-white mt-0.5">{kpis.activeCount}</p>
        </div>
        <div className="bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20">
          <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium">Taxa Conversao</p>
          <div className="flex items-end gap-2 mt-0.5">
            <p className="text-lg font-bold text-white">{kpis.conversionRate}%</p>
            <p className="text-[10px] text-purple-300/30 pb-0.5">{kpis.convertidos}W / {kpis.perdidos}L</p>
          </div>
        </div>
        <div className="bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20">
          <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium">Sem Responsavel</p>
          <p className={`text-lg font-bold mt-0.5 ${kpis.noOwner > 0 ? 'text-amber-400' : 'text-white'}`}>{kpis.noOwner}</p>
        </div>
        <div className="hidden lg:flex bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20 items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium mb-1.5">Funil</p>
            <div className="flex flex-col items-center gap-[2px]">
              {funnelStages.map((stage, i) => {
                const count = grouped[stage.id]?.length || 0;
                const total = funnelStages.length;
                const widthPct = 100 - (i / total) * 60;
                return (
                  <div
                    key={stage.id}
                    className="flex items-center justify-center relative transition-all"
                    style={{
                      width: `${widthPct}%`,
                      height: '14px',
                      backgroundColor: `${stage.color}25`,
                      borderLeft: `2px solid ${stage.color}50`,
                      borderRight: `2px solid ${stage.color}50`,
                      borderTop: i === 0 ? `2px solid ${stage.color}50` : 'none',
                      borderBottom: i === total - 1 ? `2px solid ${stage.color}50` : 'none',
                      borderRadius: i === 0 ? '4px 4px 0 0' : i === total - 1 ? '0 0 3px 3px' : '0',
                    }}
                    title={`${stage.name}: ${count}`}
                  >
                    <span className="text-[7px] font-bold" style={{ color: stage.color }}>
                      {stage.name} ({count})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
