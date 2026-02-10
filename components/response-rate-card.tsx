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
    <div className="bg-white rounded-lg p-5 shadow-sm">
      <h3 className="text-sm font-medium text-neutral-900 mb-4">Taxa de Resposta</h3>

      {total === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-10">Nenhum dado disponível</p>
      ) : (
        <div className="space-y-4">
          {/* Big rate */}
          <div className="text-center py-2">
            <p className="text-4xl font-bold text-neutral-900">{rate}%</p>
            <p className="text-xs text-neutral-500 mt-1">dos contatos responderam</p>
          </div>

          {/* Bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-neutral-600">Responderam</span>
                <span className="text-xs font-semibold text-emerald-600">{responded}</span>
              </div>
              <div className="w-full bg-neutral-100 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${rate}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-neutral-600">Sem resposta</span>
                <span className="text-xs font-semibold text-red-500">{noResponse}</span>
              </div>
              <div className="w-full bg-neutral-100 rounded-full h-2">
                <div className="bg-red-400 h-2 rounded-full transition-all" style={{ width: `${noResponseRate}%` }} />
              </div>
            </div>
          </div>

          <p className="text-[10px] text-neutral-400 text-center">{total} interações no total</p>
        </div>
      )}
    </div>
  );
}
