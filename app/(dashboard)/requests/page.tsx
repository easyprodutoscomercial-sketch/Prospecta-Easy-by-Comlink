'use client';

import { useState, useEffect, useMemo } from 'react';
import type { AccessRequest } from '@/lib/types';
import { useToast } from '@/lib/toast-context';
import Link from 'next/link';

export default function RequestsPage() {
  const toast = useToast();
  const [received, setReceived] = useState<AccessRequest[]>([]);
  const [sent, setSent] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'PENDING' | 'APPROVED' | 'REJECTED'>('');

  useEffect(() => {
    fetchRequests();
    fetchMe();
  }, []);

  const fetchMe = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUserId(data.user_id);
      }
    } catch { /* silent */ }
  };

  const fetchRequests = async () => {
    try {
      const [receivedRes, sentRes] = await Promise.all([
        fetch('/api/access-requests?role=owner'),
        fetch('/api/access-requests?role=requester'),
      ]);

      if (receivedRes.ok) {
        const data = await receivedRes.json();
        setReceived(data.requests || []);
      }
      if (sentRes.ok) {
        const data = await sentRes.json();
        setSent(data.requests || []);
      }
    } catch {
      toast.error('Erro ao carregar solicitacoes');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/access-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        toast.success(status === 'APPROVED' ? 'Aprovado! Contato transferido.' : 'Solicitacao rejeitada.');
        fetchRequests();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao resolver');
      }
    } catch {
      toast.error('Erro ao resolver solicitacao');
    } finally {
      setActionLoading(null);
    }
  };

  // Merge all requests, deduplicate by id, sort by date desc
  const allRequests = useMemo(() => {
    const map = new Map<string, AccessRequest & { direction: 'received' | 'sent' | 'both' }>();

    for (const r of received) {
      map.set(r.id, { ...r, direction: 'received' });
    }
    for (const s of sent) {
      if (map.has(s.id)) {
        map.set(s.id, { ...map.get(s.id)!, direction: 'both' });
      } else {
        map.set(s.id, { ...s, direction: 'sent' });
      }
    }

    let list = Array.from(map.values());

    if (statusFilter) {
      list = list.filter(r => r.status === statusFilter);
    }

    list.sort((a, b) => {
      // Pending first, then by date desc
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (b.status === 'PENDING' && a.status !== 'PENDING') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list;
  }, [received, sent, statusFilter]);

  const pendingCount = useMemo(() =>
    allRequests.filter(r => r.status === 'PENDING').length
  , [allRequests]);

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      relative: getRelativeTime(d),
    };
  };

  function getRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min atras`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atras`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Ontem';
    if (days < 7) return `${days} dias atras`;
    return '';
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Pendente
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            Aprovado
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            Rejeitado
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-emerald-400 mb-2">Solicitacoes</h1>
        <div className="animate-pulse space-y-4 mt-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-purple-800/20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">Solicitacoes</h1>
          <p className="text-sm text-purple-300/50 mt-1">Todas as transferencias de contatos em um so lugar</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="px-3 py-1.5 text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-lg">
              {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchRequests(); }}
            className="p-2 rounded-lg bg-[#1e0f35] border border-purple-800/20 text-purple-300/50 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
            title="Atualizar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {(['', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => {
          const labels: Record<string, string> = { '': 'Todas', PENDING: 'Pendentes', APPROVED: 'Aprovadas', REJECTED: 'Rejeitadas' };
          const isActive = statusFilter === f;
          return (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  : 'text-purple-300/50 bg-[#1e0f35] border border-purple-800/20 hover:text-purple-200'
              }`}
            >
              {labels[f]}
            </button>
          );
        })}
      </div>

      {/* List */}
      {allRequests.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-800/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-300/25" viewBox="0 0 24 24" fill="none">
              <path d="M8 4l-4 4 4 4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 12l4 4-4 4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <line x1="4" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              <line x1="10" y1="16" x2="20" y2="16" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-sm text-purple-300/40">
            {statusFilter ? 'Nenhuma solicitacao com esse filtro.' : 'Nenhuma solicitacao ainda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allRequests.map((req) => {
            const dt = formatDateTime(req.created_at);
            const resolvedDt = req.resolved_at ? formatDateTime(req.resolved_at) : null;
            const isOwner = req.owner_user_id === currentUserId;
            const isRequester = req.requester_user_id === currentUserId;
            const isPending = req.status === 'PENDING';

            return (
              <div
                key={req.id}
                className={`bg-[#1e0f35] rounded-xl border transition-all ${
                  isPending
                    ? 'border-amber-500/20 hover:border-amber-500/40 shadow-sm shadow-amber-500/5'
                    : 'border-purple-800/20 hover:border-purple-700/30'
                }`}
              >
                <div className="p-4 sm:p-5">
                  {/* Top row: substitution icon + main info + status */}
                  <div className="flex items-start gap-3">
                    {/* Substitution icon */}
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                      isPending ? 'bg-amber-500/10' : req.status === 'APPROVED' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                    }`}>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path d="M8 4l-4 4 4 4" stroke={isPending ? '#f59e0b' : req.status === 'APPROVED' ? '#22c55e' : '#ef4444'} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16 12l4 4-4 4" stroke={isPending ? '#f59e0b' : req.status === 'APPROVED' ? '#22c55e' : '#ef4444'} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="4" y1="8" x2="14" y2="8" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" />
                        <line x1="10" y1="16" x2="20" y2="16" stroke="#22c55e" strokeWidth={2} strokeLinecap="round" />
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Contact name */}
                      <Link href={`/contacts/${req.contact_id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                        <span className="text-sm font-bold text-emerald-400">{req.contact_name || 'Contato'}</span>
                      </Link>

                      {/* Transfer description */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {/* From (current owner - red arrow out) */}
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span className="text-xs text-red-400/80 font-medium">{req.owner_name}</span>
                        </div>

                        <svg className="w-4 h-4 text-purple-400/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>

                        {/* To (requester - green arrow in) */}
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span className="text-xs text-emerald-400/80 font-medium">{req.requester_name}</span>
                        </div>

                        {isOwner && isPending && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-800/30 text-purple-300/50 font-medium ml-1">para voce aprovar</span>
                        )}
                        {isRequester && isPending && !isOwner && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-800/30 text-purple-300/50 font-medium ml-1">voce solicitou</span>
                        )}
                      </div>

                      {/* Date/time row */}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-purple-300/40">
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {dt.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {dt.time}
                        </span>
                        {dt.relative && (
                          <span className="text-purple-300/30">({dt.relative})</span>
                        )}
                        {resolvedDt && (
                          <>
                            <span className="text-purple-500/30">·</span>
                            <span className="text-purple-300/30">
                              Resolvido {resolvedDt.date} as {resolvedDt.time}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="shrink-0">
                      {statusBadge(req.status)}
                    </div>
                  </div>

                  {/* Action buttons for owner on pending requests */}
                  {isOwner && isPending && (
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-purple-800/15">
                      <button
                        onClick={() => handleResolve(req.id, 'APPROVED')}
                        disabled={actionLoading === req.id}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-40 transition-all shadow-lg shadow-emerald-600/20"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        {actionLoading === req.id ? 'Processando...' : 'Aprovar transferencia'}
                      </button>
                      <button
                        onClick={() => handleResolve(req.id, 'REJECTED')}
                        disabled={actionLoading === req.id}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 disabled:opacity-40 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
