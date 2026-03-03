'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const TEMP_COLORS: Record<string, string> = {
  QUENTE: '#ef4444',
  MORNO: '#f59e0b',
  FRIO: '#3b82f6',
  SEM: '#6b7280',
};

const ORIGIN_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#a855f7'];

interface DistributionChartsProps {
  temperatureData: { name: string; value: number }[];
  originData: { name: string; value: number }[];
}

export function DistributionCharts({ temperatureData, originData }: DistributionChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Temperature */}
      <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-neutral-100 mb-3">Distribuicao por Temperatura</h3>
        {temperatureData.length === 0 ? (
          <p className="text-xs text-purple-300/40 py-4">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={temperatureData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, value }) => `${name}: ${value}`}>
                {temperatureData.map((entry) => (
                  <Cell key={entry.name} fill={TEMP_COLORS[entry.name] || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e0f35', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Origin */}
      <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-neutral-100 mb-3">Distribuicao por Origem</h3>
        {originData.length === 0 ? (
          <p className="text-xs text-purple-300/40 py-4">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={originData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, value }) => `${name}: ${value}`}>
                {originData.map((_, idx) => (
                  <Cell key={idx} fill={ORIGIN_COLORS[idx % ORIGIN_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e0f35', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
