'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ActivityTimelineChartProps {
  data: { date: string; count: number }[];
}

export function ActivityTimelineChart({ data }: ActivityTimelineChartProps) {
  if (data.length === 0) return <p className="text-xs text-purple-300/40 py-4">Sem dados</p>;

  return (
    <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-4">
      <h3 className="text-sm font-medium text-neutral-100 mb-3">Atividades por Dia</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: '#a78bfa' }}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis tick={{ fontSize: 10, fill: '#a78bfa' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e0f35', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <Area type="monotone" dataKey="count" stroke="#10b981" fill="url(#activityGrad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
