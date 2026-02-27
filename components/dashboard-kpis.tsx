'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
} from 'recharts';
import { usePipeline } from '@/lib/pipeline-context';

interface DashboardKPIsProps {
  allContacts: any[];
  allInteractions: any[];
  monthRanges: { start: string; end: string; label: string }[];
}

const TOOLTIP_STYLE = {
  fontSize: '12px',
  borderRadius: '8px',
  border: '1px solid rgba(139,92,246,0.3)',
  backgroundColor: '#1e0f35',
  color: '#e9d5ff',
};

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.abs(b - a) / (1000 * 60 * 60 * 24);
}

export default function DashboardKPIs({
  allContacts,
  allInteractions,
  monthRanges,
}: DashboardKPIsProps) {
  const { currentPipeline } = usePipeline();
  const stages = currentPipeline?.stages || [];
  const wonStageIds = useMemo(() => new Set(stages.filter(s => s.terminal_type === 'won').map(s => s.id)), [stages]);
  const lostStageIds = useMemo(() => new Set(stages.filter(s => s.terminal_type === 'lost').map(s => s.id)), [stages]);
  const terminalStageIds = useMemo(() => new Set(stages.filter(s => s.is_terminal).map(s => s.id)), [stages]);

  const isWon = (c: any) => {
    if (wonStageIds.size > 0 && c.stage_id) return wonStageIds.has(c.stage_id);
    return c.status === 'CONVERTIDO';
  };
  const isLost = (c: any) => {
    if (lostStageIds.size > 0 && c.stage_id) return lostStageIds.has(c.stage_id);
    return c.status === 'PERDIDO';
  };
  const isTerminal = (c: any) => {
    if (terminalStageIds.size > 0 && c.stage_id) return terminalStageIds.has(c.stage_id);
    return c.status === 'CONVERTIDO' || c.status === 'PERDIDO';
  };

  // ── KPI computations ──────────────────────────────────────────────
  const kpis = useMemo(() => {
    const convertidos = allContacts.filter(isWon);
    const perdidos = allContacts.filter(isLost);
    const totalDecided = convertidos.length + perdidos.length;
    const taxaConversao = totalDecided > 0
      ? Math.round((convertidos.length / totalDecided) * 100)
      : 0;

    const receitaConvertida = convertidos.reduce(
      (sum: number, c: any) => sum + (c.valor_estimado || 0),
      0,
    );

    const ciclos = convertidos
      .filter((c: any) => c.created_at && c.updated_at)
      .map((c: any) => daysBetween(c.created_at, c.updated_at));
    const cicloMedio = ciclos.length > 0
      ? Math.round(ciclos.reduce((a: number, b: number) => a + b, 0) / ciclos.length)
      : 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();
    const esfriando = allContacts.filter(
      (c) => c.updated_at < sevenDaysAgoISO && !isTerminal(c),
    ).length;

    return { taxaConversao, receitaConvertida, cicloMedio, esfriando };
  }, [allContacts, wonStageIds, lostStageIds, terminalStageIds]);

  // ── Funnel data ───────────────────────────────────────────────────
  const funnelData = useMemo(() => {
    if (stages.length > 0) {
      const stageMap: Record<string, number> = {};
      for (const c of allContacts) {
        if (c.stage_id) stageMap[c.stage_id] = (stageMap[c.stage_id] || 0) + 1;
      }
      return [...stages]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({
          name: s.name,
          value: stageMap[s.id] || 0,
          color: s.color || '#a3a3a3',
        }));
    }
    // Legacy fallback
    const FUNNEL_STAGES = [
      { key: 'NOVO', label: 'Novo', color: '#a3a3a3' },
      { key: 'EM_PROSPECCAO', label: 'Em Prospecao', color: '#f59e0b' },
      { key: 'CONTATADO', label: 'Contatado', color: '#3b82f6' },
      { key: 'REUNIAO_MARCADA', label: 'Reuniao Marcada', color: '#22c55e' },
      { key: 'CONVERTIDO', label: 'Convertido', color: '#10b981' },
    ];
    const statusMap: Record<string, number> = {};
    for (const c of allContacts) {
      statusMap[c.status] = (statusMap[c.status] || 0) + 1;
    }
    return FUNNEL_STAGES.map((stage) => ({
      name: stage.label,
      value: statusMap[stage.key] || 0,
      color: stage.color,
    }));
  }, [allContacts, stages]);

  // ── Origem x Conversao data ───────────────────────────────────────
  const origemData = useMemo(() => {
    const origemMap: Record<string, { total: number; convertidos: number }> = {};
    for (const c of allContacts) {
      const origem = c.origem || 'Sem origem';
      if (!origemMap[origem]) origemMap[origem] = { total: 0, convertidos: 0 };
      origemMap[origem].total += 1;
      if (isWon(c)) origemMap[origem].convertidos += 1;
    }
    return Object.entries(origemMap).map(([key, val]) => ({
      name: key,
      total: val.total,
      convertidos: val.convertidos,
    }));
  }, [allContacts, wonStageIds]);

  // ── Win Rate Trend data ───────────────────────────────────────────
  const winRateData = useMemo(() => {
    return monthRanges.map((range) => {
      const monthContacts = allContacts.filter(
        (c) => c.updated_at >= range.start && c.updated_at < range.end,
      );
      const convertidosMonth = monthContacts.filter(isWon).length;
      const perdidosMonth = monthContacts.filter(isLost).length;
      const decided = convertidosMonth + perdidosMonth;
      const winRate = decided > 0 ? Math.round((convertidosMonth / decided) * 100) : 0;
      return { month: range.label, winRate };
    });
  }, [allContacts, monthRanges, wonStageIds, lostStageIds]);

  const hasFunnelData = funnelData.some((d) => d.value > 0);
  const hasOrigemData = origemData.length > 0 && origemData.some((d) => d.total > 0);
  const hasWinRateData = winRateData.some((d) => d.winRate > 0);

  return (
    <div>
      {/* ── Extra KPI Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Taxa de Conversao */}
        <div className="kpi-card bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5 border-l-4 border-l-emerald-400">
          <p className="text-[10px] text-purple-300/60 uppercase tracking-widest font-semibold">
            Taxa de Conversao
          </p>
          <p className="text-3xl font-bold text-emerald-400 mt-2 number-animate">
            {kpis.taxaConversao}%
          </p>
        </div>

        {/* Receita Convertida */}
        <div className="kpi-card bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5 border-l-4 border-l-green-400">
          <p className="text-[10px] text-purple-300/60 uppercase tracking-widest font-semibold">
            Receita Convertida
          </p>
          <p className="text-2xl font-bold text-green-400 mt-2 number-animate">
            {formatBRL(kpis.receitaConvertida)}
          </p>
        </div>

        {/* Ciclo Medio */}
        <div className="kpi-card bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5 border-l-4 border-l-blue-400">
          <p className="text-[10px] text-purple-300/60 uppercase tracking-widest font-semibold">
            Ciclo Medio
          </p>
          <p className="text-3xl font-bold text-blue-400 mt-2 number-animate">
            {kpis.cicloMedio} dias
          </p>
        </div>

        {/* Contatos Esfriando */}
        <div className="kpi-card bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5 border-l-4 border-l-amber-400">
          <p className="text-[10px] text-purple-300/60 uppercase tracking-widest font-semibold">
            Contatos Esfriando
          </p>
          <p className="text-3xl font-bold text-amber-400 mt-2 number-animate">
            {kpis.esfriando}
          </p>
        </div>
      </div>

      {/* ── Charts Row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Funnel Chart */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
          <h3 className="text-sm font-medium text-emerald-400 mb-4">
            Funil de Conversao
          </h3>
          {hasFunnelData ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnelData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(139,92,246,0.1)"
                    horizontal={false}
                  />
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
                    width={120}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: any) => [value, 'Contatos']}
                    cursor={{ fill: 'rgba(139,92,246,0.05)' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-purple-300/40 py-10 text-center">
              Sem dados
            </p>
          )}
        </div>

        {/* Origem x Conversao Chart */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
          <h3 className="text-sm font-medium text-emerald-400 mb-4">
            Conversao por Origem
          </h3>
          {hasOrigemData ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={origemData}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(139,92,246,0.1)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#c4b5fd' }}
                    axisLine={{ stroke: 'rgba(139,92,246,0.2)' }}
                    tickLine={false}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#c4b5fd' }}
                    axisLine={{ stroke: 'rgba(139,92,246,0.2)' }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: 'rgba(139,92,246,0.05)' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', color: '#c4b5fd' }}
                  />
                  <Bar
                    dataKey="total"
                    name="Total"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="convertidos"
                    name="Convertidos"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-purple-300/40 py-10 text-center">
              Sem dados
            </p>
          )}
        </div>
      </div>

      {/* ── Win Rate Trend ────────────────────────────────────────── */}
      <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5 mb-8">
        <h3 className="text-sm font-medium text-emerald-400 mb-4">
          Win Rate Mensal
        </h3>
        {hasWinRateData ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={winRateData}
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(139,92,246,0.1)"
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#c4b5fd' }}
                  axisLine={{ stroke: 'rgba(139,92,246,0.2)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#c4b5fd' }}
                  axisLine={{ stroke: 'rgba(139,92,246,0.2)' }}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: any) => [`${value}%`, 'Win Rate']}
                  cursor={{ stroke: 'rgba(139,92,246,0.3)' }}
                />
                <Line
                  type="monotone"
                  dataKey="winRate"
                  name="Win Rate"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#10b981', stroke: '#1e0f35', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#10b981', stroke: '#1e0f35', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-purple-300/40 py-10 text-center">
            Sem dados
          </p>
        )}
      </div>
    </div>
  );
}
