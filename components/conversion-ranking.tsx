'use client';

interface RankingEntry {
  name: string;
  conversions: number;
  total_interactions: number;
  conversion_rate: number;
}

interface ConversionRankingProps {
  data: RankingEntry[];
}

export default function ConversionRanking({ data }: ConversionRankingProps) {
  const sorted = [...data].sort((a, b) => b.conversions - a.conversions || b.conversion_rate - a.conversion_rate);

  return (
    <div className="bg-white rounded-lg p-5 shadow-sm">
      <h3 className="text-sm font-medium text-neutral-900 mb-4">Ranking por Conversão</h3>

      {sorted.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-10">Nenhum dado disponível</p>
      ) : (
        <div className="overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wide pb-2 pr-2">#</th>
                <th className="text-left text-[10px] font-medium text-neutral-500 uppercase tracking-wide pb-2">Membro</th>
                <th className="text-center text-[10px] font-medium text-neutral-500 uppercase tracking-wide pb-2">Conversões</th>
                <th className="text-center text-[10px] font-medium text-neutral-500 uppercase tracking-wide pb-2">Interações</th>
                <th className="text-right text-[10px] font-medium text-neutral-500 uppercase tracking-wide pb-2">Taxa</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, idx) => {
                const medal = idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-neutral-400' : idx === 2 ? 'text-orange-400' : 'text-neutral-300';
                return (
                  <tr key={entry.name} className="border-b border-neutral-50 last:border-0">
                    <td className={`py-2.5 pr-2 text-sm font-bold ${medal}`}>{idx + 1}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center text-[9px] font-semibold text-neutral-600 shrink-0">
                          {entry.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <span className="text-sm text-neutral-900 truncate">{entry.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-center">
                      <span className="text-sm font-semibold text-emerald-600">{entry.conversions}</span>
                    </td>
                    <td className="py-2.5 text-center">
                      <span className="text-sm text-neutral-600">{entry.total_interactions}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="text-sm font-medium text-neutral-700">{entry.conversion_rate}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
