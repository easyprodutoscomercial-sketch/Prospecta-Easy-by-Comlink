'use client';

import { useState, useEffect } from 'react';

interface BugStats {
  by_status: Record<string, number>;
  by_severity: Record<string, number>;
  total: number;
}

export default function BugStatsCards() {
  const [stats, setStats] = useState<BugStats | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/bugs/stats');
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

  const cards = [
    { label: 'Abertos', value: stats.by_status?.ABERTO || 0, color: 'text-red-400', bg: 'bg-red-500/10', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' },
    { label: 'Em Progresso', value: (stats.by_status?.EM_ANALISE || 0) + (stats.by_status?.CORRIGINDO || 0), color: 'text-blue-400', bg: 'bg-blue-500/10', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { label: 'Em Teste', value: stats.by_status?.TESTE || 0, color: 'text-purple-400', bg: 'bg-purple-500/10', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Resolvidos', value: stats.by_status?.RESOLVIDO || 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: 'M5 13l4 4L19 7' },
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
