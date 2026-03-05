'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#10b981', '#059669', '#047857', '#065f46', '#064e3b'];

interface PcTopFornecedoresChartProps {
  data: { name: string; count: number }[];
}

export default function PcTopFornecedoresChart({ data }: PcTopFornecedoresChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-[#1e0f35] border border-purple-800/20 rounded-xl p-5">
        <h3 className="text-sm font-medium text-neutral-300 mb-4">Top Fornecedores</h3>
        <div className="flex items-center justify-center h-48 text-neutral-500 text-sm">Sem dados</div>
      </div>
    );
  }

  // Truncate long names
  const chartData = data.map((d) => ({
    ...d,
    displayName: d.name.length > 20 ? d.name.substring(0, 18) + '...' : d.name,
  }));

  return (
    <div className="bg-[#1e0f35] border border-purple-800/20 rounded-xl p-5">
      <h3 className="text-sm font-medium text-neutral-300 mb-4">Top Fornecedores</h3>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 32)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: '#a78bfa' }} />
          <YAxis type="category" dataKey="displayName" tick={{ fontSize: 10, fill: '#a78bfa' }} width={130} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e0f35',
              border: '1px solid rgba(147,51,234,0.2)',
              borderRadius: '8px',
              color: '#e5e5e5',
              fontSize: '12px',
            }}
            formatter={(value: any, _name: any, props: any) => [value, props.payload.name]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
