'use client';

import { useState, useEffect } from 'react';

interface StageInfo {
  id: string;
  name: string;
  slug: string;
  color: string;
  position: number;
  is_terminal: boolean;
  terminal_type: 'won' | 'lost' | null;
}

interface SupportStats {
  by_status: Record<string, number>;
  by_stage: Record<string, number>;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
  overdue: number;
  total: number;
  stages: StageInfo[];
}

export default function SuporteStatsCards() {
  const [stats, setStats] = useState<SupportStats | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/suporte/stats');
        if (res.ok) setStats(await res.json());
      } catch { /* silent */ }
    };
    load();
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#1e0f35] rounded-xl border border-purple-800/20 p-4 animate-pulse">
            <div className="h-3 bg-purple-800/30 rounded w-1/2 mb-2" />
            <div className="h-6 bg-purple-800/20 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  // Compute stats using stages if available
  const stages = stats.stages || [];
  const byStage = stats.by_stage || {};

  let abertos = 0;
  let emAndamento = 0;
  let resolvidos = 0;

  if (stages.length > 0) {
    stages.forEach((s) => {
      const count = byStage[s.id] || 0;
      if (s.position === 0) {
        abertos += count;
      } else if (s.is_terminal) {
        resolvidos += count;
      } else {
        emAndamento += count;
      }
    });
  } else {
    // Fallback to by_status
    abertos = stats.by_status?.ABERTO || 0;
    emAndamento = (stats.by_status?.EM_ANDAMENTO || 0) + (stats.by_status?.AGUARDANDO || 0);
    resolvidos = (stats.by_status?.RESOLVIDO || 0) + (stats.by_status?.FECHADO || 0);
  }

  const cards = [
    { label: 'Abertos', value: abertos, color: 'text-red-400', bg: 'bg-red-500/10', icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Em Andamento', value: emAndamento, color: 'text-blue-400', bg: 'bg-blue-500/10', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { label: 'Vencidos', value: stats.overdue || 0, color: 'text-amber-400', bg: 'bg-amber-500/10', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Resolvidos', value: resolvidos, color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: 'M5 13l4 4L19 7' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className={`${card.bg} rounded-xl border border-purple-800/20 p-4`}>
          <div className="flex items-center gap-2">
            <svg className={`w-4 h-4 ${card.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
            </svg>
            <span className="text-xs font-medium text-neutral-400">{card.label}</span>
          </div>
          <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
