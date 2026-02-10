'use client';

import { useEffect, useState } from 'react';
import { LeaderboardEntry } from '@/lib/types';

const METRICS = [
  { key: 'contacts_created' as const, label: 'Contatos', color: 'bg-blue-500' },
  { key: 'interactions_count' as const, label: 'Interações', color: 'bg-amber-500' },
  { key: 'meetings_count' as const, label: 'Reuniões', color: 'bg-green-500' },
  { key: 'conversions_count' as const, label: 'Conversões', color: 'bg-emerald-500' },
];

export default function LeaderboardWidget() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setEntries(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Max values per metric for bar scaling
  const maxValues = METRICS.reduce((acc, m) => {
    acc[m.key] = Math.max(...entries.map((e) => e[m.key]), 1);
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-medium text-neutral-900 mb-4">Desempenho da Equipe</h3>
        <p className="text-sm text-neutral-400 text-center py-6">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-medium text-neutral-900">Desempenho da Equipe</h3>
        <span className="text-xs text-neutral-400">Este mês</span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-6">Nenhum dado disponível</p>
      ) : (
        <div className="space-y-5">
          {entries.map((entry) => (
            <div key={entry.user_id}>
              {/* User header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center text-[10px] font-semibold text-neutral-600 shrink-0">
                  {entry.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <span className="text-sm font-medium text-neutral-900 truncate">{entry.name}</span>
              </div>

              {/* Metric bars */}
              <div className="grid grid-cols-4 gap-2 pl-9">
                {METRICS.map((m) => {
                  const val = entry[m.key];
                  const pct = maxValues[m.key] > 0 ? (val / maxValues[m.key]) * 100 : 0;
                  return (
                    <div key={m.key}>
                      <div className="flex items-baseline justify-between mb-0.5">
                        <span className="text-[10px] text-neutral-500">{m.label}</span>
                        <span className="text-xs font-semibold text-neutral-700">{val}</span>
                      </div>
                      <div className="w-full bg-neutral-100 rounded-full h-1.5">
                        <div
                          className={`${m.color} h-1.5 rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
