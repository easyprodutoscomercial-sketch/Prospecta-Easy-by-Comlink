'use client';

import type { ScoreBreakdown } from '@/lib/utils/lead-score';

const DIMENSION_CONFIG: { key: keyof ScoreBreakdown; label: string; max: number; color: string }[] = [
  { key: 'temperatura', label: 'Temperatura', max: 20, color: '#f97316' },
  { key: 'valor_estimado', label: 'Valor Estimado', max: 15, color: '#10b981' },
  { key: 'pipeline_progress', label: 'Progresso Pipeline', max: 15, color: '#3b82f6' },
  { key: 'engagement', label: 'Engajamento', max: 15, color: '#8b5cf6' },
  { key: 'recency', label: 'Recencia', max: 10, color: '#06b6d4' },
  { key: 'completeness', label: 'Completude', max: 10, color: '#ec4899' },
  { key: 'next_action', label: 'Proxima Acao', max: 10, color: '#eab308' },
  { key: 'profile_quality', label: 'Perfil', max: 5, color: '#a855f7' },
];

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdown;
}

export function ScoreBreakdownChart({ breakdown }: ScoreBreakdownProps) {
  return (
    <div className="space-y-2">
      {DIMENSION_CONFIG.map(({ key, label, max, color }) => {
        const value = breakdown[key];
        const pct = Math.round((value / max) * 100);
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] text-purple-300/60 w-24 truncate">{label}</span>
            <div className="flex-1 h-2 bg-purple-800/20 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-[10px] font-mono text-purple-300/50 w-8 text-right">
              {value}/{max}
            </span>
          </div>
        );
      })}
    </div>
  );
}
