'use client';

import { getScoreColor } from '@/lib/utils/lead-score';

interface ScoreBadgeProps {
  score: number | null | undefined;
  size?: 'sm' | 'md';
}

export function ScoreBadge({ score, size = 'sm' }: ScoreBadgeProps) {
  if (score == null) return null;

  const { bg, text, label } = getScoreColor(score);

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${bg} ${text}`}>
        {score}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${bg} ${text}`}>
      <span className="text-lg font-bold">{score}</span>
      <span className="text-xs font-medium opacity-80">{label}</span>
    </div>
  );
}
