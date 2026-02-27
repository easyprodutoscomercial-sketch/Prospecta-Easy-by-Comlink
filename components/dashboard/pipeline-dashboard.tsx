'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { usePipeline } from '@/lib/pipeline-context';
import { INTERACTION_TYPE_LABELS } from '@/lib/utils/labels';

interface PipelineDashboardProps {
  contacts: any[];
  interactions: any[];
  meetings: any[];
  profiles: any[];
}

const TOOLTIP_STYLE = {
  fontSize: '12px',
  borderRadius: '8px',
  border: '1px solid rgba(139,92,246,0.3)',
  backgroundColor: '#1e0f35',
  color: '#e9d5ff',
};

function formatBRL(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1).replace('.', ',')}k`;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PipelineDashboard({
  contacts,
  interactions,
  meetings,
  profiles,
}: PipelineDashboardProps) {
  const { selectedPipelineId, currentPipeline } = usePipeline();
  const stages = currentPipeline?.stages || [];

  // ── Filter data by selected pipeline ────────────────────────────
  const pipelineContacts = useMemo(() => {
    if (!selectedPipelineId) return contacts;
    return contacts.filter((c) => c.pipeline_id === selectedPipelineId);
  }, [contacts, selectedPipelineId]);

  const pipelineContactIds = useMemo(
    () => new Set(pipelineContacts.map((c) => c.id)),
    [pipelineContacts],
  );

  const pipelineInteractions = useMemo(() => {
    if (!selectedPipelineId) return interactions;
    return interactions.filter((i) => pipelineContactIds.has(i.contact_id));
  }, [interactions, selectedPipelineId, pipelineContactIds]);

  const pipelineMeetings = useMemo(() => {
    if (!selectedPipelineId) return meetings;
    return meetings.filter((m) => pipelineContactIds.has(m.contact_id));
  }, [meetings, selectedPipelineId, pipelineContactIds]);

  // ── Stage helpers ───────────────────────────────────────────────
  const terminalStageIds = useMemo(
    () => new Set(stages.filter((s) => s.is_terminal).map((s) => s.id)),
    [stages],
  );
  const wonStageIds = useMemo(
    () => new Set(stages.filter((s) => s.terminal_type === 'won').map((s) => s.id)),
    [stages],
  );
  const lostStageIds = useMemo(
    () => new Set(stages.filter((s) => s.terminal_type === 'lost').map((s) => s.id)),
    [stages],
  );

  const isTerminal = (c: any) => {
    if (terminalStageIds.size > 0 && c.stage_id) return terminalStageIds.has(c.stage_id);
    return c.status === 'CONVERTIDO' || c.status === 'PERDIDO';
  };

  // ── Month range ─────────────────────────────────────────────────
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  // ── KPIs ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const activeContacts = pipelineContacts.filter((c) => !isTerminal(c));
    const contatosAtivos = activeContacts.length;
    const valorPipeline = activeContacts.reduce(
      (sum: number, c: any) => sum + (c.valor_estimado || 0),
      0,
    );

    const won = pipelineContacts.filter((c) =>
      wonStageIds.size > 0 && c.stage_id ? wonStageIds.has(c.stage_id) : c.status === 'CONVERTIDO',
    ).length;
    const lost = pipelineContacts.filter((c) =>
      lostStageIds.size > 0 && c.stage_id ? lostStageIds.has(c.stage_id) : c.status === 'PERDIDO',
    ).length;
    const decided = won + lost;
    const taxaConversao = decided > 0 ? Math.round((won / decided) * 100) : 0;

    const novosEsteMes = pipelineContacts.filter(
      (c) => c.created_at >= monthStart && c.created_at < monthEnd,
    ).length;

    return { contatosAtivos, valorPipeline, taxaConversao, novosEsteMes, won, lost };
  }, [pipelineContacts, terminalStageIds, wonStageIds, lostStageIds, monthStart, monthEnd]);

  // ── Stage distribution ──────────────────────────────────────────
  const stageDistribution = useMemo(() => {
    const stageMap: Record<string, number> = {};
    for (const c of pipelineContacts) {
      if (c.stage_id) stageMap[c.stage_id] = (stageMap[c.stage_id] || 0) + 1;
    }
    const sorted = [...stages].sort((a, b) => a.position - b.position);
    const nonTerminal = sorted.filter((s) => !s.is_terminal);
    const terminal = sorted.filter((s) => s.is_terminal);
    const maxCount = Math.max(...sorted.map((s) => stageMap[s.id] || 0), 1);
    return { nonTerminal, terminal, stageMap, maxCount, total: pipelineContacts.length };
  }, [pipelineContacts, stages]);

  // ── Interactions this month ─────────────────────────────────────
  const monthInteractions = useMemo(() => {
    const filtered = pipelineInteractions.filter(
      (i) => i.created_at >= monthStart && i.created_at < monthEnd,
    );
    const typeMap: Record<string, number> = {};
    for (const i of filtered) {
      typeMap[i.type] = (typeMap[i.type] || 0) + 1;
    }
    const data = Object.entries(typeMap)
      .map(([key, count]) => ({
        name: INTERACTION_TYPE_LABELS[key] || key,
        count,
      }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);
    const total = filtered.length;
    return { data, total };
  }, [pipelineInteractions, monthStart, monthEnd]);

  // ── Meetings ────────────────────────────────────────────────────
  const meetingStats = useMemo(() => {
    const agendadas = pipelineMeetings.filter((m) => m.status === 'SCHEDULED').length;
    const realizadas = pipelineMeetings.filter((m) => m.status === 'COMPLETED').length;
    const canceladas = pipelineMeetings.filter((m) => m.status === 'CANCELLED').length;
    return { agendadas, realizadas, canceladas };
  }, [pipelineMeetings]);

  // ── Team activity this month ────────────────────────────────────
  const teamActivity = useMemo(() => {
    const monthContacts = pipelineContacts.filter(
      (c) => c.created_at >= monthStart && c.created_at < monthEnd,
    );
    const monthInts = pipelineInteractions.filter(
      (i) => i.created_at >= monthStart && i.created_at < monthEnd,
    );
    const monthMtgs = pipelineMeetings.filter((m) => {
      const d = m.meeting_at || m.created_at;
      return d >= monthStart && d < monthEnd;
    });

    return profiles
      .map((p) => {
        const contactCount = monthContacts.filter((c) => c.created_by_user_id === p.user_id).length;
        const intCount = monthInts.filter((i) => i.created_by_user_id === p.user_id).length;
        const mtgCount = monthMtgs.filter((m) => m.created_by_user_id === p.user_id).length;
        return {
          name: p.name?.split(' ').slice(0, 2).join(' ') || 'Sem nome',
          contacts: contactCount,
          interactions: intCount,
          meetings: mtgCount,
        };
      })
      .filter((t) => t.contacts > 0 || t.interactions > 0 || t.meetings > 0)
      .sort((a, b) => (b.contacts + b.interactions + b.meetings) - (a.contacts + a.interactions + a.meetings));
  }, [pipelineContacts, pipelineInteractions, pipelineMeetings, profiles, monthStart, monthEnd]);

  // ── Contact-name map for meetings ──────────────────────────────
  const contactMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of contacts) map.set(c.id, c);
    return map;
  }, [contacts]);

  // ── Stage map for badges ────────────────────────────────────────
  const stageMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const s of stages) map.set(s.id, { name: s.name, color: s.color });
    return map;
  }, [stages]);

  // ── Recent contacts ─────────────────────────────────────────────
  const recentContacts = useMemo(
    () =>
      [...pipelineContacts]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [pipelineContacts],
  );

  // ── Upcoming meetings ──────────────────────────────────────────
  const upcomingMeetings = useMemo(() => {
    const nowISO = new Date().toISOString();
    return pipelineMeetings
      .filter((m) => m.status === 'SCHEDULED' && m.meeting_at >= nowISO)
      .sort((a, b) => new Date(a.meeting_at).getTime() - new Date(b.meeting_at).getTime())
      .slice(0, 5);
  }, [pipelineMeetings]);

  // ── Interaction chart colors ────────────────────────────────────
  const CHART_COLORS = ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#a855f7', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#e879f9', '#22d3ee'];

  return (
    <div className="space-y-6">
      {/* ── Linha 1: KPI Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Contatos Ativos"
          value={kpis.contatosAtivos.toString()}
          accentColor="emerald"
        />
        <KpiCard
          label="Valor no Pipeline"
          value={formatBRL(kpis.valorPipeline)}
          accentColor="green"
          small
        />
        <KpiCard
          label="Taxa de Conversao"
          value={`${kpis.taxaConversao}%`}
          accentColor="blue"
        />
        <KpiCard
          label="Novos este Mes"
          value={kpis.novosEsteMes.toString()}
          accentColor="cyan"
        />
      </div>

      {/* ── Linha 2: Distribuicao por Etapa ─────────────────────── */}
      {stages.length > 0 && (
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            Distribuicao por Etapa
          </h3>

          {/* Non-terminal stages */}
          <div className="space-y-2.5">
            {stageDistribution.nonTerminal.map((stage) => {
              const count = stageDistribution.stageMap[stage.id] || 0;
              const pct = stageDistribution.maxCount > 0 ? (count / stageDistribution.maxCount) * 100 : 0;
              return (
                <div key={stage.id} className="flex items-center gap-3">
                  <span className="text-xs text-neutral-300 w-28 truncate shrink-0">{stage.name}</span>
                  <div className="flex-1 h-6 bg-purple-900/20 rounded-md overflow-hidden relative">
                    <div
                      className="h-full rounded-md transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: stage.color }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-white/80">
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          {stageDistribution.terminal.length > 0 && (
            <div className="border-t border-purple-800/20 my-3 pt-3">
              <div className="space-y-2.5">
                {stageDistribution.terminal.map((stage) => {
                  const count = stageDistribution.stageMap[stage.id] || 0;
                  const pct = stageDistribution.maxCount > 0 ? (count / stageDistribution.maxCount) * 100 : 0;
                  return (
                    <div key={stage.id} className="flex items-center gap-3">
                      <span className="text-xs text-neutral-400 w-28 truncate shrink-0">{stage.name}</span>
                      <div className="flex-1 h-6 bg-purple-900/20 rounded-md overflow-hidden relative">
                        <div
                          className="h-full rounded-md transition-all duration-700 ease-out opacity-70"
                          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: stage.color }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-white/60">
                          {count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 mt-3 text-[11px] text-neutral-500">
            <span className="text-emerald-400 font-semibold">{kpis.won} ganhos</span>
            <span>|</span>
            <span className="text-red-400 font-semibold">{kpis.lost} perdidos</span>
            <span>|</span>
            <span>{stageDistribution.total} total</span>
          </div>
        </div>
      )}

      {/* ── Linha 3: Interacoes + Reunioes/Equipe ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interacoes do Mes */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-purple-800/20 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Interacoes do Mes</h3>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {monthInteractions.total}
            </span>
          </div>
          <div className="p-5">
            {monthInteractions.data.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthInteractions.data}
                    layout="vertical"
                    margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#c4b5fd' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#c4b5fd' }}
                      axisLine={false}
                      tickLine={false}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: any) => [value, 'Interacoes']}
                      cursor={{ fill: 'rgba(139,92,246,0.05)' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {monthInteractions.data.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-purple-300/40 py-10 text-center">
                Nenhuma interacao este mes
              </p>
            )}
          </div>
        </div>

        {/* Reunioes + Equipe */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-purple-800/20">
            <h3 className="text-sm font-semibold text-white">Reunioes & Equipe</h3>
          </div>
          <div className="p-5">
            {/* Meeting numbers */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">{meetingStats.agendadas}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">Agendadas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">{meetingStats.realizadas}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">Realizadas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{meetingStats.canceladas}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">Canceladas</p>
              </div>
            </div>

            {/* Team table */}
            {teamActivity.length > 0 && (
              <div>
                <p className="text-[10px] text-purple-300/50 uppercase tracking-widest font-semibold mb-2">
                  Atividade da equipe no mes
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-purple-300/50 border-b border-purple-800/20">
                        <th className="text-left py-1.5 font-medium">Membro</th>
                        <th className="text-center py-1.5 font-medium">Contatos</th>
                        <th className="text-center py-1.5 font-medium">Interacoes</th>
                        <th className="text-center py-1.5 font-medium">Reunioes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamActivity.map((member) => (
                        <tr key={member.name} className="border-b border-purple-800/10">
                          <td className="py-1.5 text-neutral-300 truncate max-w-[120px]">{member.name}</td>
                          <td className="py-1.5 text-center text-neutral-400">{member.contacts}</td>
                          <td className="py-1.5 text-center text-neutral-400">{member.interactions}</td>
                          <td className="py-1.5 text-center text-neutral-400">{member.meetings}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {teamActivity.length === 0 && (
              <p className="text-sm text-purple-300/40 text-center py-3">Sem atividade este mes</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Linha 4: Contatos Recentes + Proximas Reunioes ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent contacts */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-purple-800/20 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Contatos Recentes</h3>
            <Link href="/contacts" className="text-xs text-purple-300/50 hover:text-emerald-400 transition-colors">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-purple-800/15">
            {recentContacts.length > 0 ? (
              recentContacts.map((contact) => {
                const stage = contact.stage_id ? stageMap.get(contact.stage_id) : null;
                return (
                  <Link
                    key={contact.id}
                    href={`/contacts/${contact.id}`}
                    className="px-5 py-3 hover:bg-purple-800/15 flex items-center justify-between transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-100 truncate">{contact.name}</p>
                      <p className="text-[11px] text-purple-300/50 mt-0.5 truncate">
                        {contact.company || contact.email || contact.phone || '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {stage && (
                        <span
                          className="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                          style={{
                            backgroundColor: `${stage.color}20`,
                            color: stage.color,
                          }}
                        >
                          {stage.name}
                        </span>
                      )}
                      <span className="text-[10px] text-purple-300/40">
                        {new Date(contact.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-purple-300/40">Nenhum contato no pipeline</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming meetings */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-purple-800/20 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Proximas Reunioes</h3>
            <span className="text-xs text-purple-300/50">{upcomingMeetings.length} agendadas</span>
          </div>
          <div className="divide-y divide-purple-800/15">
            {upcomingMeetings.length > 0 ? (
              upcomingMeetings.map((meeting) => {
                const contact = contactMap.get(meeting.contact_id);
                const meetingDate = new Date(meeting.meeting_at);
                const isToday = meetingDate.toDateString() === new Date().toDateString();
                return (
                  <div key={meeting.id} className="px-5 py-3 hover:bg-purple-800/15 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-neutral-100 truncate flex-1">{meeting.title}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-2 ${
                        isToday ? 'text-amber-400 bg-amber-500/15' : 'text-purple-300/50'
                      }`}>
                        {isToday ? 'Hoje' : meetingDate.toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-purple-300/50">
                        {meetingDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {contact && (
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="text-[11px] text-emerald-400/70 hover:text-emerald-400 truncate"
                        >
                          {contact.name}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-purple-300/40">Nenhuma reuniao agendada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── KPI Card sub-component ──────────────────────────────────────
function KpiCard({
  label,
  value,
  accentColor,
  small,
}: {
  label: string;
  value: string;
  accentColor: 'emerald' | 'green' | 'blue' | 'cyan';
  small?: boolean;
}) {
  const colorMap = {
    emerald: { border: 'border-l-emerald-400', text: 'text-emerald-400' },
    green: { border: 'border-l-green-400', text: 'text-green-400' },
    blue: { border: 'border-l-blue-400', text: 'text-blue-400' },
    cyan: { border: 'border-l-cyan-400', text: 'text-cyan-400' },
  };
  const colors = colorMap[accentColor];

  return (
    <div className={`bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5 border-l-4 ${colors.border}`}>
      <p className="text-[10px] text-purple-300/60 uppercase tracking-widest font-semibold">
        {label}
      </p>
      <p className={`${small ? 'text-2xl' : 'text-3xl'} font-bold ${colors.text} mt-2`}>
        {value}
      </p>
    </div>
  );
}
