'use client';

interface ResponseRateCardProps {
  responded: number;
  noResponse: number;
  total: number;
}

export default function ResponseRateCard({ responded, noResponse, total }: ResponseRateCardProps) {
  const rate = total > 0 ? Math.round((responded / total) * 100) : 0;
  const noResponseRate = total > 0 ? Math.round((noResponse / total) * 100) : 0;

  return (
    <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
      <h3 className="text-sm font-medium text-emerald-400 mb-4">Taxa de Resposta</h3>

      {total === 0 ? (
        <p className="text-sm text-purple-300/40 text-center py-10">Nenhum dado disponível</p>
      ) : (
        <div className="space-y-4">
          {/* Big rate */}
          <div className="text-center py-2">
            <p className="text-4xl font-bold text-neutral-100">{rate}%</p>
            <p className="text-xs text-purple-300/60 mt-1">dos contatos responderam</p>
          </div>

          {/* Bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-purple-300/60">Responderam</span>
                <span className="text-xs font-semibold text-emerald-400">{responded}</span>
              </div>
              <div className="w-full bg-purple-800/30 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${rate}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-purple-300/60">Sem resposta</span>
                <span className="text-xs font-semibold text-red-500">{noResponse}</span>
              </div>
              <div className="w-full bg-purple-800/30 rounded-full h-2">
                <div className="bg-red-400 h-2 rounded-full transition-all" style={{ width: `${noResponseRate}%` }} />
              </div>
            </div>
          </div>

          <p className="text-[10px] text-purple-300/40 text-center">{total} interações no total</p>
        </div>
      )}
    </div>
  );
}
