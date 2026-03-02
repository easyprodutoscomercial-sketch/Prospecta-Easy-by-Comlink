'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePipeline } from '@/lib/pipeline-context';
import { INTERACTION_TYPE_LABELS } from '@/lib/utils/labels';

interface PipelineDashboardProps {
  contacts: any[];
  interactions: any[];
  meetings: any[];
  profiles: any[];
}

function formatBRL(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1).replace('.', ',')}k`;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const BAR_COLORS = ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#a855f7', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#e879f9', '#22d3ee'];

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
    const countMap: Record<string, number> = {};
    for (const c of pipelineContacts) {
      if (c.stage_id) countMap[c.stage_id] = (countMap[c.stage_id] || 0) + 1;
    }
    const sorted = [...stages].sort((a, b) => a.position - b.position);
    const nonTerminal = sorted.filter((s) => !s.is_terminal);
    const terminal = sorted.filter((s) => s.is_terminal);
    const maxCount = Math.max(...sorted.map((s) => countMap[s.id] || 0), 1);
    return { nonTerminal, terminal, countMap, maxCount, total: pipelineContacts.length };
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
    const maxCount = data.length > 0 ? Math.max(...data.map((d) => d.count)) : 1;
    return { data, total, maxCount };
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
    const mContacts = pipelineContacts.filter(
      (c) => c.created_at >= monthStart && c.created_at < monthEnd,
    );
    const mInts = pipelineInteractions.filter(
      (i) => i.created_at >= monthStart && i.created_at < monthEnd,
    );
    const mMtgs = pipelineMeetings.filter((m) => {
      const d = m.meeting_at || m.created_at;
      return d >= monthStart && d < monthEnd;
    });

    return profiles
      .map((p) => ({
        name: p.name?.split(' ').slice(0, 2).join(' ') || 'Sem nome',
        contacts: mContacts.filter((c) => c.created_by_user_id === p.user_id).length,
        interactions: mInts.filter((i) => i.created_by_user_id === p.user_id).length,
        meetings: mMtgs.filter((m) => m.created_by_user_id === p.user_id).length,
      }))
      .filter((t) => t.contacts > 0 || t.interactions > 0 || t.meetings > 0)
      .sort((a, b) => (b.contacts + b.interactions + b.meetings) - (a.contacts + a.interactions + a.meetings));
  }, [pipelineContacts, pipelineInteractions, pipelineMeetings, profiles, monthStart, monthEnd]);

  // ── Contact-name map ───────────────────────────────────────────
  const contactMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of contacts) map.set(c.id, c);
    return map;
  }, [contacts]);

  // ── Stage map for badges ───────────────────────────────────────
  const stageNameMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const s of stages) map.set(s.id, { name: s.name, color: s.color });
    return map;
  }, [stages]);

  // ── Recent contacts ────────────────────────────────────────────
  const recentContacts = useMemo(
    () =>
      [...pipelineContacts]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [pipelineContacts],
  );

  // ── Upcoming meetings ─────────────────────────────────────────
  const upcomingMeetings = useMemo(() => {
    const nowISO = new Date().toISOString();
    return pipelineMeetings
      .filter((m) => m.status === 'SCHEDULED' && m.meeting_at >= nowISO)
      .sort((a, b) => new Date(a.meeting_at).getTime() - new Date(b.meeting_at).getTime())
      .slice(0, 5);
  }, [pipelineMeetings]);

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden">
      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <KpiCard label="Contatos Ativos" value={kpis.contatosAtivos.toString()} accentColor="emerald" />
        <KpiCard label="Valor Pipeline" value={formatBRL(kpis.valorPipeline)} accentColor="green" small />
        <KpiCard label="Conversao" value={`${kpis.taxaConversao}%`} accentColor="blue" />
        <KpiCard label="Novos no Mes" value={kpis.novosEsteMes.toString()} accentColor="cyan" />
      </div>

      {/* ── Distribuicao por Etapa ──────────────────────────────── */}
      {stages.length > 0 && (
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-3.5 sm:p-5">
          <h3 className="text-xs sm:text-sm font-semibold text-white mb-3 sm:mb-4">
            Distribuicao por Etapa
          </h3>
          <div className="space-y-2">
            {stageDistribution.nonTerminal.map((stage) => {
              const count = stageDistribution.countMap[stage.id] || 0;
              const pct = stageDistribution.maxCount > 0 ? (count / stageDistribution.maxCount) * 100 : 0;
              return (
                <StageBar key={stage.id} name={stage.name} count={count} pct={pct} color={stage.color} />
              );
            })}
          </div>
          {stageDistribution.terminal.length > 0 && (
            <div className="border-t border-purple-800/20 mt-3 pt-3">
              <div className="space-y-2">
                {stageDistribution.terminal.map((stage) => {
                  const count = stageDistribution.countMap[stage.id] || 0;
                  const pct = stageDistribution.maxCount > 0 ? (count / stageDistribution.maxCount) * 100 : 0;
                  return (
                    <StageBar key={stage.id} name={stage.name} count={count} pct={pct} color={stage.color} dim />
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 sm:gap-3 mt-3 text-[10px] sm:text-[11px] text-neutral-500">
            <span className="text-emerald-400 font-semibold">{kpis.won} ganhos</span>
            <span>|</span>
            <span className="text-red-400 font-semibold">{kpis.lost} perdidos</span>
            <span>|</span>
            <span>{stageDistribution.total} total</span>
          </div>
        </div>
      )}

      {/* ── Interacoes + Reunioes/Equipe ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Interacoes do Mes - barras CSS puras */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl overflow-hidden min-w-0">
          <div className="px-3.5 py-3 sm:px-5 sm:py-4 border-b border-purple-800/20 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-semibold text-white">Interacoes do Mes</h3>
            <span className="text-[10px] sm:text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {monthInteractions.total}
            </span>
          </div>
          <div className="p-3.5 sm:p-5">
            {monthInteractions.data.length > 0 ? (
              <div className="space-y-2">
                {monthInteractions.data.map((item, idx) => {
                  const pct = monthInteractions.maxCount > 0 ? (item.count / monthInteractions.maxCount) * 100 : 0;
                  return (
                    <div key={item.name} className="flex items-center gap-2 sm:gap-3">
                      <span className="text-[10px] sm:text-xs text-neutral-400 w-16 sm:w-24 truncate shrink-0">{item.name}</span>
                      <div className="flex-1 h-5 sm:h-6 bg-purple-900/20 rounded overflow-hidden relative min-w-0">
                        <div
                          className="h-full rounded transition-all duration-700 ease-out"
                          style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: BAR_COLORS[idx % BAR_COLORS.length] }}
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/80">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-purple-300/40 py-8 text-center">
                Nenhuma interacao este mes
              </p>
            )}
          </div>
        </div>

        {/* Reunioes + Equipe */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl overflow-hidden min-w-0">
          <div className="px-3.5 py-3 sm:px-5 sm:py-4 border-b border-purple-800/20">
            <h3 className="text-xs sm:text-sm font-semibold text-white">Reunioes & Equipe</h3>
          </div>
          <div className="p-3.5 sm:p-5">
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-blue-400">{meetingStats.agendadas}</p>
                <p className="text-[9px] sm:text-[10px] text-neutral-500">Agendadas</p>
              </div>
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-emerald-400">{meetingStats.realizadas}</p>
                <p className="text-[9px] sm:text-[10px] text-neutral-500">Realizadas</p>
              </div>
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-red-400">{meetingStats.canceladas}</p>
                <p className="text-[9px] sm:text-[10px] text-neutral-500">Canceladas</p>
              </div>
            </div>

            {teamActivity.length > 0 ? (
              <div>
                <p className="text-[9px] sm:text-[10px] text-purple-300/50 uppercase tracking-widest font-semibold mb-2">
                  Equipe no mes
                </p>
                <div className="space-y-1.5">
                  {teamActivity.map((member) => (
                    <div key={member.name} className="flex items-center justify-between text-[11px] py-1 border-b border-purple-800/10 last:border-0">
                      <span className="text-neutral-300 truncate mr-2">{member.name}</span>
                      <div className="flex items-center gap-3 shrink-0 text-neutral-500">
                        <span title="Contatos">{member.contacts}c</span>
                        <span title="Interacoes">{member.interactions}i</span>
                        <span title="Reunioes">{member.meetings}r</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-purple-300/40 text-center py-2">Sem atividade este mes</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Contatos Recentes + Proximas Reunioes ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent contacts */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl overflow-hidden min-w-0">
          <div className="px-3.5 py-3 sm:px-5 sm:py-4 border-b border-purple-800/20 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-semibold text-white">Contatos Recentes</h3>
            <Link href="/contacts" className="text-[10px] sm:text-xs text-purple-300/50 hover:text-emerald-400 transition-colors">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-purple-800/15">
            {recentContacts.length > 0 ? (
              recentContacts.map((contact) => {
                const stage = contact.stage_id ? stageNameMap.get(contact.stage_id) : null;
                return (
                  <Link
                    key={contact.id}
                    href={`/contacts/${contact.id}`}
                    className="block px-3.5 py-2.5 sm:px-5 sm:py-3 hover:bg-purple-800/15 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] sm:text-sm font-medium text-neutral-100 truncate">{contact.name}</p>
                        <p className="text-[10px] text-purple-300/50 truncate">
                          {contact.company || contact.phone || '-'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {stage && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: stage.color }}
                            title={stage.name}
                          />
                        )}
                        <span className="text-[9px] text-purple-300/40">
                          {new Date(contact.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-purple-300/40">Nenhum contato no pipeline</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming meetings */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl overflow-hidden min-w-0">
          <div className="px-3.5 py-3 sm:px-5 sm:py-4 border-b border-purple-800/20 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-semibold text-white">Proximas Reunioes</h3>
            <span className="text-[10px] sm:text-xs text-purple-300/50">{upcomingMeetings.length}</span>
          </div>
          <div className="divide-y divide-purple-800/15">
            {upcomingMeetings.length > 0 ? (
              upcomingMeetings.map((meeting) => {
                const contact = contactMap.get(meeting.contact_id);
                const meetingDate = new Date(meeting.meeting_at);
                const isToday = meetingDate.toDateString() === new Date().toDateString();
                return (
                  <div key={meeting.id} className="px-3.5 py-2.5 sm:px-5 sm:py-3 hover:bg-purple-800/15 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] sm:text-sm font-medium text-neutral-100 truncate">{meeting.title}</p>
                      <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        isToday ? 'text-amber-400 bg-amber-500/15' : 'text-purple-300/50'
                      }`}>
                        {isToday ? 'Hoje' : meetingDate.toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-purple-300/50">
                        {meetingDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {contact && (
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="text-[10px] text-emerald-400/70 hover:text-emerald-400 truncate"
                        >
                          {contact.name}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-purple-300/40">Nenhuma reuniao agendada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function StageBar({ name, count, pct, color, dim }: {
  name: string; count: number; pct: number; color: string; dim?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className={`text-[10px] sm:text-xs w-16 sm:w-28 truncate shrink-0 ${dim ? 'text-neutral-500' : 'text-neutral-300'}`}>
        {name}
      </span>
      <div className="flex-1 h-5 sm:h-6 bg-purple-900/20 rounded overflow-hidden relative min-w-0">
        <div
          className={`h-full rounded transition-all duration-700 ease-out ${dim ? 'opacity-60' : ''}`}
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
        />
        <span className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold ${dim ? 'text-white/50' : 'text-white/80'}`}>
          {count}
        </span>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accentColor, small }: {
  label: string; value: string; accentColor: 'emerald' | 'green' | 'blue' | 'cyan'; small?: boolean;
}) {
  const colors = {
    emerald: { border: 'border-l-emerald-400', text: 'text-emerald-400' },
    green: { border: 'border-l-green-400', text: 'text-green-400' },
    blue: { border: 'border-l-blue-400', text: 'text-blue-400' },
    cyan: { border: 'border-l-cyan-400', text: 'text-cyan-400' },
  }[accentColor];

  return (
    <div className={`bg-[#1e0f35] border border-purple-800/30 rounded-xl p-3 sm:p-5 border-l-4 ${colors.border} min-w-0`}>
      <p className="text-[8px] sm:text-[10px] text-purple-300/60 uppercase tracking-wider sm:tracking-widest font-semibold truncate">
        {label}
      </p>
      <p className={`${small ? 'text-base sm:text-2xl' : 'text-xl sm:text-3xl'} font-bold ${colors.text} mt-1 sm:mt-2 truncate`}>
        {value}
      </p>
    </div>
  );
}
