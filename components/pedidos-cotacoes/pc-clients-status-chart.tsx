'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  SIM: '#10b981',
  NAO: '#ef4444',
  AGUARDANDO_ACEITE: '#f59e0b',
  PRE_CADASTRO: '#8b5cf6',
};

const STATUS_LABELS: Record<string, string> = {
  SIM: 'Aprovado',
  NAO: 'Reprovado',
  AGUARDANDO_ACEITE: 'Aguardando',
  PRE_CADASTRO: 'Pre-cadastro',
};

interface PcClientsStatusChartProps {
  clientsByStatus: Record<string, number>;
}

export default function PcClientsStatusChart({ clientsByStatus }: PcClientsStatusChartProps) {
  const data = Object.entries(clientsByStatus).map(([key, value]) => ({
    name: STATUS_LABELS[key] || key,
    value,
    key,
  }));

  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="bg-[#1e0f35] border border-purple-800/20 rounded-xl p-5">
      <h3 className="text-sm font-medium text-neutral-300 mb-4">Clientes por Status</h3>

      {total === 0 ? (
        <div className="flex items-center justify-center h-48 text-neutral-500 text-sm">Sem dados</div>
      ) : (
        <>
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
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.key] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e0f35',
                    border: '1px solid rgba(147,51,234,0.2)',
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
                <p className="text-xs text-neutral-400">Clientes</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mt-3">
            {data.map((entry) => (
              <div key={entry.key} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[entry.key] || '#6b7280' }}
                />
                <span className="text-xs text-neutral-400">
                  {entry.name} ({entry.value})
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
