'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FairEvent } from '@/lib/types';
import { EVENT_STATUS_LABELS, EVENT_STATUS_COLORS } from '@/lib/utils/labels';
import EditEventModal from '@/components/eventos/edit-event-modal';

// Parser seguro de data ISO vinda do banco. Aceita tanto 'YYYY-MM-DD' quanto
// 'YYYY-MM-DDT...' (com tempo/zona), sempre fixando ao meio-dia local pra
// evitar pulo de dia por timezone. Retorna '-' se inválido.
function formatEventDate(raw: string | null | undefined): string {
  if (!raw) return '-';
  const datePart = raw.slice(0, 10);
  const d = new Date(`${datePart}T12:00:00`);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

export default function EventosPage() {
  const router = useRouter();
  const [events, setEvents] = useState<FairEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [userRole, setUserRole] = useState<string>('user');
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => setUserRole(d.role || 'user')).catch(() => {});
  }, []);

  const isAdmin = userRole === 'admin';

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      const res = await fetch(`/api/events?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleDeleteEvent = async (eventId: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteId(null);
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir');
      }
    } catch {
      alert('Erro ao excluir evento');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Feiras & Eventos</h1>
          <p className="text-purple-300/50 text-sm mt-1">Gerencie visitas em feiras e eventos</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors text-sm flex items-center gap-2 self-start"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Evento
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'ATIVO', 'RASCUNHO', 'ENCERRADO'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-purple-800/20 text-purple-300/60 border border-purple-700/20 hover:bg-purple-800/30'
            }`}
          >
            {s === 'all' ? 'Todos' : EVENT_STATUS_LABELS[s] || s}
          </button>
        ))}
      </div>

      {/* Event List */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5 animate-pulse">
              <div className="h-5 bg-purple-700/30 rounded w-3/4 mb-3" />
              <div className="h-4 bg-purple-700/20 rounded w-1/2 mb-2" />
              <div className="h-4 bg-purple-700/20 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 bg-[#1e0f35] rounded-xl border border-purple-800/30">
          <svg className="w-12 h-12 mx-auto text-purple-500/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
          <p className="text-purple-300/50 mb-4">Nenhum evento cadastrado</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600"
          >
            Criar primeiro evento
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-[#1e0f35] rounded-xl border border-purple-800/30 overflow-hidden hover:border-emerald-500/30 transition-all group relative"
            >
              {/* Cover area with action buttons */}
              <div className="relative">
                <Link href={`/eventos/${event.id}`} className="block">
                  {event.cover_image_url ? (
                    <div className="h-32 w-full bg-purple-900/30 overflow-hidden">
                      <img src={event.cover_image_url} alt={event.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-20 w-full bg-gradient-to-br from-purple-900/40 to-emerald-900/20 flex items-center justify-center">
                      <svg className="w-8 h-8 text-purple-500/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                      </svg>
                    </div>
                  )}
                </Link>

                {/* Action buttons on cover */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                  {deleteId === event.id ? (
                    <>
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 bg-[#1e0f35] rounded-lg p-1.5 border border-red-500/30">
                          <button onClick={() => handleDeleteEvent(event.id)} disabled={deleting} className="px-2.5 py-1 bg-red-600 text-white rounded text-[11px] font-medium hover:bg-red-700 disabled:opacity-50">
                            {deleting ? '...' : 'Confirmar'}
                          </button>
                          <button onClick={() => setDeleteId(null)} disabled={deleting} className="px-2.5 py-1 bg-purple-800/40 text-purple-300/60 rounded text-[11px] font-medium hover:bg-purple-800/60 disabled:opacity-50">
                            Cancelar
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => { e.preventDefault(); setEditId(event.id); }}
                        className="p-1.5 text-white/70 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors bg-black/40 backdrop-blur-sm"
                        title="Editar evento"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.preventDefault(); setDeleteId(event.id); }}
                          className="p-1.5 text-white/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors bg-black/40 backdrop-blur-sm"
                          title="Excluir evento"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <Link href={`/eventos/${event.id}`} className="block p-5 hover:bg-[#240f45] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-white font-semibold group-hover:text-emerald-400 transition-colors truncate pr-2">
                    {event.name}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${EVENT_STATUS_COLORS[event.status] || 'bg-neutral-500/20 text-neutral-400'}`}>
                    {EVENT_STATUS_LABELS[event.status] || event.status}
                  </span>
                </div>

                {event.location && (
                  <p className="text-purple-300/50 text-xs mb-2 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {event.location}
                  </p>
                )}

                <p className="text-purple-300/50 text-xs mb-4">
                  {formatEventDate(event.start_date)} - {formatEventDate(event.end_date)}
                </p>

                {/* Progress */}
                <div className="mt-auto">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-purple-200/70">Stands visitados</span>
                    <span className="text-emerald-400 font-bold">
                      {event.visited_count || 0}/{event.booth_count || 0}
                    </span>
                  </div>
                  <div className="w-full bg-purple-900/40 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${event.booth_count ? Math.round(((event.visited_count || 0) / event.booth_count) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreated={(event) => {
            setShowCreate(false);
            router.push(`/eventos/${event.id}`);
          }}
        />
      )}

      {/* Edit Modal */}
      {editId && (() => {
        const ev = events.find((e) => e.id === editId);
        if (!ev) return null;
        return (
          <EditEventModal
            event={ev}
            onClose={() => setEditId(null)}
            onSaved={() => { setEditId(null); fetchEvents(); }}
          />
        );
      })()}
    </div>
  );
}

// --- Create Event Modal ---
function CreateEventModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (event: FairEvent) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    pipeline_id: '',
    stage_id: '',
  });
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/pipelines')
      .then((r) => r.json())
      .then((d) => setPipelines(d.pipelines || d || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (form.pipeline_id) {
      const p = pipelines.find((p: any) => p.id === form.pipeline_id);
      setStages(p?.stages || []);
      if (!form.stage_id && p?.stages?.length) {
        setForm((f) => ({ ...f, stage_id: p.stages[0].id }));
      }
    } else {
      setStages([]);
    }
  }, [form.pipeline_id, pipelines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.start_date || !form.end_date) {
      setError('Preencha nome e datas');
      return;
    }
    if (!form.pipeline_id) {
      setError('Selecione uma pipeline para direcionar os contatos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao criar');
      }
      const event = await res.json();
      onCreated(event);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm border rounded-lg bg-[#2a1245] text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 border-purple-700/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">Novo Evento / Feira</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-1">Nome *</label>
            <input
              type="text"
              required
              placeholder="Ex: Agrishow 2026"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-1">Local</label>
            <input
              type="text"
              placeholder="Ex: Ribeirão Preto - SP"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-purple-200/80 mb-1">Data Início *</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-200/80 mb-1">Data Fim *</label>
              <input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-1">Pipeline <span className="text-red-400">*</span></label>
            <select
              value={form.pipeline_id}
              onChange={(e) => setForm((f) => ({ ...f, pipeline_id: e.target.value, stage_id: '' }))}
              className={inputClass}
              required
            >
              <option value="">Selecione uma pipeline</option>
              {pipelines.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-purple-300/40 mt-1">Obrigatório — contatos criados nos check-ins irão para esta pipeline</p>
          </div>

          {stages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-purple-200/80 mb-1">Estágio Inicial</label>
              <select
                value={form.stage_id}
                onChange={(e) => setForm((f) => ({ ...f, stage_id: e.target.value }))}
                className={inputClass}
              >
                {stages.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 text-sm"
            >
              {loading ? 'Criando...' : 'Criar Evento'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-purple-800/30 text-purple-200 rounded-lg font-medium hover:bg-purple-800/50 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
