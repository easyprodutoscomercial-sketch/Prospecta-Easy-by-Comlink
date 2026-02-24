'use client';

interface RankingEntry {
  name: string;
  score: number;
  avatar?: string;
}

interface RankingWidgetProps {
  entries: RankingEntry[];
}

export function RankingWidget({ entries }: RankingWidgetProps) {
  const maxScore = Math.max(...entries.map(e => e.score), 1);
  const medals = ['🥇', '🥈', '🥉'];

  if (entries.length === 0) {
    return <p className="text-xs text-purple-300/30 text-center py-4">Sem dados de ranking</p>;
  }

  return (
    <div className="space-y-2 h-full overflow-y-auto">
      {entries.slice(0, 8).map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 text-center text-xs shrink-0">
            {i < 3 ? medals[i] : <span className="text-purple-300/30">{i + 1}</span>}
          </span>
          <div className="w-6 h-6 rounded-full bg-purple-800/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-purple-300/60">
              {entry.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-neutral-200 w-24 truncate shrink-0">{entry.name}</span>
          <div className="flex-1 bg-purple-800/20 rounded-full h-4 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500/60 transition-all duration-500"
              style={{ width: `${(entry.score / maxScore) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-emerald-400/70 w-8 text-right shrink-0">{entry.score}</span>
        </div>
      ))}
    </div>
  );
}
