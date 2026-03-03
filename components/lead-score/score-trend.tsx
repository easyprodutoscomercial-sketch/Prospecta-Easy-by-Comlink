'use client';

interface ScoreTrendProps {
  delta: number;
}

export function ScoreTrend({ delta }: ScoreTrendProps) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-300/40">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
        estavel
      </span>
    );
  }

  const isUp = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
      isUp ? 'text-emerald-400' : 'text-red-400'
    }`}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={isUp ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
        />
      </svg>
      {isUp ? '+' : ''}{delta}
    </span>
  );
}
