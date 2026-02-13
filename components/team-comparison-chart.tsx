'use client';

interface TeamMember {
  name: string;
  avatar_url: string | null;
  contacts: number;
  interactions: number;
  meetings: number;
  conversions: number;
}

interface TeamComparisonChartProps {
  data: TeamMember[];
}

const METRICS = [
  { key: 'contacts', label: 'Contatos', color: 'from-blue-500 to-blue-400', text: 'text-blue-400' },
  { key: 'interactions', label: 'Interações', color: 'from-amber-500 to-amber-400', text: 'text-amber-400' },
  { key: 'meetings', label: 'Reuniões', color: 'from-green-500 to-green-400', text: 'text-green-400' },
  { key: 'conversions', label: 'Conversões', color: 'from-emerald-500 to-emerald-400', text: 'text-emerald-400' },
] as const;

export default function TeamComparisonChart({ data }: TeamComparisonChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
        <h3 className="text-sm font-medium text-emerald-400 mb-4">Comparativo da Equipe</h3>
        <p className="text-sm text-purple-300/40 text-center py-10">Nenhum dado disponível</p>
      </div>
    );
  }

  // Find max for each metric to calculate bar widths
  const maxValues = {
    contacts: Math.max(...data.map((d) => d.contacts), 1),
    interactions: Math.max(...data.map((d) => d.interactions), 1),
    meetings: Math.max(...data.map((d) => d.meetings), 1),
    conversions: Math.max(...data.map((d) => d.conversions), 1),
  };

  // Total score for ranking
  const scored = data.map((d) => ({
    ...d,
    total: Math.round(((d.contacts / 10) * 0.5 + d.interactions * 1.5 + d.meetings * 2 + d.conversions * 4) * 10) / 10,
  })).sort((a, b) => b.total - a.total);

  return (
    <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
      <div className="flex items-start justify-between mb-4 gap-4">
        <h3 className="text-sm font-medium text-emerald-400">Comparativo da Equipe</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-purple-300/40 font-medium">Pontuação:</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-bold">10 Contatos = 0.5 pt</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold">Interação = 1.5 pt</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-bold">Reunião = 2 pts</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">Conversão = 4 pts</span>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-3 pl-7">
        {METRICS.map((m) => (
          <span key={m.key} className={`text-[10px] font-medium ${m.text}`}>{m.label}</span>
        ))}
      </div>

      <div className="space-y-4">
        {scored.map((member, idx) => {
          const isFirst = idx === 0;
          const initials = member.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

          return (
            <div
              key={member.name}
              className={`p-3 rounded-xl border transition-all ${
                isFirst
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-[#2a1245]/30 border-purple-800/15'
              }`}
            >
              {/* Header: avatar + name + position */}
              <div className="flex items-center gap-3 mb-2.5">
                <span className={`text-xs font-bold w-4 text-center ${
                  idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-neutral-400' : idx === 2 ? 'text-orange-400' : 'text-purple-300/30'
                }`}>
                  {idx + 1}
                </span>

                <div className={`shrink-0 rounded-full overflow-hidden ${isFirst ? 'avatar-winner w-10 h-10' : idx >= 3 ? 'avatar-sad w-8 h-8' : 'w-8 h-8'}`}>
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className={isFirst ? 'w-10 h-10 object-cover rounded-full' : 'w-8 h-8 object-cover rounded-full'}
                    />
                  ) : (
                    <div
                      className={`flex items-center justify-center font-bold text-white rounded-full ${
                        isFirst
                          ? 'w-10 h-10 text-sm bg-gradient-to-br from-emerald-400 to-purple-500'
                          : 'w-8 h-8 text-xs bg-purple-800/50'
                      }`}
                    >
                      {initials}
                    </div>
                  )}
                </div>

                <span className={`text-sm font-semibold truncate ${isFirst ? 'text-emerald-400' : 'text-neutral-200'}`}>
                  {member.name}
                </span>

                <span className={`text-[10px] font-bold ml-auto ${isFirst ? 'text-emerald-400' : 'text-purple-300/40'}`}>
                  {member.total} pts
                </span>

                {isFirst && (
                  <span className="text-amber-400 text-xs ml-1">👑</span>
                )}
              </div>

              {/* Metric bars */}
              <div className="grid grid-cols-4 gap-2 pl-7">
                {METRICS.map((m) => {
                  const val = member[m.key as keyof typeof member] as number;
                  const max = maxValues[m.key as keyof typeof maxValues];
                  const pct = Math.max((val / max) * 100, 3);
                  return (
                    <div key={m.key}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[10px] font-bold ${m.text}`}>{val}</span>
                      </div>
                      <div className="h-1.5 bg-purple-900/30 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${m.color} transition-all duration-1000`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
