'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TeamMember {
  name: string;
  contacts: number;
  interactions: number;
  meetings: number;
  conversions: number;
}

interface TeamComparisonChartProps {
  data: TeamMember[];
}

export default function TeamComparisonChart({ data }: TeamComparisonChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-medium text-neutral-900 mb-4">Comparativo da Equipe</h3>
        <p className="text-sm text-neutral-400 text-center py-10">Nenhum dado disponível</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-5 shadow-sm">
      <h3 className="text-sm font-medium text-neutral-900 mb-4">Comparativo da Equipe</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#737373' }}
              axisLine={{ stroke: '#e5e5e5' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#737373' }}
              axisLine={{ stroke: '#e5e5e5' }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: '12px',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                boxShadow: 'none',
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px' }}
            />
            <Bar dataKey="contacts" name="Contatos" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            <Bar dataKey="interactions" name="Interações" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            <Bar dataKey="meetings" name="Reuniões" fill="#22c55e" radius={[2, 2, 0, 0]} />
            <Bar dataKey="conversions" name="Conversões" fill="#10b981" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
