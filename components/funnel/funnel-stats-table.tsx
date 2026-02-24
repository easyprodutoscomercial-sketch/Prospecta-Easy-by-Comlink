'use client';

interface FunnelStageData {
  id: string;
  name: string;
  color: string;
  count: number;
  percentage: number;
  avgDaysInStage: number;
}

interface FunnelStatsTableProps {
  stages: FunnelStageData[];
}

export function FunnelStatsTable({ stages }: FunnelStatsTableProps) {
  if (stages.length === 0) return null;

  // Compute conversion rates between pairs of stages
  const conversions: { from: string; to: string; rate: number }[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const fromCount = stages[i].count;
    const toCount = stages[i + 1].count;
    const rate = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
    conversions.push({
      from: stages[i].name,
      to: stages[i + 1].name,
      rate,
    });
  }

  return (
    <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-purple-800/20">
        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Conversao entre Estagios</h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-[10px] text-purple-300/50 uppercase">
            <th className="text-left px-5 py-2 font-medium">De</th>
            <th className="text-left px-5 py-2 font-medium">Para</th>
            <th className="text-right px-5 py-2 font-medium">Taxa</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-purple-800/15">
          {conversions.map((c, i) => (
            <tr key={i} className="hover:bg-purple-800/10 transition-colors">
              <td className="px-5 py-2.5 text-xs text-neutral-200">{c.from}</td>
              <td className="px-5 py-2.5 text-xs text-neutral-200 flex items-center gap-1">
                <svg className="w-3 h-3 text-purple-300/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                {c.to}
              </td>
              <td className="px-5 py-2.5 text-right">
                <span className={`text-xs font-bold ${c.rate >= 50 ? 'text-emerald-400' : c.rate >= 25 ? 'text-amber-400' : 'text-red-400'}`}>
                  {c.rate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Average time in stage */}
      <div className="px-5 py-3 border-t border-purple-800/20">
        <h4 className="text-[10px] text-purple-300/40 font-medium uppercase mb-2">Tempo Medio no Estagio</h4>
        <div className="flex gap-2 flex-wrap">
          {stages.map(s => (
            <div key={s.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-800/20 rounded-lg">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] text-neutral-300 font-medium">{s.name}</span>
              <span className="text-[10px] font-bold text-purple-300/60">{s.avgDaysInStage}d</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
