'use client';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface StatusData {
  name: string;
  value: number;
  color: string;
}

interface MonthlyData {
  month: string;
  count: number;
}

interface DashboardChartsProps {
  statusData: StatusData[];
  monthlyData: MonthlyData[];
}

export default function DashboardCharts({ statusData, monthlyData }: DashboardChartsProps) {
  const hasStatusData = statusData.some((d) => d.value > 0);
  const hasMonthlyData = monthlyData.some((d) => d.count > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Status pie chart */}
      <div className="bg-white rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-medium text-neutral-900 mb-4">Contatos por Status</h3>
        {hasStatusData ? (
          <div className="flex items-center gap-4">
            <div className="w-48 h-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData.filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData
                      .filter((d) => d.value > 0)
                      .map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: '1px solid #e5e5e5',
                      boxShadow: 'none',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {statusData
                .filter((d) => d.value > 0)
                .map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-neutral-600">
                      {item.name} ({item.value})
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-400 py-10 text-center">Nenhum dado disponível</p>
        )}
      </div>

      {/* Monthly bar chart */}
      <div className="bg-white rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-medium text-neutral-900 mb-4">Contatos por Mês</h3>
        {hasMonthlyData ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis
                  dataKey="month"
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
                  formatter={(value: any) => [value, 'Contatos']}
                />
                <Bar dataKey="count" fill="#171717" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-neutral-400 py-10 text-center">Nenhum dado disponível</p>
        )}
      </div>
    </div>
  );
}
