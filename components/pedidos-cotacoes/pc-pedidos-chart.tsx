'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const SITUACAO_COLORS: Record<string, string> = {
  PENDENTE: '#f59e0b',
  ACEITO: '#10b981',
  RECUSADO: '#ef4444',
  EM_ANDAMENTO: '#3b82f6',
};

const SITUACAO_LABELS: Record<string, string> = {
  PENDENTE: 'Pendente',
  ACEITO: 'Aceito',
  RECUSADO: 'Recusado',
  EM_ANDAMENTO: 'Em Andamento',
};

interface PcPedidosChartProps {
  pedidosBySituacao: Record<string, number>;
}

export default function PcPedidosChart({ pedidosBySituacao }: PcPedidosChartProps) {
  const data = Object.entries(pedidosBySituacao).map(([key, value]) => ({
    name: SITUACAO_LABELS[key] || key,
    value,
    key,
  }));

  if (data.length === 0) {
    return (
      <div className="bg-[#1e0f35] border border-purple-800/20 rounded-xl p-5">
        <h3 className="text-sm font-medium text-neutral-300 mb-4">Pedidos por Situacao</h3>
        <div className="flex items-center justify-center h-48 text-neutral-500 text-sm">Sem dados</div>
      </div>
    );
  }

  return (
    <div className="bg-[#1e0f35] border border-purple-800/20 rounded-xl p-5">
      <h3 className="text-sm font-medium text-neutral-300 mb-4">Pedidos por Situacao</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: '#a78bfa' }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#a78bfa' }} width={100} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e0f35',
              border: '1px solid rgba(147,51,234,0.2)',
              borderRadius: '8px',
              color: '#e5e5e5',
              fontSize: '12px',
            }}
            formatter={(value: any) => [value, 'Pedidos']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={SITUACAO_COLORS[entry.key] || '#8b5cf6'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
