'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface PcResponseChartProps {
  responderam: number;
  naoResponderam: number;
}

const COLORS = ['#10b981', '#ef4444'];

export default function PcResponseChart({ responderam, naoResponderam }: PcResponseChartProps) {
  const total = responderam + naoResponderam;
  const data = [
    { name: 'Respondeu', value: responderam },
    { name: 'Nao Respondeu', value: naoResponderam },
  ];

  return (
    <div className="bg-[#1e0f35] border border-purple-800/20 rounded-xl p-5">
      <h3 className="text-sm font-medium text-neutral-300 mb-4">Respostas Cotacoes</h3>

      {total === 0 ? (
        <div className="flex items-center justify-center h-48 text-neutral-500 text-sm">
          Sem dados
        </div>
      ) : (
        <div className="relative h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e0f35',
                  border: '1px solid rgba(147, 51, 234, 0.2)',
                  borderRadius: '8px',
                  color: '#e5e5e5',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{total}</p>
              <p className="text-xs text-neutral-400">Total</p>
            </div>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="flex justify-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-neutral-400">Respondeu ({responderam})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-xs text-neutral-400">Nao Respondeu ({naoResponderam})</span>
          </div>
        </div>
      )}
    </div>
  );
}
