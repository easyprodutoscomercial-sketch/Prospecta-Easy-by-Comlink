'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Meeting, MeetingType } from '@/lib/types';
import { useToast } from '@/lib/toast-context';
import { usePipeline } from '@/lib/pipeline-context';
import { MEETING_TYPE_LABELS, MEETING_TYPE_COLORS, formatMeetingType, INTERACTION_TYPE_LABELS, INTERACTION_OUTCOME_LABELS } from '@/lib/utils/labels';
import MeetingModal from '@/components/meetings/meeting-modal';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface MeetingWithContact extends Meeting {
  contact_name?: string;
  created_by_name?: string;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  SCHEDULED: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', label: 'Agendada' },
  COMPLETED: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Concluida' },
  CANCELLED: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Cancelada' },
};

const MEETING_TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  PROSPECCAO: { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  ALINHAMENTO: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  APRESENTACAO: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  NEGOCIACAO: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  FOLLOW_UP: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  POS_VENDA: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  SUPORTE: { bg: 'bg-pink-500/15', text: 'text-pink-400' },
  OUTRO: { bg: 'bg-neutral-500/15', text: 'text-neutral-400' },
};

export default function CalendarPage() {
  const toast = useToast();
  const { selectedPipelineId } = usePipeline();
  const [meetings, setMeetings] = useState<MeetingWithContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Detail panel
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithContact | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('user');
  const [showTeamView, setShowTeamView] = useState(false);

  // Edit meeting
  const [editingMeeting, setEditingMeeting] = useState<MeetingWithContact | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Register interaction from meeting
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [interactionData, setInteractionData] = useState({ type: 'LIGACAO', outcome: 'SEM_RESPOSTA', note: '' });
  const [interactionLoading, setInteractionLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchData = useCallback(async () => {
    try {
      const pipelineParam = selectedPipelineId ? `&pipeline_id=${selectedPipelineId}` : '';
      const [meetingsRes, contactsRes, usersRes, meRes] = await Promise.all([
        fetch('/api/meetings'),
        fetch(`/api/contacts?limit=500${pipelineParam}`),
        fetch('/api/users'),
        fetch('/api/me'),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUserId(meData.user_id || '');
        setCurrentUserRole(meData.role || 'user');
      }

      if (!meetingsRes.ok) {
        const errText = await meetingsRes.text();
        console.error('Erro ao buscar reunioes:', meetingsRes.status, errText);
        toast.error('Erro ao carregar reunioes');
        return;
      }

      const mData = await meetingsRes.json();
      const meetingsList: Meeting[] = mData.meetings || [];

      // Map de contatos
      const contactMap: Record<string, string> = {};
      if (contactsRes.ok) {
        const cData = await contactsRes.json();
        for (const c of cData.contacts || []) {
          contactMap[c.id] = c.name;
        }
      }

      // Map de usuarios (responsavel)
      const userMap: Record<string, string> = {};
      if (usersRes.ok) {
        const uData = await usersRes.json();
        for (const u of uData.users || []) {
          userMap[u.user_id] = u.name;
        }
      }

      setMeetings(
        meetingsList.map((m) => ({
          ...m,
          contact_name: contactMap[m.contact_id] || 'Contato',
          created_by_name: userMap[m.created_by_user_id] || '',
        }))
      );
    } catch (err) {
      console.error('Erro fetch calendario:', err);
      toast.error('Erro ao carregar reunioes');
    } finally {
      setLoading(false);
    }
  }, [toast, selectedPipelineId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: { date: string; day: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Prev month padding
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startPad - 1; i >= 0; i--) {
      const d = prevLastDay - i;
      const dt = new Date(year, month - 1, d);
      days.push({
        date: formatDate(dt),
        day: d,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Current month
    const today = new Date();
    const todayStr = formatDate(today);
    for (let d = 1; d <= totalDays; d++) {
      const dt = new Date(year, month, d);
      const dateStr = formatDate(dt);
      days.push({
        date: dateStr,
        day: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month + 1, d);
      days.push({
        date: formatDate(dt),
        day: d,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [year, month]);

  // Meetings grouped by date
  const filteredMeetings = useMemo(() => {
    if (showTeamView || !currentUserId) return meetings;
    return meetings.filter(m => m.created_by_user_id === currentUserId);
  }, [meetings, showTeamView, currentUserId]);

  const meetingsByDate = useMemo(() => {
    const map: Record<string, MeetingWithContact[]> = {};
    for (const m of filteredMeetings) {
      const dateStr = formatDate(new Date(m.meeting_at));
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(m);
    }
    // Sort each day by time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.meeting_at).getTime() - new Date(b.meeting_at).getTime());
    }
    return map;
  }, [filteredMeetings]);

  // Selected day's meetings
  const selectedDayMeetings = selectedDate ? meetingsByDate[selectedDate] || [] : [];

  function formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatTime(isoStr: string): string {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToday() {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(formatDate(today));
  }

  async function handleUpdateStatus(meetingId: string, status: string) {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(status === 'COMPLETED' ? 'Reuniao concluida!' : 'Reuniao cancelada.');
      setSelectedMeeting(null);
      fetchData();
    } catch {
      toast.error('Erro ao atualizar reuniao');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDeleteMeeting(meetingId: string) {
    if (!confirm('Tem certeza que deseja excluir esta reuniao?')) return;
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Reuniao excluida.');
      setSelectedMeeting(null);
      fetchData();
    } catch {
      toast.error('Erro ao excluir reuniao');
    }
  }

  async function handleEditConfirm(data: {
    title: string;
    meeting_at: string;
    duration_minutes: number;
    location: string;
    notes: string;
    meeting_type: string;
  }) {
    if (!editingMeeting) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/meetings/${editingMeeting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success('Reuniao atualizada!');
      setEditingMeeting(null);
      setSelectedMeeting(null);
      fetchData();
    } catch {
      toast.error('Erro ao atualizar reuniao');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleAddInteraction() {
    if (!selectedMeeting) return;
    setInteractionLoading(true);
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: selectedMeeting.contact_id,
          type: interactionData.type,
          outcome: interactionData.outcome,
          note: interactionData.note || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Interacao registrada!');
      setInteractionData({ type: 'LIGACAO', outcome: 'SEM_RESPOSTA', note: '' });
      setShowInteractionForm(false);
    } catch {
      toast.error('Erro ao registrar interacao');
    } finally {
      setInteractionLoading(false);
    }
  }

  // KPIs
  const kpis = useMemo(() => {
    const now = new Date();
    const scheduled = meetings.filter((m) => m.status === 'SCHEDULED');
    const upcoming = scheduled.filter((m) => new Date(m.meeting_at) >= now);
    const thisMonth = meetings.filter((m) => {
      const d = new Date(m.meeting_at);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const completed = meetings.filter((m) => m.status === 'COMPLETED').length;
    return { upcoming: upcoming.length, thisMonth: thisMonth.length, completed, total: meetings.length };
  }, [meetings, year, month]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-purple-800/30 border-t-cyan-500 rounded-full" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-cyan-400">Calendario</h1>
          <p className="text-sm text-purple-300/60">
            {showTeamView ? 'Reunioes de todo o time' : 'Suas reunioes e agendamentos'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Team view toggle */}
          <button
            onClick={() => setShowTeamView(!showTeamView)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
              showTeamView
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                : 'text-purple-300/60 bg-[#2a1245] border border-purple-700/30 hover:text-purple-200'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {showTeamView ? 'Time' : 'Meus'}
          </button>

          {/* iCal export */}
          <a
            href="/api/meetings/export"
            download="reunioes.ics"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-purple-300/60 bg-[#2a1245] border border-purple-700/30 rounded-lg hover:text-purple-200 hover:bg-purple-800/30 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar iCal
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20">
          <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium">Proximas</p>
          <p className="text-lg font-bold text-cyan-400 mt-0.5">{kpis.upcoming}</p>
        </div>
        <div className="bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20">
          <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium">Este Mes</p>
          <p className="text-lg font-bold text-white mt-0.5">{kpis.thisMonth}</p>
        </div>
        <div className="bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20">
          <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium">Concluidas</p>
          <p className="text-lg font-bold text-emerald-400 mt-0.5">{kpis.completed}</p>
        </div>
        <div className="bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20">
          <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium">Total</p>
          <p className="text-lg font-bold text-white mt-0.5">{kpis.total}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-purple-800/30 text-purple-300/60 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white">{MONTHS[month]} {year}</h2>
              <button onClick={goToday} className="text-[10px] font-medium text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors">
                Hoje
              </button>
            </div>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-purple-800/30 text-purple-300/60 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Meeting type legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
            {Object.entries(MEETING_TYPE_LABELS).map(([key, label]) => {
              const style = MEETING_TYPE_STYLE[key] || MEETING_TYPE_STYLE.OUTRO;
              return (
                <div key={key} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${style.bg} ${style.text} border border-current`} />
                  <span className="text-[9px] text-purple-300/50">{label}</span>
                </div>
              );
            })}
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-purple-300/40 uppercase tracking-wider py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-px">
            {calendarDays.map((day, i) => {
              const dayMeetings = meetingsByDate[day.date] || [];
              const isSelected = selectedDate === day.date;
              const hasScheduled = dayMeetings.some((m) => m.status === 'SCHEDULED');

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(day.date)}
                  className={`relative min-h-[72px] p-1.5 rounded-lg text-left transition-all border ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-500/30'
                      : day.isToday
                        ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15'
                        : day.isCurrentMonth
                          ? 'hover:bg-purple-800/20 border-transparent'
                          : 'opacity-40 border-transparent'
                  }`}
                >
                  <span className={`text-xs font-medium ${
                    day.isToday
                      ? 'text-emerald-400 font-bold'
                      : day.isCurrentMonth
                        ? 'text-neutral-200'
                        : 'text-purple-300/30'
                  }`}>
                    {day.day}
                  </span>

                  {/* Meeting dots */}
                  {dayMeetings.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayMeetings.slice(0, 3).map((m) => {
                        const typeStyle = MEETING_TYPE_STYLE[m.meeting_type] || MEETING_TYPE_STYLE.OUTRO;
                        return (
                          <div
                            key={m.id}
                            className={`text-[8px] font-medium truncate rounded px-1 py-0.5 ${typeStyle.bg} ${typeStyle.text}`}
                            title={m.created_by_name ? `Resp: ${m.created_by_name}` : ''}
                          >
                            {formatTime(m.meeting_at)} {m.contact_name}
                          </div>
                        );
                      })}
                      {dayMeetings.length > 3 && (
                        <div className="text-[8px] text-purple-300/50 px-1">+{dayMeetings.length - 3} mais</div>
                      )}
                    </div>
                  )}

                  {/* Pulsing dot for upcoming */}
                  {hasScheduled && (
                    <div className="absolute top-1 right-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500" />
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Side panel - selected day or detail */}
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5">
          {selectedMeeting ? (
            /* Meeting detail */
            <div>
              <button
                onClick={() => setSelectedMeeting(null)}
                className="text-xs text-purple-300/60 hover:text-cyan-400 mb-3 flex items-center gap-1 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Voltar
              </button>

              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white">{selectedMeeting.title}</h3>
                  <p className="text-xs text-purple-300/60">{selectedMeeting.contact_name}</p>
                  {selectedMeeting.created_by_name && (
                    <p className="text-[10px] text-cyan-400/60 mt-0.5">Responsavel: {selectedMeeting.created_by_name}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-300/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-neutral-200">
                    {new Date(selectedMeeting.meeting_at).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {' as '}
                    {formatTime(selectedMeeting.meeting_at)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-300/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-neutral-200">{selectedMeeting.duration_minutes} minutos</span>
                </div>

                {selectedMeeting.location && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-300/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-neutral-200">{selectedMeeting.location}</span>
                  </div>
                )}

                {selectedMeeting.notes && (
                  <div className="p-3 bg-[#2a1245] rounded-lg">
                    <p className="text-xs text-purple-300/60 mb-1 font-medium">Notas</p>
                    <p className="text-xs text-neutral-300 whitespace-pre-wrap">{selectedMeeting.notes}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const typeStyle = MEETING_TYPE_STYLE[selectedMeeting.meeting_type] || MEETING_TYPE_STYLE.OUTRO;
                    return (
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${typeStyle.bg} ${typeStyle.text}`}>
                        {formatMeetingType(selectedMeeting.meeting_type)}
                      </span>
                    );
                  })()}
                  {(() => {
                    const style = STATUS_STYLE[selectedMeeting.status] || STATUS_STYLE.SCHEDULED;
                    return (
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Actions — only for the creator */}
              {(selectedMeeting.created_by_user_id === currentUserId || currentUserRole === 'admin') && (
                <div className="mt-5 pt-4 border-t border-purple-800/20 space-y-2">
                  {selectedMeeting.status === 'SCHEDULED' && (
                    <>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStatus(selectedMeeting.id, 'COMPLETED')}
                          disabled={updatingStatus}
                          className="flex-1 px-3 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50"
                        >
                          Marcar como Concluida
                        </button>
                        <button
                          onClick={() => setEditingMeeting(selectedMeeting)}
                          className="px-3 py-2 text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-colors"
                        >
                          Editar
                        </button>
                      </div>
                      <button
                        onClick={() => handleUpdateStatus(selectedMeeting.id, 'CANCELLED')}
                        disabled={updatingStatus}
                        className="w-full px-3 py-2 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        Cancelar Reuniao
                      </button>
                    </>
                  )}
                  {selectedMeeting.status !== 'SCHEDULED' && (
                    <button
                      onClick={() => setEditingMeeting(selectedMeeting)}
                      className="w-full px-3 py-2 text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-colors"
                    >
                      Editar Reuniao
                    </button>
                  )}
                </div>
              )}

              {/* Register Interaction */}
              {selectedMeeting.contact_id && (
                <div className="mt-4 pt-4 border-t border-purple-800/20">
                  {!showInteractionForm ? (
                    <button
                      onClick={() => setShowInteractionForm(true)}
                      className="w-full px-3 py-2 text-xs font-medium text-purple-300 bg-[#2a1245] border border-purple-700/30 rounded-lg hover:bg-purple-800/30 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Registrar Interacao
                    </button>
                  ) : (
                    <div className="p-3 bg-[#2a1245]/50 rounded-xl border border-purple-700/30 space-y-3">
                      <p className="text-xs font-semibold text-purple-300/80">Nova Interacao — {selectedMeeting.contact_name}</p>
                      <div>
                        <label className="block text-[10px] text-purple-300/50 mb-1">Tipo</label>
                        <select
                          value={interactionData.type}
                          onChange={(e) => setInteractionData({ ...interactionData, type: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs bg-[#2a1245] border border-purple-700/30 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                          {Object.entries(INTERACTION_TYPE_LABELS).map(([k, l]) => (
                            <option key={k} value={k}>{l}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-purple-300/50 mb-1">Resultado</label>
                        <select
                          value={interactionData.outcome}
                          onChange={(e) => setInteractionData({ ...interactionData, outcome: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs bg-[#2a1245] border border-purple-700/30 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                          {Object.entries(INTERACTION_OUTCOME_LABELS).map(([k, l]) => (
                            <option key={k} value={k}>{l}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-purple-300/50 mb-1">Notas</label>
                        <textarea
                          rows={2}
                          value={interactionData.note}
                          onChange={(e) => setInteractionData({ ...interactionData, note: e.target.value })}
                          placeholder="Observacoes..."
                          className="w-full px-2 py-1.5 text-xs bg-[#2a1245] border border-purple-700/30 rounded-lg text-neutral-200 placeholder:text-purple-300/30 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setShowInteractionForm(false); setInteractionData({ type: 'LIGACAO', outcome: 'SEM_RESPOSTA', note: '' }); }}
                          className="px-3 py-1.5 text-[11px] text-purple-300/60 border border-purple-700/30 rounded-lg hover:bg-purple-800/30 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleAddInteraction}
                          disabled={interactionLoading}
                          className="px-3 py-1.5 text-[11px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                        >
                          {interactionLoading ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(selectedMeeting.created_by_user_id === currentUserId || currentUserRole === 'admin') ? (
              <div className="mt-3">
                <button
                  onClick={() => handleDeleteMeeting(selectedMeeting.id)}
                  className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors"
                >
                  Excluir permanentemente
                </button>
              </div>
              ) : (
              <div className="mt-5 pt-4 border-t border-purple-800/20">
                <p className="text-[10px] text-purple-300/40 text-center">Apenas quem criou a reuniao pode edita-la ou exclui-la.</p>
              </div>
              )}
            </div>
          ) : selectedDate ? (
            /* Day detail */
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <p className="text-xs text-purple-300/40 mb-4">
                {selectedDayMeetings.length === 0
                  ? 'Nenhuma reuniao neste dia'
                  : `${selectedDayMeetings.length} reunia${selectedDayMeetings.length === 1 ? 'o' : 'oes'}`}
              </p>

              {selectedDayMeetings.length > 0 ? (
                <div className="space-y-2">
                  {selectedDayMeetings.map((m) => {
                    const style = STATUS_STYLE[m.status] || STATUS_STYLE.SCHEDULED;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMeeting(m)}
                        className="w-full text-left p-3 bg-[#2a1245] rounded-lg hover:bg-purple-800/40 transition-colors border border-purple-700/20 hover:border-cyan-500/30"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-cyan-400">{formatTime(m.meeting_at)}</span>
                          <div className="flex items-center gap-1">
                            {(() => {
                              const typeStyle = MEETING_TYPE_STYLE[m.meeting_type] || MEETING_TYPE_STYLE.OUTRO;
                              return (
                                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.text}`}>
                                  {formatMeetingType(m.meeting_type)}
                                </span>
                              );
                            })()}
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                              {style.label}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-neutral-100 truncate">{m.title}</p>
                        <p className="text-xs text-purple-300/50 truncate">{m.contact_name}</p>
                        {m.created_by_name && (
                          <p className="text-[10px] text-cyan-400/50 truncate mt-0.5">Resp: {m.created_by_name}</p>
                        )}
                        {m.location && (
                          <p className="text-[10px] text-purple-300/30 truncate mt-0.5">{m.location}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-purple-800/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-purple-300/30">Dia livre</p>
                </div>
              )}
            </div>
          ) : (
            /* No day selected */
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-purple-800/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-purple-300/40">Selecione um dia no calendario</p>
              <p className="text-xs text-purple-300/25 mt-1">para ver as reunioes agendadas</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Meeting Modal */}
      {editingMeeting && (
        <MeetingModal
          isOpen={!!editingMeeting}
          onClose={() => setEditingMeeting(null)}
          onConfirm={handleEditConfirm}
          contactName={editingMeeting.contact_name || 'Contato'}
          loading={editLoading}
          initialData={{
            title: editingMeeting.title,
            meeting_at: editingMeeting.meeting_at,
            duration_minutes: editingMeeting.duration_minutes,
            location: editingMeeting.location,
            notes: editingMeeting.notes,
            meeting_type: editingMeeting.meeting_type,
          }}
        />
      )}
    </div>
  );
}
