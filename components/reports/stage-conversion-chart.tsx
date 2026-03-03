'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

interface StageConversionChartProps {
  data: { stage_name: string; count: number; value: number }[];
}

export function StageConversionChart({ data }: StageConversionChartProps) {
  if (data.length === 0) return <p className="text-xs text-purple-300/40 py-4">Sem dados</p>;

  return (
    <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-4">
      <h3 className="text-sm font-medium text-neutral-100 mb-3">Contatos por Etapa</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <XAxis dataKey="stage_name" tick={{ fontSize: 10, fill: '#a78bfa' }} />
          <YAxis tick={{ fontSize: 10, fill: '#a78bfa' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e0f35', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(value: any) => [value, 'Contatos']}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
