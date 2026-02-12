'use client';

import { RiskLevel } from '@/lib/ai/types';

const LEVEL_STYLES: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Critico' },
  HIGH: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Alto' },
  MEDIUM: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Medio' },
  LOW: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Baixo' },
};

interface RiskBadgeProps {
  level: RiskLevel;
  compact?: boolean;
}

export default function RiskBadge({ level, compact }: RiskBadgeProps) {
  const style = LEVEL_STYLES[level];

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${style.bg} ${style.text}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {style.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${style.bg} ${style.text}`}>
      <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
      Risco {style.label}
    </span>
  );
}
