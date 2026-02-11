'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface InteractionTypeData {
  name: string;
  count: number;
}

interface InteractionsByTypeChartProps {
  data: InteractionTypeData[];
}

export default function InteractionsByTypeChart({ data }: InteractionsByTypeChartProps) {
  const filtered = data.filter((d) => d.count > 0);

  if (filtered.length === 0) {
    return (
      <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
        <h3 className="text-sm font-medium text-emerald-400 mb-4">Interações por Tipo</h3>
        <p className="text-sm text-purple-300/40 text-center py-10">Nenhum dado disponível</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
      <h3 className="text-sm font-medium text-emerald-400 mb-4">Interações por Tipo</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filtered} layout="vertical" barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#c4b5fd' }}
              axisLine={{ stroke: 'rgba(139,92,246,0.2)' }}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#c4b5fd' }}
              axisLine={{ stroke: 'rgba(139,92,246,0.2)' }}
              tickLine={false}
              width={100}
            />
            <Tooltip
              contentStyle={{
                fontSize: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(139,92,246,0.3)',
                backgroundColor: '#1e0f35',
                color: '#e9d5ff',
              }}
              formatter={(value: any) => [value, 'Interações']}
            />
            <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
