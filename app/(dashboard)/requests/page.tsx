'use client';

import { useState, useEffect } from 'react';
import type { AccessRequest } from '@/lib/types';
import { useToast } from '@/lib/toast-context';

export default function RequestsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [received, setReceived] = useState<AccessRequest[]>([]);
  const [sent, setSent] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

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
      toast.error('Erro ao carregar solicitações');
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
        toast.success(status === 'APPROVED' ? 'Acesso aprovado! Contato transferido.' : 'Solicitação rejeitada.');
        fetchRequests();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao resolver solicitação');
      }
    } catch {
      toast.error('Erro ao resolver solicitação');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingReceived = received.filter((r) => r.status === 'PENDING');
  const resolvedReceived = received.filter((r) => r.status !== 'PENDING');

  const statusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">Pendente</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Aprovado</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-red-500/15 text-red-400 border border-red-500/20">Rejeitado</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-emerald-400 mb-2">Solicitacoes de Acesso</h1>
        <p className="text-sm text-purple-300/60 mb-6">Gerencie solicitacoes de acesso a contatos atribuidos.</p>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-purple-800/30 rounded-lg w-64" />
          <div className="h-32 bg-purple-800/30 rounded-lg" />
          <div className="h-32 bg-purple-800/30 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-emerald-400 mb-2">Solicitacoes de Acesso</h1>
      <p className="text-sm text-purple-300/60 mb-6">Gerencie solicitacoes de acesso a contatos atribuidos.</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#1e0f35] rounded-xl p-1 w-fit border border-purple-800/30">
        <button
          onClick={() => setTab('received')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            tab === 'received'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-sm shadow-emerald-500/10'
              : 'text-purple-200/60 hover:text-emerald-300 border border-transparent'
          }`}
        >
          Recebidas {pendingReceived.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 text-white rounded-full min-w-[18px] text-center animate-pulse">
              {pendingReceived.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            tab === 'sent'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-sm shadow-emerald-500/10'
              : 'text-purple-200/60 hover:text-emerald-300 border border-transparent'
          }`}
        >
          Enviadas
        </button>
      </div>

      {tab === 'received' && (
        <div className="space-y-6">
          {/* Pending */}
          {pendingReceived.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">Pendentes</h2>
              <div className="space-y-3">
                {pendingReceived.map((req) => (
                  <div key={req.id} className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-emerald-500/20 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="avatar-orbit-sm shrink-0">
                          <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                            {req.requester_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-neutral-100">
                            {req.requester_name} <span className="text-purple-300/50 font-normal">solicita acesso a</span> <span className="text-emerald-400 font-bold">{req.contact_name}</span>
                          </p>
                          <p className="text-[11px] text-purple-300/50">
                            {req.requester_email} · {new Date(req.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleResolve(req.id, 'APPROVED')}
                        disabled={actionLoading === req.id}
                        className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-40 transition-all shadow-lg shadow-emerald-600/20"
                      >
                        {actionLoading === req.id ? '...' : 'Aprovar'}
                      </button>
                      <button
                        onClick={() => handleResolve(req.id, 'REJECTED')}
                        disabled={actionLoading === req.id}
                        className="px-4 py-2 text-xs font-bold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 disabled:opacity-40 transition-all"
                      >
                        Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolved */}
          {resolvedReceived.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-purple-300/50 mb-3">Historico</h2>
              <div className="space-y-3">
                {resolvedReceived.map((req) => (
                  <div key={req.id} className="bg-[#1e0f35]/60 border border-purple-800/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-300">
                        {req.requester_name} <span className="text-purple-300/40">—</span> <span className="text-purple-200">{req.contact_name}</span>
                      </p>
                      <p className="text-[11px] text-purple-300/40 mt-0.5">
                        {new Date(req.created_at).toLocaleDateString('pt-BR')}
                        {req.resolved_at && ` · Resolvido em ${new Date(req.resolved_at).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                    {statusBadge(req.status)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {received.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-800/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-300/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm text-purple-300/40">Nenhuma solicitacao recebida.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'sent' && (
        <div className="space-y-3">
          {sent.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-800/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-300/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <p className="text-sm text-purple-300/40">Nenhuma solicitacao enviada.</p>
            </div>
          ) : (
            sent.map((req) => (
              <div key={req.id} className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-purple-700/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-100">
                    <span className="text-purple-300/50 font-normal text-xs uppercase tracking-wider">Contato:</span>{' '}
                    <span className="text-emerald-400 font-bold">{req.contact_name}</span>
                  </p>
                  <p className="text-[11px] text-purple-300/50 mt-1">
                    Responsavel: <span className="text-purple-200">{req.owner_name}</span> · {new Date(req.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {statusBadge(req.status)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
