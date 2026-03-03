'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#3b82f6', '#06b6d4'];

interface LostDealsChartProps {
  data: { stage_id: string; count: number }[];
}

export function LostDealsChart({ data }: LostDealsChartProps) {
  if (data.length === 0) return <p className="text-xs text-purple-300/40 py-4">Sem dados</p>;

  return (
    <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-4">
      <h3 className="text-sm font-medium text-neutral-100 mb-3">Deals Perdidos por Etapa</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="stage_id" cx="50%" cy="50%" outerRadius={70} label={(entry: any) => `${entry.stage_id}: ${entry.count}`}>
            {data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: '#1e0f35', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
