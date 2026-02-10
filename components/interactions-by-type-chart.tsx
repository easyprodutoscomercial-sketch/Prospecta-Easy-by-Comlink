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
      <div className="bg-white rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-medium text-neutral-900 mb-4">Interações por Tipo</h3>
        <p className="text-sm text-neutral-400 text-center py-10">Nenhum dado disponível</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-5 shadow-sm">
      <h3 className="text-sm font-medium text-neutral-900 mb-4">Interações por Tipo</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filtered} layout="vertical" barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#737373' }}
              axisLine={{ stroke: '#e5e5e5' }}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#737373' }}
              axisLine={{ stroke: '#e5e5e5' }}
              tickLine={false}
              width={100}
            />
            <Tooltip
              contentStyle={{
                fontSize: '12px',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                boxShadow: 'none',
              }}
              formatter={(value: any) => [value, 'Interações']}
            />
            <Bar dataKey="count" fill="#171717" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
