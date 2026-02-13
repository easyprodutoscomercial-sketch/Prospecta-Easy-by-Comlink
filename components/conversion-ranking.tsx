'use client';

interface RankingEntry {
  name: string;
  avatar_url: string | null;
  conversions: number;
  total_interactions: number;
  conversion_rate: number;
}

interface ConversionRankingProps {
  data: RankingEntry[];
}

export default function ConversionRanking({ data }: ConversionRankingProps) {
  const sorted = [...data].sort((a, b) => b.conversions - a.conversions || b.conversion_rate - a.conversion_rate);
  const maxConversions = sorted.length > 0 ? sorted[0].conversions : 1;

  if (sorted.length === 0) {
    return (
      <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
        <h3 className="text-sm font-medium text-emerald-400 mb-4">Ranking por Conversão</h3>
        <p className="text-sm text-purple-300/40 text-center py-10">Nenhum dado disponível</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
      <div className="flex items-start justify-between mb-5 gap-4">
        <h3 className="text-sm font-medium text-emerald-400">Ranking por Conversão</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-purple-300/40 font-medium">Pontuação:</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-bold">10 Contatos = 0.5 pt</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold">Interação = 1.5 pt</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-bold">Reunião = 2 pts</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">Conversão = 4 pts</span>
        </div>
      </div>

      {/* Pódio top 3 */}
      {sorted.length >= 2 && (
        <div className="flex items-end justify-center gap-3 mb-6">
          {/* 2o lugar */}
          {sorted[1] && (
            <PodiumSlot entry={sorted[1]} position={2} height="h-20" />
          )}
          {/* 1o lugar */}
          {sorted[0] && (
            <PodiumSlot entry={sorted[0]} position={1} height="h-28" />
          )}
          {/* 3o lugar */}
          {sorted[2] && (
            <PodiumSlot entry={sorted[2]} position={3} height="h-14" />
          )}
        </div>
      )}

      {/* Lista corrida — todos competindo */}
      <div className="space-y-2.5">
        {sorted.map((entry, idx) => {
          const isFirst = idx === 0;
          const barWidth = maxConversions > 0 ? Math.max((entry.conversions / maxConversions) * 100, 4) : 4;
          const initials = entry.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

          return (
            <div key={entry.name} className="flex items-center gap-3">
              {/* Position */}
              <span className={`text-sm font-bold w-5 text-center shrink-0 ${
                idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-neutral-400' : idx === 2 ? 'text-orange-400' : 'text-purple-300/30'
              }`}>
                {idx + 1}
              </span>

              {/* Avatar */}
              <div className={`shrink-0 rounded-full overflow-hidden ${isFirst ? 'avatar-winner w-10 h-10' : idx < 3 ? 'w-8 h-8' : 'avatar-sad w-8 h-8'}`}>
                {entry.avatar_url ? (
                  <img
                    src={entry.avatar_url}
                    alt={entry.name}
                    className={`object-cover rounded-full ${isFirst ? 'w-10 h-10' : 'w-8 h-8'}`}
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

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-xs font-semibold truncate ${isFirst ? 'text-emerald-400' : 'text-neutral-200'}`}>
                    {entry.name}
                  </span>
                  <span className={`text-xs font-bold ml-2 shrink-0 ${isFirst ? 'text-emerald-400' : 'text-purple-300/50'}`}>
                    {entry.conversions}
                  </span>
                </div>
                {/* Progress bar — corrida visual */}
                <div className="h-2 bg-purple-900/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      isFirst
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        : idx === 1
                        ? 'bg-gradient-to-r from-purple-500 to-purple-400'
                        : idx === 2
                        ? 'bg-gradient-to-r from-orange-500 to-orange-400'
                        : 'bg-purple-700/40'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>

              {/* Rate */}
              <span className={`text-xs font-medium shrink-0 ${isFirst ? 'text-emerald-400' : 'text-purple-300/40'}`}>
                {entry.conversion_rate}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Pódio slot — visual de pódio com foto */
function PodiumSlot({ entry, position, height }: { entry: RankingEntry; position: 1 | 2 | 3; height: string }) {
  const initials = entry.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const podiumColors = {
    1: 'from-emerald-500 to-emerald-600 border-emerald-400/40',
    2: 'from-purple-500 to-purple-600 border-purple-400/40',
    3: 'from-orange-500 to-orange-600 border-orange-400/40',
  };
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const avatarSize = position === 1 ? 'w-14 h-14' : 'w-11 h-11';

  return (
    <div className="flex flex-col items-center gap-1.5 w-24">
      {/* Medal */}
      <span className="text-lg">{medals[position]}</span>

      {/* Avatar */}
      <div className={`${avatarSize} rounded-full overflow-hidden ${position === 1 ? 'avatar-winner' : ''}`}>
        {entry.avatar_url ? (
          <img
            src={entry.avatar_url}
            alt={entry.name}
            className={`${avatarSize} object-cover rounded-full`}
          />
        ) : (
          <div
            className={`${avatarSize} flex items-center justify-center font-bold text-white rounded-full bg-gradient-to-br ${podiumColors[position].split(' ').slice(0, 2).join(' ')}`}
          >
            {initials}
          </div>
        )}
      </div>

      {/* Name */}
      <span className={`text-[10px] font-bold text-center truncate w-full ${
        position === 1 ? 'text-emerald-400' : position === 2 ? 'text-purple-300' : 'text-orange-300'
      }`}>
        {entry.name.split(' ')[0]}
      </span>

      {/* Podium block */}
      <div className={`${height} w-full rounded-t-lg bg-gradient-to-t ${podiumColors[position]} border border-b-0 flex items-center justify-center`}>
        <span className="text-white font-black text-lg">{entry.conversions}</span>
      </div>
    </div>
  );
}
