'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import PortalTicketList from '@/components/portal/portal-ticket-list';
import PortalTicketForm from '@/components/portal/portal-ticket-form';
import PortalTicketDetail from '@/components/portal/portal-ticket-detail';

interface ProjectInfo {
  id: string;
  name: string;
  description: string | null;
}

interface PortalTicket {
  id: string;
  title: string;
  ticket_type: string;
  category: string;
  priority: string;
  severity: string | null;
  status: string;
  created_at: string;
}

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [tickets, setTickets] = useState<PortalTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inactive, setInactive] = useState(false);
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Load project info
        const projRes = await fetch(`/api/portal/${token}`);
        if (!projRes.ok) {
          const d = await projRes.json();
          if (d.inactive) {
            setInactive(true);
          } else {
            setError(d.error || 'Portal nao encontrado');
          }
          setLoading(false);
          return;
        }
        const projData = await projRes.json();
        setProject(projData);

        // Load tickets
        const ticketsRes = await fetch(`/api/portal/${token}/tickets`);
        if (ticketsRes.ok) {
          const ticketsData = await ticketsRes.json();
          setTickets(ticketsData.tickets || []);
        }
      } catch {
        setError('Erro ao carregar portal');
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const handleTicketCreated = (ticket: any) => {
    setTickets((prev) => [ticket, ...prev]);
    setView('list');
  };

  const handleSelectTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setView('detail');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-purple-800/30 rounded-xl" />
          <div className="h-5 bg-purple-800/20 rounded w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (inactive) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 mx-auto mb-4 text-amber-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-xl font-bold text-neutral-100 mb-2">Portal Desativado</h1>
          <p className="text-sm text-neutral-400">Este portal foi desativado. Entre em contato com o responsavel.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-xl font-bold text-neutral-100 mb-2">Erro</h1>
          <p className="text-sm text-neutral-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[#1e0f35] border-b border-purple-800/20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <h1 className="text-lg font-bold text-neutral-100">{project.name}</h1>
              </div>
              {project.description && (
                <p className="text-xs text-neutral-500 mt-0.5 ml-7">{project.description}</p>
              )}
            </div>
            {view !== 'form' && (
              <button
                onClick={() => setView('form')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Novo Chamado
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {view === 'list' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-neutral-300">
                Chamados ({tickets.length})
              </h2>
            </div>
            <PortalTicketList
              tickets={tickets}
              onSelect={handleSelectTicket}
            />
          </div>
        )}

        {view === 'form' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-[#1e0f35] rounded-xl border border-purple-800/20 p-6">
              <h2 className="text-lg font-bold text-neutral-100 mb-4">Abrir Chamado</h2>
              <PortalTicketForm
                token={token}
                onCreated={handleTicketCreated}
                onCancel={() => setView('list')}
              />
            </div>
          </div>
        )}

        {view === 'detail' && selectedTicketId && (
          <PortalTicketDetail
            token={token}
            ticketId={selectedTicketId}
            onBack={() => { setView('list'); setSelectedTicketId(null); }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-purple-800/10 mt-8">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center">
          <p className="text-[10px] text-neutral-600">Portal de Suporte - Controlei CRM</p>
        </div>
      </footer>
    </div>
  );
}
