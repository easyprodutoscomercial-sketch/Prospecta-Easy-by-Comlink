'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { FairEvent, EventBooth, BoothVisit } from '@/lib/types';
import { EVENT_STATUS_LABELS, EVENT_STATUS_COLORS, BOOTH_STATUS_COLORS, PROSPECT_TYPE_LABELS, PROSPECT_TYPE_COLORS } from '@/lib/utils/labels';
import { enqueueOrSend, fileToBase64 } from '@/lib/offline/queue';
import {
  draftSave,
  draftLoad,
  draftClear,
  draftPruneOld,
  fileToDataUrl,
  dataUrlToFile,
  formatDraftAge,
  DRAFT_MAX_AGE_MS,
} from '@/lib/offline/drafts';
import EditEventModal from '@/components/eventos/edit-event-modal';
import DeleteConfirmModal from '@/components/ui/delete-confirm-modal';
import ContactAvatar from '@/components/contacts/contact-avatar';

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

type Tab = 'dashboard' | 'stands' | 'map' | 'mapa-oficial' | 'timeline' | 'followup' | 'contatos';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [event, setEvent] = useState<FairEvent | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePreview, setDeletePreview] = useState<any>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [userRole, setUserRole] = useState<string>('user');
  const [preselectedBoothId, setPreselectedBoothId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [openStandFormNonce, setOpenStandFormNonce] = useState(0);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [activeDraftContactId, setActiveDraftContactId] = useState<string | null>(null);
  const [walkInDrafts, setWalkInDrafts] = useState<any[]>([]);
  const [showDraftsList, setShowDraftsList] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [discardingDraftId, setDiscardingDraftId] = useState<string | null>(null);

  const refreshDrafts = useCallback(async () => {
    try {
      const res = await fetch(`/api/contacts?drafts=true&event_id=${id}&limit=100`);
      if (!res.ok) return;
      const data = await res.json();
      setWalkInDrafts(data.contacts || []);
    } catch {
      // silent — se a rede cair, a lista fica como esta
    }
  }, [id]);

  useEffect(() => {
    refreshDrafts();
  }, [refreshDrafts]);

  // Auto-resume: abre o walk-in form direto num rascunho especifico passado
  // via query param. Usado pela pagina /contacts/rascunhos pra saltar direto
  // na continuacao do cadastro.
  useEffect(() => {
    const resumeId = searchParams.get('resumeDraft');
    if (resumeId && !showWalkIn) {
      setActiveDraftContactId(resumeId);
      setShowWalkIn(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openNewWalkIn = async () => {
    if (creatingDraft) return;
    setCreatingDraft(true);
    try {
      const res = await fetch('/api/contacts/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erro ao criar rascunho');
        return;
      }
      const draft = await res.json();
      setActiveDraftContactId(draft.id);
      setShowWalkIn(true);
      setShowDraftsList(false);
      refreshDrafts();
    } catch {
      alert('Sem conexao — tente novamente');
    } finally {
      setCreatingDraft(false);
    }
  };

  const openExistingDraft = (contactId: string) => {
    setActiveDraftContactId(contactId);
    setShowWalkIn(true);
    setShowDraftsList(false);
  };

  const discardDraft = async (contactId: string) => {
    // Trava contra clique duplo: se ja esta deletando este id, ignora.
    if (discardingDraftId === contactId) return;
    setDiscardingDraftId(contactId);
    // Remove otimisticamente da lista — se a chamada falhar, o refresh joga de volta.
    setWalkInDrafts((prev) => prev.filter((d: any) => d.id !== contactId));
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
      // 404 = ja foi deletado antes (ex: clique duplo). Trata como sucesso.
      if (!res.ok && res.status !== 404) {
        // Erro real: recarrega a lista pra recuperar o item removido otimisticamente
        await refreshDrafts();
      }
    } catch {
      await refreshDrafts();
    } finally {
      setDiscardingDraftId(null);
    }
  };

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => setUserRole(d.role || 'user')).catch(() => {});
  }, []);

  const isAdmin = userRole === 'admin';

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}`);
      if (res.ok) {
        setEvent(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-purple-700/30 rounded w-1/3" />
        <div className="h-4 bg-purple-700/20 rounded w-1/4" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-[#1e0f35] rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <p className="text-purple-300/50">Evento não encontrado</p>
        <Link href="/eventos" className="text-emerald-400 text-sm mt-2 inline-block hover:underline">Voltar</Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'contatos', label: 'Contatos' },
    { key: 'stands', label: 'Stands' },
    { key: 'map', label: 'Mapa' },
    ...(event.external_map_url ? [{ key: 'mapa-oficial' as Tab, label: 'Mapa Oficial' }] : []),
    { key: 'timeline', label: 'Timeline' },
    { key: 'followup', label: 'Follow-up' },
  ];

  // Filtra da lista de rascunhos o que esta aberto agora — nao faz sentido
  // listar "pendente" aquele que o vendedor ja esta editando.
  const visibleDrafts =
    showWalkIn && activeDraftContactId
      ? walkInDrafts.filter((d: any) => d.id !== activeDraftContactId)
      : walkInDrafts;

  return (
    <div className="space-y-6">
      {/* Cover image */}
      {event.cover_image_url && (
        <div className="w-full h-40 sm:h-56 rounded-xl overflow-hidden -mb-2">
          <img src={event.cover_image_url} alt={event.name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/eventos" className="text-purple-300/50 hover:text-emerald-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{event.name}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${EVENT_STATUS_COLORS[event.status]}`}>
              {EVENT_STATUS_LABELS[event.status]}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-purple-300/50 ml-8">
            {event.location && <span>{event.location}</span>}
            <span>
              {formatEventDate(event.start_date)} - {formatEventDate(event.end_date)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-8 sm:ml-0">
          <button
            onClick={() => {
              setShowWalkIn(false);
              setTab('stands');
              setOpenStandFormNonce((n) => n + 1);
            }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            title="Cadastrar um novo stand neste evento"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
            Novo Stand
          </button>
          <button
            onClick={openNewWalkIn}
            disabled={event.status !== 'ATIVO' || creatingDraft}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cyan-500"
            title={event.status === 'ATIVO' ? 'Contato encontrado fora de stand (corredor, café, palestra)' : 'Ative a feira em Feiras & Eventos para capturar contatos'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {creatingDraft ? 'Abrindo...' : 'Contato Avulso'}
          </button>
          {visibleDrafts.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowDraftsList((v) => !v)}
                className="px-3 py-2 bg-amber-500/15 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-bold hover:bg-amber-500/25 transition-colors flex items-center gap-1.5"
                title="Contatos avulsos iniciados mas nao finalizados"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Rascunhos ({visibleDrafts.length})
              </button>
              {showDraftsList && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowDraftsList(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-[#1e0f35] border border-amber-500/30 rounded-xl shadow-2xl shadow-black/40 z-40 p-2">
                    <div className="px-3 py-2 text-[11px] uppercase tracking-widest text-amber-300/70 font-bold border-b border-purple-800/30">
                      Rascunhos pendentes
                    </div>
                    {visibleDrafts.map((draft: any) => {
                      const displayName = draft.name && draft.name !== '(rascunho)' ? draft.name : '(sem nome)';
                      const displayCompany = draft.company || '';
                      const updatedAt = draft.updated_at ? new Date(draft.updated_at).getTime() : Date.now();
                      return (
                        <div
                          key={draft.id}
                          className="flex items-center gap-2 p-2 hover:bg-purple-900/30 rounded-lg transition-colors"
                        >
                          <button
                            onClick={() => openExistingDraft(draft.id)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="text-sm text-white font-medium truncate">
                              {displayName}
                            </div>
                            {displayCompany && (
                              <div className="text-xs text-purple-300/60 truncate">{displayCompany}</div>
                            )}
                            <div className="text-[10px] text-amber-300/60 mt-0.5">
                              {formatDraftAge(updatedAt)}
                            </div>
                          </button>
                          <button
                            onClick={() => discardDraft(draft.id)}
                            className="shrink-0 p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            title="Descartar rascunho"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          <a
            href={`/api/events/${id}/export-contacts`}
            download
            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium hover:bg-emerald-500/15 hover:border-emerald-400 transition-colors flex items-center gap-1.5"
            title="Baixar planilha Excel com todos os leads capturados neste evento"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar Leads
          </a>
          <button
            onClick={() => setShowEdit(true)}
            className="px-3 py-1.5 bg-purple-800/30 text-purple-200/70 border border-purple-700/30 rounded-lg text-xs font-medium hover:bg-purple-800/50 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </button>
          {isAdmin && (
            <button
              onClick={async () => {
                // Busca preview antes de abrir o modal
                try {
                  const res = await fetch(`/api/events/${id}/delete-preview`);
                  if (res.ok) {
                    setDeletePreview(await res.json());
                    setShowDeleteModal(true);
                  }
                } catch { /* silent */ }
              }}
              className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Excluir
            </button>
          )}
        </div>
      </div>

      {/* Banner: feira nao ativa — contatos bloqueados ate o admin ativar */}
      {event.status !== 'ATIVO' && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${
          event.status === 'RASCUNHO'
            ? 'bg-amber-500/10 border-amber-500/40'
            : 'bg-purple-500/10 border-purple-500/40'
        }`}>
          <svg className={`w-5 h-5 shrink-0 mt-0.5 ${event.status === 'RASCUNHO' ? 'text-amber-400' : 'text-purple-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className={`font-semibold text-sm ${event.status === 'RASCUNHO' ? 'text-amber-300' : 'text-purple-200'}`}>
              {event.status === 'RASCUNHO' ? 'Feira em rascunho — captura de contatos bloqueada' : 'Feira encerrada — captura de contatos bloqueada'}
            </div>
            <div className={`text-xs mt-0.5 ${event.status === 'RASCUNHO' ? 'text-amber-200/80' : 'text-purple-200/80'}`}>
              Cadastro de stands e edicao continuam liberados. Pra registrar visitas ou contatos avulsos, um administrador precisa {event.status === 'RASCUNHO' ? 'ativar' : 'reabrir'} a feira em <Link href="/eventos" className="underline font-medium">Feiras & Eventos</Link>.
            </div>
          </div>
        </div>
      )}

      {/* Busca global de stand — sempre visível no topo, vai pra aba Stands ao digitar */}
      {!showWalkIn && (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/50 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => {
              const v = e.target.value;
              setGlobalSearch(v);
              if (v.trim() && tab !== 'stands') setTab('stands');
            }}
            placeholder="Buscar stand por empresa, número ou setor..."
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-[#1e0f35] border border-purple-700/30 rounded-lg text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent"
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400/50 hover:text-white transition-colors"
              title="Limpar busca"
              aria-label="Limpar busca"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      {!showWalkIn && (
        <div className="flex gap-1 bg-purple-900/20 rounded-lg p-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                tab === t.key
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-purple-300/50 hover:text-white hover:bg-purple-800/30'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Walk-in form (substitui o conteudo principal quando ativo).
          `key` por contact_id garante remount limpo ao trocar de rascunho. */}
      {showWalkIn && activeDraftContactId && (
        <WalkInForm
          key={activeDraftContactId}
          eventId={id}
          contactId={activeDraftContactId}
          usesAssociation={!!event.uses_association}
          onBack={() => {
            setShowWalkIn(false);
            refreshDrafts();
          }}
          onDone={() => {
            setShowWalkIn(false);
            refreshDrafts();
            fetchEvent();
          }}
        />
      )}

      {/* Tab content */}
      {!showWalkIn && tab === 'dashboard' && <DashboardTab eventId={id} event={event} />}
      {!showWalkIn && tab === 'stands' && (
        <StandsTab
          eventId={id}
          preselectedBoothId={preselectedBoothId}
          onClearPreselect={() => setPreselectedBoothId(null)}
          initialSearch={globalSearch}
          isAdmin={isAdmin}
          openFormNonce={openStandFormNonce}
          eventStatus={event.status}
        />
      )}
      {!showWalkIn && tab === 'map' && (
        <MapTab
          eventId={id}
          event={event}
          isAdmin={isAdmin}
          onEventUpdated={fetchEvent}
          onOpenStand={(boothId) => {
            setPreselectedBoothId(boothId);
            setTab('stands');
          }}
        />
      )}
      {!showWalkIn && tab === 'mapa-oficial' && event.external_map_url && (
        <ExternalMapTab url={event.external_map_url} eventName={event.name} />
      )}
      {!showWalkIn && tab === 'timeline' && <TimelineTab eventId={id} />}
      {!showWalkIn && tab === 'followup' && <FollowUpTab eventId={id} event={event} />}
      {!showWalkIn && tab === 'contatos' && <ContatosTab eventId={id} />}

      {/* Edit Modal */}
      {showEdit && event && (
        <EditEventModal
          event={event}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); fetchEvent(); }}
        />
      )}

      {/* Delete Modal — admin-only, digite-o-nome pra confirmar */}
      {showDeleteModal && event && deletePreview && (
        <DeleteConfirmModal
          open={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirmed={() => {
            setShowDeleteModal(false);
            router.push('/eventos');
          }}
          title={`Apagar Feira: ${event.name}`}
          confirmName={event.name}
          description="Essa feira e TUDO ligado a ela sera apagado: stands, visitas, contatos, interacoes, reunioes e anexos. Um snapshot automatico vai ser gerado antes — voce podera ver o resumo historico depois em 'Historico de Feiras'."
          items={[
            { label: 'Stands cadastrados', value: deletePreview.counts?.booths || 0 },
            { label: 'Check-ins (visitas)', value: deletePreview.counts?.visits || 0 },
            { label: 'Contatos da feira', value: deletePreview.counts?.contacts || 0, critical: (deletePreview.counts?.contacts || 0) > 0 },
            { label: 'Interacoes (ligacoes, whatsapp...)', value: deletePreview.counts?.interactions || 0 },
            { label: 'Reunioes agendadas', value: deletePreview.counts?.meetings || 0 },
            { label: 'Anexos (fotos, arquivos)', value: deletePreview.counts?.attachments || 0 },
            { label: 'Leads quentes', value: deletePreview.counts?.hot_leads || 0 },
            { label: 'Deals com valor', value: deletePreview.counts?.high_value_deals || 0 },
            {
              label: 'Valor total em pipeline',
              value: (deletePreview.counts?.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
              prefix: 'R$ ',
              critical: (deletePreview.counts?.total_value || 0) > 0,
            },
          ]}
          deleteUrl={`/api/events/${id}`}
        />
      )}
    </div>
  );
}

// --- Edit Event Modal ---
// --- Status Toggle ---
// --- Dashboard Tab ---
// --- Meta + Urgência Card ---
// Mostra "quanto falta pra bater a meta de visitar todos os stands" com
// indicador visual de urgência baseado em quantos dias restam no evento.
// Só aparece se o evento está ATIVO e tem stands cadastrados.
function MetaUrgenciaCard({ event, stats }: { event: FairEvent; stats: any }) {
  if (event.status !== 'ATIVO') return null;
  const total = stats.total_booths || 0;
  if (total === 0) return null;

  const visited = stats.visited_booths || 0;
  const pending = total - visited;
  const progressPct = Math.round((visited / total) * 100);

  // Calcula dias do evento e dias restantes
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(event.start_date.slice(0, 10) + 'T00:00:00');
  const endDate = new Date(event.end_date.slice(0, 10) + 'T00:00:00');
  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1);
  const daysElapsed = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / msPerDay) + 1);
  const daysRemaining = Math.max(0, Math.floor((endDate.getTime() - today.getTime()) / msPerDay) + 1);

  const eventNotStarted = today < startDate;
  const eventEnded = today > endDate;

  // Velocidade requerida (stands/dia) pra bater 100% até o fim
  const requiredPerDay = daysRemaining > 0 ? Math.ceil(pending / daysRemaining) : pending;

  // Se o evento tá no meio do caminho, compara progresso esperado vs real
  // esperado = (daysElapsed / totalDays) * 100
  const expectedPct = Math.min(100, Math.round((Math.max(1, daysElapsed) / totalDays) * 100));
  const delta = progressPct - expectedPct; // positivo = à frente, negativo = atrás

  // Determina urgência
  let urgencia: 'ok' | 'atencao' | 'critico' | 'concluido' | 'aguardando' = 'ok';
  let mensagem = '';
  let cor = { bg: '', border: '', text: '', barFrom: '', barTo: '', icon: '' };

  if (eventNotStarted) {
    urgencia = 'aguardando';
    mensagem = `Evento começa em ${Math.floor((startDate.getTime() - today.getTime()) / msPerDay)} dia(s). Prepare os stands!`;
    cor = {
      bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-300',
      barFrom: 'from-purple-600', barTo: 'to-purple-400', icon: 'text-purple-400',
    };
  } else if (eventEnded) {
    if (progressPct === 100) {
      urgencia = 'concluido';
      mensagem = `Evento encerrado com cobertura total! 🎯`;
      cor = {
        bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300',
        barFrom: 'from-emerald-600', barTo: 'to-emerald-400', icon: 'text-emerald-400',
      };
    } else {
      urgencia = 'critico';
      mensagem = `Evento encerrado. ${pending} stand(s) ficaram sem visita.`;
      cor = {
        bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300',
        barFrom: 'from-red-600', barTo: 'to-red-400', icon: 'text-red-400',
      };
    }
  } else if (progressPct >= 100) {
    urgencia = 'concluido';
    mensagem = `🎯 Todos os stands visitados! Faltam ${daysRemaining} dia(s) pra fechar.`;
    cor = {
      bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300',
      barFrom: 'from-emerald-600', barTo: 'to-emerald-400', icon: 'text-emerald-400',
    };
  } else if (delta < -15) {
    urgencia = 'critico';
    mensagem = `🚨 Atrasado: faltam ${pending} stands em ${daysRemaining} dia(s). Ritmo necessário: ${requiredPerDay}/dia.`;
    cor = {
      bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300',
      barFrom: 'from-red-600', barTo: 'to-red-400', icon: 'text-red-400',
    };
  } else if (delta < 0) {
    urgencia = 'atencao';
    mensagem = `⚠️ Ritmo apertado: faltam ${pending} stands em ${daysRemaining} dia(s). Necessário ${requiredPerDay}/dia.`;
    cor = {
      bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300',
      barFrom: 'from-amber-600', barTo: 'to-amber-400', icon: 'text-amber-400',
    };
  } else {
    urgencia = 'ok';
    mensagem = `✅ No ritmo: ${pending} stand(s) restante(s) em ${daysRemaining} dia(s).`;
    cor = {
      bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300',
      barFrom: 'from-emerald-600', barTo: 'to-emerald-400', icon: 'text-emerald-400',
    };
  }

  return (
    <div className={`rounded-xl border-2 p-5 ${cor.bg} ${cor.border} transition-all`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${cor.bg}`}>
            <svg className={`w-5 h-5 ${cor.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5">Meta do Evento</div>
            <div className={`text-base font-bold ${cor.text}`}>{mensagem}</div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-3xl font-black ${cor.text} leading-none`}>{progressPct}%</div>
          <div className="text-[10px] opacity-60 mt-0.5">
            {visited}/{total} stands
          </div>
        </div>
      </div>

      {/* Barra de progresso + ticks de expectativa */}
      <div className="relative w-full bg-purple-900/40 rounded-full h-4 overflow-hidden">
        <div
          className={`h-4 rounded-full bg-gradient-to-r ${cor.barFrom} ${cor.barTo} transition-all`}
          style={{ width: `${progressPct}%` }}
        />
        {/* Marcador de progresso esperado (linha vertical branca) */}
        {!eventNotStarted && !eventEnded && expectedPct > 0 && expectedPct < 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/70"
            style={{ left: `${expectedPct}%` }}
            title={`Progresso esperado: ${expectedPct}%`}
          />
        )}
      </div>

      {/* Footer com dias e ritmo */}
      {!eventNotStarted && !eventEnded && (
        <div className="flex items-center justify-between mt-3 text-[11px] opacity-70">
          <span>
            <strong className={cor.text}>Dia {Math.min(daysElapsed, totalDays)}</strong> de {totalDays}
          </span>
          <span>
            {daysRemaining > 0
              ? <>Faltam <strong className={cor.text}>{daysRemaining}</strong> dia(s)</>
              : <>Último dia</>}
          </span>
          {progressPct < 100 && daysRemaining > 0 && (
            <span>
              Ritmo: <strong className={cor.text}>{requiredPerDay}/dia</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// --- Vendedores atuando na feira ---
// Lista todo mundo que tem lead_capture_link ativo no pipeline do evento
// (= quem pode gerar QR nos stands) + quem já produziu lead neste evento.
// Pra cada um: leads capturados via QR, check-ins manuais, última atividade.
// Clique no card navega pros contatos do evento atribuídos àquele vendedor.
function SellersAtEvent({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [data, setData] = useState<{
    sellers: Array<{
      user_id: string;
      name: string;
      avatar_url: string | null;
      qr_leads: number;
      manual_checkins: number;
      total: number;
      last_activity: string | null;
    }>;
    total_sellers: number;
    active_sellers: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/events/${eventId}/sellers`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return (
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5 animate-pulse">
        <div className="h-4 bg-purple-900/40 rounded w-48 mb-4" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 w-44 bg-purple-900/40 rounded-lg shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.total_sellers === 0) {
    return (
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Vendedores na Feira</h3>
        <p className="text-sm text-purple-300/50">
          Nenhum vendedor com QR Code ativo neste pipeline ainda.
          Crie um link de captura no menu <span className="text-emerald-400">QR Codes</span> pra começar.
        </p>
      </div>
    );
  }

  const formatLastActivity = (iso: string | null): string => {
    if (!iso) return 'sem atividade';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora mesmo';
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    return `há ${d}d`;
  };

  return (
    <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
          Vendedores na Feira
        </h3>
        <span className="text-xs text-purple-300/50">
          {data.active_sellers} ativo{data.active_sellers !== 1 ? 's' : ''} de {data.total_sellers}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.sellers.map((s) => {
          const isActive = s.total > 0;
          return (
            <button
              key={s.user_id}
              type="button"
              onClick={() => router.push(`/contacts?event_id=${eventId}&assigned=${s.user_id}`)}
              className={`text-left rounded-lg border p-3 transition-all hover:scale-[1.01] ${
                isActive
                  ? 'bg-[#2a1245] border-emerald-500/30 hover:border-emerald-500/60'
                  : 'bg-[#2a1245]/50 border-purple-800/30 hover:border-purple-700/50 opacity-60'
              }`}
              title={`Ver leads de ${s.name} neste evento`}
            >
              <div className="flex items-center gap-3">
                {s.avatar_url ? (
                  <img
                    src={s.avatar_url}
                    alt={s.name}
                    className={`w-10 h-10 rounded-full object-cover shrink-0 ${
                      isActive ? 'ring-2 ring-emerald-500/40' : ''
                    }`}
                  />
                ) : (
                  <div
                    className={`w-10 h-10 rounded-full bg-purple-800/50 flex items-center justify-center text-sm font-bold text-purple-200 shrink-0 ${
                      isActive ? 'ring-2 ring-emerald-500/40' : ''
                    }`}
                  >
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{s.name}</div>
                  <div className="text-[11px] text-purple-300/50">
                    {formatLastActivity(s.last_activity)}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1 text-purple-200/80">
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <span className="font-bold text-emerald-400">{s.qr_leads}</span>
                  <span className="text-purple-300/50">QR</span>
                </div>
                <div className="flex items-center gap-1 text-purple-200/80">
                  <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-bold text-cyan-400">{s.manual_checkins}</span>
                  <span className="text-purple-300/50">manual</span>
                </div>
                <div className="flex items-center gap-1 text-purple-100">
                  <span className="font-bold">{s.total}</span>
                  <span className="text-purple-300/50">total</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DashboardTab({ eventId, event }: { eventId: string; event: FairEvent }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/events/${eventId}/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-[#1e0f35] rounded-xl" />)}
      </div>
    );
  }

  if (!stats) return null;

  const maxDayVisits = Math.max(...(stats.by_day || []).map((d: any) => d.visits), 1);

  return (
    <div className="space-y-6">
      {/* Botão relatório executivo */}
      <div className="flex justify-end">
        <button
          onClick={() => router.push(`/eventos/${eventId}/relatorio`)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-2.5 rounded-lg shadow-lg shadow-emerald-500/20 transition-all text-sm"
          title="Gerar relatório executivo em PDF"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          Relatório Executivo
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Stands" value={stats.total_booths} />
        <StatCard label="Visitados" value={stats.visited_booths} color="emerald" />
        <StatCard label="Pendentes" value={stats.pending_booths} color="amber" />
        <StatCard label="Progresso" value={`${stats.progress_pct}%`} color="cyan" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Visitas Stand" value={stats.total_visits} color="purple" />
        <StatCard label="Leads Avulsos" value={stats.total_walk_ins || 0} color="cyan" />
        <StatCard label="Total de Leads" value={stats.total_leads_event || stats.total_visits} color="emerald" />
        <StatCard label="Media/Dia" value={stats.avg_visits_per_day} color="cyan" />
      </div>

      {/* Meta + Urgência visual — só aparece se evento está ATIVO com datas */}
      <MetaUrgenciaCard event={event} stats={stats} />

      {/* Vendedores atuando na feira (QR leads + check-ins manuais) */}
      <SellersAtEvent eventId={eventId} />

      {/* Progress bar */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-purple-200/70 font-medium">Cobertura do Evento</span>
          <span className="text-emerald-400 font-bold text-sm">{stats.visited_booths}/{stats.total_booths}</span>
        </div>
        <div className="w-full bg-purple-900/40 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-3 rounded-full transition-all"
            style={{ width: `${stats.progress_pct}%` }}
          />
        </div>
      </div>

      {/* ===== DAILY BREAKDOWN ===== */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
        <h3 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">Registro Diario</h3>

        {(stats.by_day || []).length === 0 ? (
          <p className="text-purple-300/40 text-sm">Nenhuma visita registrada ainda</p>
        ) : (
          <div className="space-y-3">
            {stats.by_day.map((day: any) => {
              const isExpanded = expandedDay === day.date;
              const isToday = day.date === new Date().toISOString().split('T')[0];
              const cumDay = (stats.cumulative_by_day || []).find((c: any) => c.date === day.date);

              return (
                <div key={day.date} className={`rounded-xl border transition-colors ${isToday ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-purple-800/20 bg-purple-900/10'}`}>
                  {/* Day header — clickable */}
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : day.date)}
                    className="w-full text-left p-4 flex items-center gap-4"
                  >
                    {/* Day number badge */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${
                      day.visits > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-800/30 text-purple-400/40'
                    }`}>
                      D{day.day_number}
                    </div>

                    {/* Date + summary */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium">
                          {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                        </span>
                        {isToday && <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded uppercase">Hoje</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-purple-300/40 mt-0.5">
                        <span>{day.visits} visita{day.visits !== 1 ? 's' : ''}</span>
                        <span>{day.unique_booths} stand{day.unique_booths !== 1 ? 's' : ''}</span>
                        {day.active_hours > 0 && <span>{day.active_hours}h ativas</span>}
                        {day.avg_per_hour > 0 && <span>{day.avg_per_hour}/hora</span>}
                      </div>
                    </div>

                    {/* Mini bar */}
                    <div className="w-20 shrink-0 hidden sm:block">
                      <div className="w-full bg-purple-900/40 rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.round((day.visits / maxDayVisits) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Visit count */}
                    <span className="text-emerald-400 font-bold text-lg shrink-0 w-10 text-right">{day.visits}</span>

                    {/* Cumulative % */}
                    {cumDay && (
                      <span className="text-cyan-400/70 text-xs font-medium shrink-0 w-12 text-right">{cumDay.cumulative_pct}%</span>
                    )}

                    {/* Chevron */}
                    <svg className={`w-4 h-4 text-purple-400/30 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-purple-800/15 pt-3 space-y-4">
                      {/* Horario */}
                      {day.first_visit && (
                        <div className="flex items-center gap-6 text-xs">
                          <div>
                            <span className="text-purple-300/40">Primeira visita: </span>
                            <span className="text-white font-medium">
                              {new Date(day.first_visit).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div>
                            <span className="text-purple-300/40">Ultima visita: </span>
                            <span className="text-white font-medium">
                              {new Date(day.last_visit).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div>
                            <span className="text-purple-300/40">Tempo ativo: </span>
                            <span className="text-white font-medium">{day.active_hours}h</span>
                          </div>
                          <div>
                            <span className="text-purple-300/40">Ritmo: </span>
                            <span className="text-emerald-400 font-medium">{day.avg_per_hour} visitas/hora</span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Per-user this day */}
                        <div>
                          <p className="text-[10px] text-purple-300/40 uppercase font-bold tracking-wider mb-2">Por Vendedor</p>
                          {day.by_user.length === 0 ? (
                            <p className="text-purple-300/30 text-xs">--</p>
                          ) : (
                            <div className="space-y-1.5">
                              {day.by_user.map((u: any) => (
                                <div key={u.user_id} className="flex items-center justify-between">
                                  <span className="text-xs text-purple-200/70">{u.user_name}</span>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-purple-900/40 rounded-full h-1.5">
                                      <div
                                        className="bg-emerald-500 h-1.5 rounded-full"
                                        style={{ width: `${Math.round((u.count / day.visits) * 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-emerald-400 font-bold text-xs w-6 text-right">{u.count}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Per-type this day */}
                        <div>
                          <p className="text-[10px] text-purple-300/40 uppercase font-bold tracking-wider mb-2">Por Tipo</p>
                          {Object.keys(day.by_type).length === 0 ? (
                            <p className="text-purple-300/30 text-xs">--</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(day.by_type).map(([type, count]) => (
                                <div key={type} className="flex items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PROSPECT_TYPE_COLORS[type] || 'bg-neutral-500/20 text-neutral-400'}`}>
                                    {PROSPECT_TYPE_LABELS[type] || type}
                                  </span>
                                  <span className="text-white font-bold text-xs">{count as number}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Cumulative progress this day */}
                      {cumDay && (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-purple-300/40">Progresso acumulado ate este dia</span>
                            <span className="text-cyan-400 font-bold">{cumDay.cumulative_booths}/{stats.total_booths} ({cumDay.cumulative_pct}%)</span>
                          </div>
                          <div className="w-full bg-purple-900/40 rounded-full h-1.5">
                            <div
                              className="bg-cyan-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${cumDay.cumulative_pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cumulative chart - visual bar chart */}
      {(stats.cumulative_by_day || []).length > 1 && (
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
          <h3 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">Evolucao Acumulada</h3>
          <div className="flex items-end gap-1 h-32">
            {stats.cumulative_by_day.map((day: any, idx: number) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-cyan-400 font-bold">{day.cumulative_pct}%</span>
                <div className="w-full bg-purple-900/40 rounded-t-sm relative" style={{ height: '100px' }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-sm transition-all"
                    style={{ height: `${day.cumulative_pct}%` }}
                  />
                </div>
                <span className="text-[9px] text-purple-300/40">D{idx + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By user (global) */}
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
          <h3 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">Ranking Vendedores (Total)</h3>
          {stats.by_user.length === 0 ? (
            <p className="text-purple-300/40 text-sm">Nenhuma visita ainda</p>
          ) : (
            <div className="space-y-3">
              {stats.by_user.map((u: any, idx: number) => (
                <div key={u.user_id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                    idx === 1 ? 'bg-neutral-400/20 text-neutral-300' :
                    idx === 2 ? 'bg-orange-700/20 text-orange-400' :
                    'bg-purple-800/20 text-purple-300/50'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="text-sm text-purple-200/70 flex-1">{u.user_name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-purple-900/40 rounded-full h-1.5">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{ width: `${stats.total_visits ? Math.round((u.count / stats.total_visits) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-emerald-400 font-bold text-sm w-8 text-right">{u.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By prospect type (global) */}
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5">
          <h3 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">Por Tipo de Prospeccao (Total)</h3>
          {Object.keys(stats.by_type).length === 0 ? (
            <p className="text-purple-300/40 text-sm">Nenhuma visita ainda</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.by_type).map(([type, count]) => {
                const pct = stats.total_visits > 0 ? Math.round(((count as number) / stats.total_visits) * 100) : 0;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${PROSPECT_TYPE_COLORS[type] || 'bg-neutral-500/20 text-neutral-400'}`}>
                      {PROSPECT_TYPE_LABELS[type] || type}
                    </span>
                    <div className="flex-1">
                      <div className="w-full bg-purple-900/40 rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-white font-bold text-sm w-12 text-right">{count as number}</span>
                    <span className="text-purple-300/40 text-xs w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'purple', href }: { label: string; value: string | number; color?: string; href?: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    cyan: 'text-cyan-400',
    purple: 'text-purple-300',
  };

  const inner = (
    <>
      <p className="text-purple-300/50 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] || colorMap.purple}`}>{value}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4 block hover:border-emerald-500/60 hover:bg-[#241142] transition-colors cursor-pointer"
        title="Ver lista de leads"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4">
      {inner}
    </div>
  );
}

// --- Booth Drawer ---
// Helper to parse extra metadata from notes
function parseNotesMeta(notes: string | null): { userNotes: string; extraPhotos: string[]; extraContacts: { name: string; cargo: string }[] } {
  if (!notes) return { userNotes: '', extraPhotos: [], extraContacts: [] };
  const match = notes.match(/<!--EXTRA:([\s\S]*?)-->/);
  const userNotes = notes.replace(/\n?<!--EXTRA:[\s\S]*?-->/, '').trim();
  if (!match) return { userNotes, extraPhotos: [], extraContacts: [] };
  try {
    const meta = JSON.parse(match[1]);
    return { userNotes, extraPhotos: meta.photos || [], extraContacts: meta.contacts || [] };
  } catch {
    return { userNotes, extraPhotos: [], extraContacts: [] };
  }
}

// --- Booth Drawer ---
function BoothDrawer({
  booth,
  eventId,
  isAdmin,
  eventStatus,
  onClose,
  onUpdate,
}: {
  booth: EventBooth;
  eventId: string;
  isAdmin?: boolean;
  eventStatus?: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePreview, setDeletePreview] = useState<any>(null);
  const visit = booth.visit;
  const parsed = parseNotesMeta(visit?.notes || null);

  const [contact, setContact] = useState<any>(null);
  const [loadingContact, setLoadingContact] = useState(true);

  // Pre-fill form from existing visit (#1)
  const [contacts, setContacts] = useState<{ name: string; cargo: string }[]>(() => {
    const primary = { name: visit?.contact_name || '', cargo: visit?.contact_role || '' };
    const extra = parsed.extraContacts.length > 0 ? parsed.extraContacts : [];
    return [primary, ...extra];
  });
  const [prospectType, setProspectType] = useState(visit?.prospect_type || 'COMPRADOR');
  const [notes, setNotes] = useState(parsed.userNotes);

  // Photos: existing URLs + new files (#2)
  const [existingPhotos, setExistingPhotos] = useState<string[]>(() => {
    const urls: string[] = [];
    if (visit?.photo_facade_url) urls.push(visit.photo_facade_url);
    if (visit?.photo_contact_url) urls.push(visit.photo_contact_url);
    urls.push(...parsed.extraPhotos);
    return urls;
  });
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  // Base64 paralelo pra salvar em draft (sobrevive recarga de página)
  const [newFilesB64, setNewFilesB64] = useState<Array<{ name: string; type: string; dataUrl: string }>>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState<'save' | 'visit' | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // Draft state: chave única por evento+stand, toast de restauração, skip do save inicial
  const draftKey = `checkin-drawer-${eventId}-${booth.id}`;
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);
  const draftReadyRef = useRef(false);

  // QR Code state
  const [qrLoading, setQrLoading] = useState(false);
  const [qrLinks, setQrLinks] = useState<{ id: string; token: string; label: string; url: string }[]>([]);
  const [selectedQrIdx, setSelectedQrIdx] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrSetupUrl, setQrSetupUrl] = useState<string | null>(null);
  const [qrCopied, setQrCopied] = useState(false);

  // Fetch or auto-create contact on mount
  useEffect(() => {
    const loadContact = async () => {
      setLoadingContact(true);
      try {
        if (visit?.contact_id) {
          const res = await fetch(`/api/contacts/${visit.contact_id}`);
          if (res.ok) setContact(await res.json());
        } else {
          const res = await fetch(`/api/events/${eventId}/check-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booth_id: booth.id, auto_create: true }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.contact) setContact(data.contact);
          }
        }
      } catch { /* silent */ } finally { setLoadingContact(false); }
    };
    loadContact();
  }, [booth.id, visit?.contact_id, eventId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // === DRAFT: restaura rascunho salvo ao montar (se existir) ===
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Limpa rascunhos expirados em background (não bloqueia)
      draftPruneOld(DRAFT_MAX_AGE_MS).catch(() => {});
      try {
        const saved = await draftLoad<{
          contacts: { name: string; cargo: string }[];
          prospectType: string;
          notes: string;
          photos: Array<{ name: string; type: string; dataUrl: string }>;
        }>(draftKey);
        if (cancelled || !saved || !saved.data) {
          draftReadyRef.current = true;
          return;
        }
        const d = saved.data;
        if (Array.isArray(d.contacts) && d.contacts.length > 0) setContacts(d.contacts);
        if (d.prospectType === 'COMPRADOR' || d.prospectType === 'FORNECEDOR' || d.prospectType === 'AMBOS') {
          setProspectType(d.prospectType);
        }
        if (typeof d.notes === 'string') setNotes(d.notes);
        if (Array.isArray(d.photos) && d.photos.length > 0) {
          // Reconstrói File objects e previews a partir do base64
          const files: File[] = [];
          const previews: string[] = [];
          for (const p of d.photos) {
            try {
              const f = await dataUrlToFile(p.dataUrl, p.name);
              files.push(f);
              previews.push(p.dataUrl);
            } catch { /* ignora foto corrompida */ }
          }
          if (files.length > 0) {
            setNewFiles(files);
            setNewPreviews(previews);
            setNewFilesB64(d.photos);
          }
        }
        setDraftRestoredAt(saved.updatedAt);
      } catch { /* silent */ } finally {
        draftReadyRef.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [draftKey]);

  // === DRAFT: auto-save debounced a cada mudança relevante ===
  useEffect(() => {
    if (!draftReadyRef.current) return; // não salva durante a restauração inicial
    const t = setTimeout(() => {
      draftSave(draftKey, {
        contacts,
        prospectType,
        notes,
        photos: newFilesB64,
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [draftKey, contacts, prospectType, notes, newFilesB64]);

  // QR handlers
  const handleFetchQR = async () => {
    setQrLoading(true); setQrError(null); setQrSetupUrl(null);
    try {
      const res = await fetch(`/api/events/${eventId}/booths/${booth.id}/qr-link`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setQrError(data.error || 'Erro'); return; }
      if (data.needs_setup || !data.links?.length) {
        setQrError(data.error || 'Nenhum QR Code configurado');
        setQrSetupUrl(data.setup_url || '/settings#qr-codes');
        return;
      }
      setQrLinks(data.links); setSelectedQrIdx(0);
      const QRCode = (await import('qrcode')).default;
      setQrDataUrl(await QRCode.toDataURL(data.links[0].url, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } }));
    } catch { setQrError('Erro de conexao'); } finally { setQrLoading(false); }
  };
  const handleSelectQrLink = async (idx: number) => {
    setSelectedQrIdx(idx);
    try { const QRCode = (await import('qrcode')).default; setQrDataUrl(await QRCode.toDataURL(qrLinks[idx].url, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } })); } catch {}
  };
  const handleDownloadQR = () => { if (!qrDataUrl) return; const a = document.createElement('a'); a.download = `qr-${booth.company_name.replace(/\s+/g, '-').toLowerCase()}.png`; a.href = qrDataUrl; a.click(); };
  const handleCopyLink = async () => {
    const url = qrLinks[selectedQrIdx]?.url; if (!url) return;
    try { await navigator.clipboard.writeText(url); } catch { const i = document.createElement('input'); i.value = url; document.body.appendChild(i); i.select(); document.execCommand('copy'); document.body.removeChild(i); }
    setQrCopied(true); setTimeout(() => setQrCopied(false), 2000);
  };

  // Photo handlers (#2) — atualiza também a versão base64 pra draft persistente
  const handleAddPhotos = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    setNewFiles((prev) => [...prev, ...arr]);
    setNewPreviews((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);
    // Converte em base64 em paralelo pra draft (não bloqueia a UI)
    try {
      const converted = await Promise.all(
        arr.map(async (f) => ({ name: f.name, type: f.type || 'application/octet-stream', dataUrl: await fileToDataUrl(f) })),
      );
      setNewFilesB64((prev) => [...prev, ...converted]);
    } catch { /* silent — foto continua no state como File, só draft que não persiste essa */ }
  };
  const handleRemoveExisting = (idx: number) => setExistingPhotos((prev) => prev.filter((_, i) => i !== idx));
  const handleRemoveNew = (idx: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
    setNewPreviews((prev) => prev.filter((_, i) => i !== idx));
    setNewFilesB64((prev) => prev.filter((_, i) => i !== idx));
  };
  const handleDismissDraft = async () => {
    await draftClear(draftKey).catch(() => {});
    setDraftRestoredAt(null);
    // Reseta o form pro estado inicial (do visit existente, se houver)
    const primary = { name: visit?.contact_name || '', cargo: visit?.contact_role || '' };
    const extra = parsed.extraContacts.length > 0 ? parsed.extraContacts : [];
    setContacts([primary, ...extra]);
    setProspectType(visit?.prospect_type || 'COMPRADOR');
    setNotes(parsed.userNotes);
    setNewFiles([]);
    setNewPreviews([]);
    setNewFilesB64([]);
  };

  // Contact list handlers (#5)
  const updateContact = (idx: number, field: 'name' | 'cargo', value: string) => {
    setContacts((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };
  const addContact = () => setContacts((prev) => [...prev, { name: '', cargo: '' }]);
  const removeContact = (idx: number) => {
    if (contacts.length <= 1) return;
    setContacts((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit handler (#4 - Save vs Register Visit)
  // Suporta modo offline: se não houver conexão ou o fetch falhar,
  // enfileira no IndexedDB e sincroniza automaticamente quando voltar online.
  const handleSubmit = async (markVisited: boolean) => {
    const mode = markVisited ? 'visit' : 'save';
    setSubmitting(mode);
    setSuccessMsg(null);
    try {
      // Monta os campos de texto
      const fields: Record<string, string> = {
        booth_id: booth.id,
        contact_name: contacts[0]?.name || '',
        contact_role: contacts[0]?.cargo || '',
        prospect_type: prospectType,
        notes: notes,
        mark_visited: markVisited ? 'true' : 'false',
      };
      const extras = contacts.slice(1).filter((c) => c.name.trim());
      if (extras.length > 0) {
        fields.extra_contacts = JSON.stringify(extras);
      }

      // Converte fotos para base64 (para sobreviver num IndexedDB caso offline)
      const files: Array<{ field: string; name: string; type: string; base64: string }> = [];
      for (let i = 0; i < newFiles.length; i++) {
        const f = newFiles[i];
        let field: string;
        if (i === 0 && !existingPhotos.some((u) => u.includes('facade'))) field = 'photo_facade';
        else if (i === 1 && !existingPhotos.some((u) => u.includes('contact'))) field = 'photo_contact';
        else field = `photo_extra_${i}`;
        const b64 = await fileToBase64(f);
        files.push({ field, ...b64 });
      }

      const result = await enqueueOrSend({
        type: 'booth-checkin',
        endpoint: `/api/events/${eventId}/check-in`,
        method: 'POST',
        body: { __form: true, fields, files },
        meta: { booth_id: booth.id, booth_name: booth.company_name, event_id: eventId },
      });

      if (result.sent) {
        // Limpa o rascunho — dados estão seguros no servidor
        draftClear(draftKey).catch(() => {});
        if (markVisited) {
          setSuccessMsg('Check-in realizado!');
          setTimeout(() => { onUpdate(); }, 1200);
        } else {
          setSuccessMsg('Dados salvos!');
          setTimeout(() => setSuccessMsg(null), 2000);
        }
      } else if (result.queued) {
        // Enfileirou offline: o payload (incluindo fotos em base64) já está
        // no IndexedDB da fila. Podemos limpar o rascunho com segurança.
        draftClear(draftKey).catch(() => {});
        setSuccessMsg(markVisited ? 'Offline — check-in salvo na fila' : 'Offline — dados salvos na fila');
        setTimeout(() => { onUpdate(); }, 1500);
      } else if (result.response) {
        // Erro HTTP de negócio — reporta. MANTÉM o rascunho pro usuário tentar de novo.
        setSuccessMsg('Erro ao enviar. Tente novamente.');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch {
      // Em último caso, tenta enfileirar mesmo assim
      setSuccessMsg('Erro inesperado');
      setTimeout(() => setSuccessMsg(null), 3000);
    } finally {
      setSubmitting(null);
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm border rounded-lg bg-[#2a1245] text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 border-purple-700/30';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full z-50 w-full sm:w-[480px] bg-[#120826] border-l border-purple-800/20 flex flex-col" style={{ animation: 'slideInRight 0.3s ease-out' }}>
        {/* Header */}
        <div className="p-4 border-b border-purple-800/20 flex items-center gap-3 shrink-0">
          {booth.logo_url && (
            <div className="w-14 h-14 rounded-lg bg-white/95 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src={booth.logo_url}
                alt={booth.company_name}
                className="w-full h-full object-contain"
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none'; }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white truncate">{booth.company_name}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${BOOTH_STATUS_COLORS[booth.status]}`}>
                {booth.status === 'VISITADO' ? 'Visitado' : 'Pendente'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-purple-300/40">
              {booth.booth_number && <span>Stand {booth.booth_number}</span>}
              {booth.sector && <span>{booth.sector}</span>}
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/events/${eventId}/booths/${booth.id}/delete-preview`);
                  if (res.ok) {
                    setDeletePreview(await res.json());
                    setShowDeleteModal(true);
                  }
                } catch { /* silent */ }
              }}
              className="p-2 rounded-lg hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-colors shrink-0"
              title="Excluir stand (admin)"
              aria-label="Excluir stand"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-purple-800/30 text-purple-300/50 hover:text-white transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Success toast */}
          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/15 text-emerald-400 text-sm font-medium border border-emerald-500/20 text-center">
              {successMsg}
            </div>
          )}

          {/* Draft restaurado — banner com opção de descartar */}
          {draftRestoredAt && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
              <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0 text-xs">
                <div className="font-semibold text-amber-300">Rascunho restaurado</div>
                <div className="text-amber-200/70">Salvo {formatDraftAge(draftRestoredAt)}. Continue de onde parou.</div>
              </div>
              <button
                type="button"
                onClick={handleDismissDraft}
                className="shrink-0 px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={() => setDraftRestoredAt(null)}
                className="shrink-0 p-1 text-amber-400/60 hover:text-amber-300"
                aria-label="Fechar aviso"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Contact info card */}
          <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Contato Vinculado</h4>
            {loadingContact ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-purple-800/30 border-t-emerald-500 rounded-full animate-spin" />
                <span className="text-xs text-purple-300/40">Carregando...</span>
              </div>
            ) : contact ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm text-white font-medium">{contact.name}</p>
                  {contact.contato_nome && contact.contato_nome !== contact.name && (
                    <p className="text-xs text-emerald-300/90 font-medium">👤 {contact.contato_nome}</p>
                  )}
                  {contact.phone && <p className="text-xs text-purple-200/70">{contact.phone}</p>}
                  {contact.email && <p className="text-xs text-purple-200/70">{contact.email}</p>}
                  {contact.cargo && <p className="text-xs text-purple-300/50">Cargo: {contact.cargo}</p>}
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/contacts/${contact.id}`}
                    className="flex-1 px-3 py-2 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/25 transition-colors text-center"
                  >
                    Abrir Contato
                  </a>
                  {contact.phone && (
                    <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-green-500/15 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/25 transition-colors">
                      WhatsApp
                    </a>
                  )}
                </div>

                {/* Validacao: captavel ou descartar */}
                <div className="pt-3 border-t border-purple-800/30 space-y-2">
                  <p className="text-[10px] font-bold text-purple-300/60 uppercase tracking-wider">Esse lead vale a pena?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const prev = contact.inexistente;
                        setContact({ ...contact, inexistente: false });
                        try {
                          const res = await fetch(`/api/contacts/${contact.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ inexistente: false }),
                          });
                          if (!res.ok) throw new Error();
                        } catch {
                          setContact({ ...contact, inexistente: prev });
                        }
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        contact.inexistente === false
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                      }`}
                    >
                      {contact.inexistente === false ? '✓ Captavel' : 'Captavel'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('Descartar este contato? Ele sai da pipeline e da listagem principal (fica acessivel no filtro "Descartados").')) return;
                        const prev = contact.inexistente;
                        setContact({ ...contact, inexistente: true });
                        try {
                          const res = await fetch(`/api/contacts/${contact.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ inexistente: true }),
                          });
                          if (!res.ok) throw new Error();
                        } catch {
                          setContact({ ...contact, inexistente: prev });
                        }
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        contact.inexistente === true
                          ? 'bg-red-500 text-white border-red-400 shadow-md shadow-red-500/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                      }`}
                    >
                      {contact.inexistente === true ? '✗ Descartado' : 'Descartar'}
                    </button>
                  </div>
                  {contact.inexistente === true && (
                    <p className="text-[10px] text-red-300/70 leading-tight">
                      Este contato esta descartado. Ele nao aparece na pipeline principal, so no filtro "Descartados" em /contacts.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-purple-300/40">Evento sem pipeline configurado</p>
            )}
          </div>

          {/* QR Code section */}
          <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4 space-y-3">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">QR Code para Captura</h4>
            {qrError && (
              <div className="p-3 rounded-lg bg-amber-500/10 text-amber-200 text-xs border border-amber-500/30 space-y-2">
                <p>{qrError}</p>
                {qrSetupUrl && (
                  <a href={qrSetupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 rounded-md font-semibold transition-colors">
                    Criar QR Code agora
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
              </div>
            )}
            {qrLinks.length === 0 ? (
              <button type="button" onClick={handleFetchQR} disabled={qrLoading} className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {qrLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Buscando...</> : 'Mostrar QR Code'}
              </button>
            ) : (
              <div className="space-y-3">
                {qrLinks.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {qrLinks.map((l, idx) => (
                      <button key={l.id} type="button" onClick={() => handleSelectQrLink(idx)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedQrIdx === idx ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-purple-800/20 text-purple-300/60 border border-purple-700/20'}`}>
                        {l.label || `Link ${idx + 1}`}
                      </button>
                    ))}
                  </div>
                )}
                {qrDataUrl && <div className="flex justify-center"><div className="bg-white rounded-xl p-3"><img src={qrDataUrl} alt="QR Code" className="w-48 h-48" /></div></div>}
                <div className="flex gap-2">
                  <button type="button" onClick={handleDownloadQR} className="flex-1 py-2 bg-purple-800/30 text-purple-300 rounded-lg text-xs font-medium hover:bg-purple-800/50 transition-colors text-center">Baixar</button>
                  <button type="button" onClick={handleCopyLink} className="flex-1 py-2 bg-purple-800/30 text-purple-300 rounded-lg text-xs font-medium hover:bg-purple-800/50 transition-colors text-center">
                    {qrCopied ? <span className="text-emerald-400">Copiado!</span> : 'Copiar Link'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-purple-700/30" />
            <span className="text-xs text-purple-300/40">Dados da Visita</span>
            <div className="flex-1 h-px bg-purple-700/30" />
          </div>

          {/* ===== Photos Gallery (#2) ===== */}
          <div>
            <label className="block text-xs font-medium text-purple-200/80 mb-2">Fotos</label>
            <div className="grid grid-cols-3 gap-2">
              {/* Existing photos */}
              {existingPhotos.map((url, idx) => (
                <div key={`ex-${idx}`} className="relative aspect-square rounded-lg overflow-hidden border border-purple-700/30">
                  <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => handleRemoveExisting(idx)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              {/* New photo previews */}
              {newPreviews.map((url, idx) => (
                <div key={`new-${idx}`} className="relative aspect-square rounded-lg overflow-hidden border border-emerald-500/30">
                  <img src={url} alt={`Nova ${idx + 1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => handleRemoveNew(idx)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              {/* Add photo button */}
              <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleAddPhotos(e.target.files); e.target.value = ''; }} />
              <button type="button" onClick={() => photoInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-purple-700/30 hover:border-emerald-500/40 transition-colors flex flex-col items-center justify-center gap-1 bg-[#2a1245]">
                <svg className="w-6 h-6 text-purple-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                <span className="text-[9px] text-purple-300/40">Adicionar</span>
              </button>
            </div>
          </div>

          {/* ===== Contacts List (#5) ===== */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-purple-200/80">Contatos</label>
              <button type="button" onClick={addContact} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Adicionar contato
              </button>
            </div>
            <div className="space-y-2">
              {contacts.map((c, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nome do contato"
                    value={c.name}
                    onChange={(e) => updateContact(idx, 'name', e.target.value)}
                    className="px-3 py-2 text-sm border rounded-lg bg-[#2a1245] text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 border-purple-700/30 min-w-0 w-full"
                  />
                  <input
                    type="text"
                    placeholder="Cargo"
                    value={c.cargo}
                    onChange={(e) => updateContact(idx, 'cargo', e.target.value)}
                    className="px-3 py-2 text-sm border rounded-lg bg-[#2a1245] text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 border-purple-700/30 min-w-0 w-full"
                  />
                  {contacts.length > 1 ? (
                    <button type="button" onClick={() => removeContact(idx)} className="p-1.5 text-red-400/40 hover:text-red-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Prospect type */}
          <div>
            <label className="block text-xs font-medium text-purple-200/80 mb-1.5">Tipo de Prospecção</label>
            <div className="flex gap-2">
              {['COMPRADOR', 'FORNECEDOR', 'AMBOS'].map((type) => (
                <button key={type} type="button" onClick={() => setProspectType(type as 'COMPRADOR' | 'FORNECEDOR' | 'AMBOS')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${prospectType === type ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-purple-800/20 text-purple-300/60 border border-purple-700/20 hover:bg-purple-800/30'}`}>
                  {PROSPECT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-purple-200/80 mb-1">Observações</label>
            <textarea placeholder="O que conversou, interesses, próximos passos..." rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </div>

          {/* Aviso se feira nao ativa — bloqueia o botao de registrar visita */}
          {eventStatus && eventStatus !== 'ATIVO' && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 leading-relaxed">
              Esta feira nao esta ativa. Voce pode editar os dados do stand, mas <strong>registrar visita</strong> so funciona com a feira ATIVA. Peca ao admin para ativar em Feiras &amp; Eventos.
            </div>
          )}

          {/* ===== Two Buttons — mobile friendly (touch area ≥ 48px) ===== */}
          <div className="flex gap-3 pb-2 pt-1 sticky bottom-0 bg-[#120826]/95 backdrop-blur-sm -mx-0 px-0 py-2">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={submitting !== null}
              className="flex-1 py-4 min-h-[56px] bg-purple-600 text-white rounded-xl font-bold text-base hover:bg-purple-700 active:bg-purple-700 active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg shadow-purple-900/30"
              title="Salva os dados sem marcar como visitado"
            >
              {submitting === 'save' ? 'Salvando...' : 'Só Salvar'}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting !== null || (eventStatus !== undefined && eventStatus !== 'ATIVO')}
              className="flex-1 py-4 min-h-[56px] bg-emerald-500 text-white rounded-xl font-bold text-base hover:bg-emerald-600 active:bg-emerald-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/30"
              title={eventStatus && eventStatus !== 'ATIVO' ? 'Ative a feira pra registrar visitas' : 'Salva os dados e marca o stand como visitado'}
            >
              {submitting === 'visit' ? 'Registrando...' : '✓ Registrar Visita'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete stand modal — admin-only */}
      {showDeleteModal && deletePreview && (
        <DeleteConfirmModal
          open={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirmed={() => {
            setShowDeleteModal(false);
            onUpdate();
          }}
          title={`Apagar Stand: ${booth.company_name}`}
          confirmName={booth.company_name}
          description="Esse stand e as visitas feitas nele serao apagados. Contatos capturados neste stand permanecem no CRM (so perdem o vinculo com o stand)."
          items={[
            { label: 'Visitas (check-ins) neste stand', value: deletePreview.counts?.visits || 0, critical: (deletePreview.counts?.visits || 0) > 0 },
          ]}
          deleteUrl={`/api/events/${eventId}/booths/${booth.id}`}
        />
      )}
    </>
  );
}

// --- Stands Tab ---
function StandsTab({
  eventId,
  preselectedBoothId,
  onClearPreselect,
  initialSearch,
  isAdmin,
  openFormNonce,
  eventStatus,
}: {
  eventId: string;
  preselectedBoothId?: string | null;
  onClearPreselect?: () => void;
  initialSearch?: string;
  isAdmin?: boolean;
  openFormNonce?: number;
  eventStatus?: string;
}) {
  const [booths, setBooths] = useState<EventBooth[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch || '');

  // Se o search global mudar (ex: user digitou no header), sincronizar aqui
  useEffect(() => {
    if (initialSearch !== undefined) setSearch(initialSearch);
  }, [initialSearch]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(openFormNonce !== undefined && openFormNonce > 0);
  useEffect(() => {
    if (openFormNonce !== undefined && openFormNonce > 0) {
      setShowAdd(true);
    }
  }, [openFormNonce]);
  const [newBooth, setNewBooth] = useState({ company_name: '', booth_number: '', sector: '' });
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creatingContacts, setCreatingContacts] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [selectedBooth, setSelectedBooth] = useState<EventBooth | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const xlsInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    const input = prompt('Quantas linhas em branco deseja no modelo?', '50');
    if (input === null) return; // cancelado
    const count = Math.max(1, Math.min(10000, parseInt(input, 10) || 50));
    const XLSX = await import('xlsx');
    const CONTACT_SLOTS = 5;
    const header: string[] = ['Empresa', 'Stand', 'Setor'];
    for (let n = 1; n <= CONTACT_SLOTS; n++) {
      header.push(`Contato ${n}`, `Cargo ${n}`, `Telefone ${n}`, `Email ${n}`);
    }
    const data: any[][] = [header];
    const emptyRow = new Array(header.length).fill('');
    for (let i = 0; i < count; i++) {
      data.push([...emptyRow]);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    const cols: { wch: number }[] = [{ wch: 30 }, { wch: 10 }, { wch: 20 }];
    for (let n = 0; n < CONTACT_SLOTS; n++) {
      cols.push({ wch: 25 }, { wch: 20 }, { wch: 18 }, { wch: 30 });
    }
    ws['!cols'] = cols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stands');
    XLSX.writeFile(wb, `modelo-stands-${count}-linhas.xlsx`);
  };

  const handleExcelImport = async (file: File) => {
    setImporting(true);
    setCreateMsg(null);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (rows.length < 2) {
        setCreateMsg('Planilha vazia ou sem dados (precisa de header + linhas)');
        setImporting(false);
        return;
      }

      const headers = rows[0].map((h: any) => String(h || '').trim().toLowerCase());
      const nameIdx = headers.findIndex((h) => /empresa|company|razao/i.test(h));
      const numberIdx = headers.findIndex((h) => /^stand$|^booth|^n[úu]mero$|^num$|nº/i.test(h));
      const sectorIdx = headers.findIndex((h) => /setor|sector|area|pavilhao/i.test(h));

      // Detecta até N slots de contato. Suporta "Contato 1" ou apenas "Contato" (= slot 1).
      const findContactColIdx = (slot: number, kind: 'name' | 'role' | 'phone' | 'email'): number => {
        const patterns: Record<string, RegExp> = {
          name: new RegExp(`^contato\\s*${slot}$|contato\\s*${slot}.*nome|nome.*contato\\s*${slot}`, 'i'),
          role: new RegExp(`^cargo\\s*${slot}$|cargo.*${slot}`, 'i'),
          phone: new RegExp(`^(telefone|celular|whatsapp|fone|phone)\\s*${slot}$`, 'i'),
          email: new RegExp(`^e-?mail\\s*${slot}$`, 'i'),
        };
        let idx = headers.findIndex((h) => patterns[kind].test(h));
        // Fallback: slot 1 aceita colunas sem número ("Contato", "Cargo", "Telefone", "Email")
        if (idx === -1 && slot === 1) {
          const legacyPatterns: Record<string, RegExp> = {
            name: /^contato$|^nome.*contato$|^contact.*name$/i,
            role: /^cargo$|^role$|^posi[cç][aã]o$/i,
            phone: /^(telefone|celular|whatsapp|fone|phone)$/i,
            email: /^e-?mail$/i,
          };
          idx = headers.findIndex((h) => legacyPatterns[kind].test(h));
        }
        return idx;
      };

      const MAX_SLOTS = 10;
      const slotIdx: { name: number; role: number; phone: number; email: number }[] = [];
      for (let s = 1; s <= MAX_SLOTS; s++) {
        slotIdx.push({
          name: findContactColIdx(s, 'name'),
          role: findContactColIdx(s, 'role'),
          phone: findContactColIdx(s, 'phone'),
          email: findContactColIdx(s, 'email'),
        });
      }

      if (nameIdx === -1) {
        setCreateMsg('Planilha precisa ter coluna "Empresa" no header. Baixe o modelo para referência.');
        setImporting(false);
        return;
      }

      type ContactRow = { name: string; role: string; phone: string; email: string };
      const items: {
        company_name: string;
        booth_number?: string;
        sector?: string;
        contacts?: ContactRow[];
      }[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row[nameIdx] || '').trim();
        if (!name) continue;

        const contacts: ContactRow[] = [];
        for (const sx of slotIdx) {
          const cName = sx.name >= 0 ? String(row[sx.name] || '').trim() : '';
          const cRole = sx.role >= 0 ? String(row[sx.role] || '').trim() : '';
          const cPhone = sx.phone >= 0 ? String(row[sx.phone] || '').trim() : '';
          const cEmail = sx.email >= 0 ? String(row[sx.email] || '').trim() : '';
          if (cName || cPhone || cEmail) {
            contacts.push({ name: cName, role: cRole, phone: cPhone, email: cEmail });
          }
        }

        items.push({
          company_name: name,
          booth_number: numberIdx >= 0 ? String(row[numberIdx] || '').trim() : '',
          sector: sectorIdx >= 0 ? String(row[sectorIdx] || '').trim() : '',
          contacts: contacts.length > 0 ? contacts : undefined,
        });
      }

      if (items.length === 0) {
        setCreateMsg('Nenhum stand encontrado na planilha');
        setImporting(false);
        return;
      }

      const res = await fetch(`/api/events/${eventId}/booths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      });
      const data = await res.json();
      if (res.ok) {
        const boothCount = data.booths?.length || items.length;
        const contactCount = data.contactsCreated || 0;
        const msg = contactCount > 0
          ? `${boothCount} stands + ${contactCount} contatos importados com sucesso!`
          : `${boothCount} stands importados com sucesso!`;
        setCreateMsg(msg);
        fetchBooths();
      } else {
        setCreateMsg(data.error || 'Erro ao importar');
      }
    } catch {
      setCreateMsg('Erro ao processar planilha');
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteBooth = async (boothId: string, companyName: string) => {
    if (!confirm(`Deletar stand "${companyName}" e todas suas visitas?`)) return;
    setDeleting(boothId);
    try {
      const res = await fetch(`/api/events/${eventId}/booths/${boothId}`, { method: 'DELETE' });
      if (res.ok) fetchBooths();
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  };

  const fetchBooths = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await fetch(`/api/events/${eventId}/booths?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBooths(data.booths || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [eventId, search, statusFilter]);

  useEffect(() => { fetchBooths(); }, [fetchBooths]);

  // Auto-open drawer when navigated from the map with a preselected booth
  useEffect(() => {
    if (!preselectedBoothId) return;
    if (selectedBooth?.id === preselectedBoothId) return;
    const found = booths.find((b) => b.id === preselectedBoothId);
    if (found) {
      setSelectedBooth(found);
      onClearPreselect?.();
    }
  }, [preselectedBoothId, booths, selectedBooth, onClearPreselect]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBooth.company_name) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/events/${eventId}/booths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBooth),
      });
      if (res.ok) {
        setNewBooth({ company_name: '', booth_number: '', sector: '' });
        setShowAdd(false);
        fetchBooths();
      }
    } catch {
      // silent
    } finally {
      setAdding(false);
    }
  };

  const handleCreateContacts = async () => {
    if (!confirm('Criar contatos no pipeline para todos os stands pendentes?')) return;
    setCreatingContacts(true);
    setCreateMsg(null);
    try {
      const res = await fetch(`/api/events/${eventId}/booths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ create_contacts: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreateMsg(data.message || `${data.created} contatos criados`);
        fetchBooths();
      } else {
        setCreateMsg(data.error || 'Erro ao criar contatos');
      }
    } catch {
      setCreateMsg('Erro de conexao');
    } finally {
      setCreatingContacts(false);
    }
  };

  // Export (#3)
  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch all booths (no filter) + visits
      const res = await fetch(`/api/events/${eventId}/booths`);
      if (!res.ok) return;
      const data = await res.json();
      const allBooths: EventBooth[] = data.booths || [];

      const XLSX = await import('xlsx');
      const rows = allBooths.map((b) => {
        const v = b.visit;
        const meta = parseNotesMeta(v?.notes || null);
        const extraContactsStr = meta.extraContacts.map((c) => `${c.name} (${c.cargo})`).join('; ');
        return {
          'Empresa': b.company_name,
          'Stand': b.booth_number || '',
          'Setor': b.sector || '',
          'Status': b.status === 'VISITADO' ? 'Visitado' : 'Pendente',
          'Contato': v?.contact_name || '',
          'Cargo': v?.contact_role || '',
          'Outros Contatos': extraContactsStr,
          'Tipo': v?.prospect_type || '',
          'Observações': meta.userNotes,
          'Vendedor': v?.user_name || '',
          'Data Visita': v?.visited_at ? new Date(v.visited_at).toLocaleString('pt-BR') : '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 40 }, { wch: 15 }, { wch: 18 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stands');
      XLSX.writeFile(wb, `stands-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch { /* silent */ } finally { setExporting(false); }
  };

  const inputClass = 'w-full px-3 py-2 text-sm border rounded-lg bg-[#2a1245] text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 border-purple-700/30';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar stand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="flex gap-2">
          {['all', 'PENDENTE', 'VISITADO'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-purple-800/20 text-purple-300/60 border border-purple-700/20 hover:bg-purple-800/30'
              }`}
            >
              {s === 'all' ? 'Todos' : s === 'PENDENTE' ? 'Pendentes' : 'Visitados'}
            </button>
          ))}
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || booths.length === 0}
          className="px-3 py-2 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
        >
          {exporting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          Exportar
        </button>
        <button
          onClick={handleCreateContacts}
          disabled={creatingContacts || booths.length === 0}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          {creatingContacts ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
          Criar Contatos
        </button>
        <input
          ref={xlsInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleExcelImport(f);
            e.target.value = '';
          }}
        />
        <button
          onClick={handleDownloadTemplate}
          className="px-3 py-2 bg-purple-800/30 text-purple-300 rounded-lg text-xs font-medium hover:bg-purple-800/50 transition-colors flex items-center gap-1.5 shrink-0"
          title="Baixar modelo Excel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Modelo
        </button>
        <button
          onClick={() => xlsInputRef.current?.click()}
          disabled={importing}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          {importing ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
          Importar Excel
        </button>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 flex items-center gap-2 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Stand
        </button>
      </div>

      {createMsg && (
        <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm border border-emerald-500/20">
          {createMsg}
        </div>
      )}

      {/* Inline add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-[#1e0f35] rounded-xl border border-emerald-500/30 p-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Nome da empresa *"
            required
            value={newBooth.company_name}
            onChange={(e) => setNewBooth((b) => ({ ...b, company_name: e.target.value }))}
            className={`${inputClass} flex-1`}
            autoFocus
          />
          <input
            type="text"
            placeholder="Nº Stand"
            value={newBooth.booth_number}
            onChange={(e) => setNewBooth((b) => ({ ...b, booth_number: e.target.value }))}
            className={`${inputClass} w-full sm:w-28`}
          />
          <input
            type="text"
            placeholder="Setor"
            value={newBooth.sector}
            onChange={(e) => setNewBooth((b) => ({ ...b, sector: e.target.value }))}
            className={`${inputClass} w-full sm:w-32`}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={adding} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50">
              {adding ? '...' : 'Adicionar'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 bg-purple-800/30 text-purple-300 rounded-lg text-sm hover:bg-purple-800/50">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Count */}
      <p className="text-xs text-purple-300/40">{booths.length} stand(s)</p>

      {/* Booth list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-[#1e0f35] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : booths.length === 0 ? (
        <div className="text-center py-12 bg-[#1e0f35] rounded-xl border border-purple-800/30">
          <p className="text-purple-300/50 text-sm">Nenhum stand cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {booths.map((booth) => (
            <div
              key={booth.id}
              onClick={() => setSelectedBooth(booth)}
              className={`bg-[#1e0f35] rounded-lg border p-3 flex items-center gap-3 cursor-pointer hover:bg-[#241547] transition-colors ${
                booth.status === 'VISITADO' ? 'border-emerald-500/20' : 'border-purple-800/30'
              }`}
            >
              {booth.logo_url ? (
                <div className={`w-10 h-10 rounded bg-white/90 flex items-center justify-center shrink-0 overflow-hidden ring-2 ${
                  booth.status === 'VISITADO' ? 'ring-emerald-500/60' : 'ring-transparent'
                }`}>
                  <img
                    src={booth.logo_url}
                    alt={booth.company_name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  booth.status === 'VISITADO' ? 'bg-emerald-500/20' : 'bg-purple-800/30'
                }`}>
                  {booth.status === 'VISITADO' ? (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-purple-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{booth.company_name}</p>
                <div className="flex items-center gap-3 text-[10px] text-purple-300/40">
                  {booth.booth_number && <span>Stand {booth.booth_number}</span>}
                  {booth.sector && <span>{booth.sector}</span>}
                  {booth.visit && (
                    <span className="text-emerald-400/60">
                      Visitado por {booth.visit.user_name} em {new Date(booth.visit.visited_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${BOOTH_STATUS_COLORS[booth.status]}`}>
                  {booth.status === 'VISITADO' ? 'Visitado' : 'Pendente'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteBooth(booth.id, booth.company_name); }}
                  disabled={deleting === booth.id}
                  className="p-1.5 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                  title="Deletar stand"
                >
                  {deleting === booth.id ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
                <svg className="w-4 h-4 text-purple-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booth Drawer */}
      {selectedBooth && (
        <BoothDrawer
          booth={selectedBooth}
          eventId={eventId}
          isAdmin={isAdmin}
          eventStatus={eventStatus}
          onClose={() => setSelectedBooth(null)}
          onUpdate={() => { setSelectedBooth(null); fetchBooths(); }}
        />
      )}
    </div>
  );
}

// --- Check-in Tab ---
// Mode: 'choose' = 2 botoes iniciais (stand ou avulso)
//        'stand' = lista de stands + busca
//        'walkin' = formulario de contato avulso
type CheckInMode = 'choose' | 'stand' | 'walkin';

function CheckInTab({
  eventId,
  onDone,
  initialMode,
  onExit,
}: {
  eventId: string;
  onDone: () => void;
  initialMode?: CheckInMode;
  onExit?: () => void;
}) {
  const [mode, setMode] = useState<CheckInMode>(initialMode || 'choose');
  const skipChoose = initialMode === 'walkin' || initialMode === 'stand';
  const [booths, setBooths] = useState<EventBooth[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedBooth, setSelectedBooth] = useState<EventBooth | null>(null);
  const [showNewBooth, setShowNewBooth] = useState(false);
  const [confirmRevisit, setConfirmRevisit] = useState<EventBooth | null>(null);

  const fetchBooths = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const res = await fetch(`/api/events/${eventId}/booths?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBooths(data.booths || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [eventId, search]);

  useEffect(() => { fetchBooths(); }, [fetchBooths]);

  // Ao clicar num stand, se já foi visitado, pede confirmação antes de abrir o form.
  const handleSelectBooth = (booth: EventBooth) => {
    if (booth.status === 'VISITADO') {
      setConfirmRevisit(booth);
    } else {
      setSelectedBooth(booth);
    }
  };

  if (selectedBooth) {
    return (
      <CheckInForm
        eventId={eventId}
        booth={selectedBooth}
        onBack={() => setSelectedBooth(null)}
        onDone={() => {
          setSelectedBooth(null);
          fetchBooths();
          onDone();
        }}
      />
    );
  }

  // Modo "avulso": formulario sem stand
  // NOTA: este path e codigo legado (CheckInTab nao e mais chamado desde o
  // novo fluxo de drafts backend). Mantemos so pra nao derrubar o arquivo todo.
  if (mode === 'walkin') {
    return (
      <WalkInForm
        eventId={eventId}
        contactId="legacy-unused"
        onBack={() => {
          if (skipChoose && onExit) onExit();
          else setMode('choose');
        }}
        onDone={() => {
          onDone();
          if (skipChoose && onExit) onExit();
          else setMode('choose');
        }}
      />
    );
  }

  const inputClass = 'w-full px-3 py-2 text-sm border rounded-lg bg-[#2a1245] text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 border-purple-700/30';

  // Modo "choose": tela inicial com 2 botoes grandes — Stand ou Avulso
  if (mode === 'choose') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white mb-1">Novo Check-in</h2>
          <p className="text-purple-300/60 text-sm">Escolha como voce encontrou o contato</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Botao STAND */}
          <button
            onClick={() => setMode('stand')}
            className="group text-left bg-[#1e0f35] rounded-2xl border-2 border-purple-800/30 p-6 hover:border-emerald-500/60 hover:bg-[#1e0f35]/80 active:scale-[0.98] transition-all min-h-[160px]"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-3 group-hover:bg-emerald-500/25 transition-colors">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-base mb-1">Stand</h3>
            <p className="text-xs text-purple-300/60 leading-relaxed">
              Estou no stand de uma empresa. Vou tirar foto da fachada e do cartao.
            </p>
          </button>

          {/* Botao AVULSO */}
          <button
            onClick={() => setMode('walkin')}
            className="group text-left bg-[#1e0f35] rounded-2xl border-2 border-purple-800/30 p-6 hover:border-cyan-500/60 hover:bg-[#1e0f35]/80 active:scale-[0.98] transition-all min-h-[160px]"
          >
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mb-3 group-hover:bg-cyan-500/25 transition-colors">
              <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-base mb-1">Contato Avulso</h3>
            <p className="text-xs text-purple-300/60 leading-relaxed">
              Encontrei alguem fora de um stand (corredor, cafe, palestra). So tiro foto do cartao.
            </p>
          </button>
        </div>

        <div className="bg-purple-900/10 border border-purple-800/20 rounded-lg p-3 flex items-start gap-2">
          <svg className="w-4 h-4 text-purple-400/60 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px] text-purple-300/60 leading-relaxed">
            Os 2 caminhos funcionam offline. Se nao tiver internet, o contato fica salvo na fila e sincroniza sozinho quando voltar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botao voltar pra tela de escolha */}
      <button
        onClick={() => setMode('choose')}
        className="inline-flex items-center gap-2 text-purple-300/70 hover:text-white text-xs transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>
      <p className="text-purple-300/50 text-sm">Selecione o stand para registrar a visita</p>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar stand por nome ou número..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} pl-11 py-3 text-base`}
          autoFocus
        />
      </div>

      {/* Booth list for selection */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-[#1e0f35] rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {booths.map((booth) => (
              <button
                key={booth.id}
                onClick={() => handleSelectBooth(booth)}
                className={`w-full text-left bg-[#1e0f35] rounded-xl border p-4 hover:border-emerald-500/40 transition-colors ${
                  booth.status === 'VISITADO' ? 'border-emerald-500/20 opacity-60' : 'border-purple-800/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{booth.company_name}</p>
                    <div className="flex gap-3 text-xs text-purple-300/40 mt-0.5">
                      {booth.booth_number && <span>Stand {booth.booth_number}</span>}
                      {booth.sector && <span>{booth.sector}</span>}
                    </div>
                  </div>
                  {booth.status === 'VISITADO' ? (
                    <span className="text-[10px] text-emerald-400 font-bold">JÁ VISITADO</span>
                  ) : (
                    <svg className="w-5 h-5 text-purple-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* New booth inline */}
          <button
            onClick={() => setShowNewBooth(true)}
            className="w-full text-left bg-[#1e0f35] rounded-xl border border-dashed border-purple-700/30 p-4 hover:border-emerald-500/40 transition-colors"
          >
            <div className="flex items-center gap-3 text-emerald-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium text-sm">Cadastrar Novo Stand</span>
            </div>
          </button>

          {showNewBooth && (
            <NewBoothInline
              eventId={eventId}
              onCreated={(booth) => {
                setShowNewBooth(false);
                setSelectedBooth(booth);
                fetchBooths();
              }}
              onCancel={() => setShowNewBooth(false)}
            />
          )}
        </>
      )}

      {/* Modal: confirmar revisita a stand já visitado */}
      {confirmRevisit && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmRevisit(null)}
        >
          <div
            className="bg-[#1e0f35] border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-amber-900/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white mb-1">Stand já visitado</h3>
                <p className="text-sm text-purple-200/70">
                  <span className="font-semibold text-amber-300">{confirmRevisit.company_name}</span>
                  {confirmRevisit.booth_number && <span className="text-purple-300/60"> (Stand {confirmRevisit.booth_number})</span>}
                  {' '}já foi marcado como visitado neste evento.
                </p>
                <p className="text-xs text-purple-300/50 mt-2 leading-relaxed">
                  Se continuar, um novo check-in será registrado por cima. Tem certeza que quer revisitar?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRevisit(null)}
                className="flex-1 py-3 min-h-[48px] bg-purple-800/40 text-purple-200 rounded-lg font-semibold text-sm hover:bg-purple-800/60 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setSelectedBooth(confirmRevisit);
                  setConfirmRevisit(null);
                }}
                className="flex-1 py-3 min-h-[48px] bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 transition-colors"
              >
                Sim, revisitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- New Booth Inline ---
function NewBoothInline({
  eventId,
  onCreated,
  onCancel,
}: {
  eventId: string;
  onCreated: (booth: EventBooth) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ company_name: '', booth_number: '', sector: '' });
  const [loading, setLoading] = useState(false);

  const inputClass = 'w-full px-3 py-2 text-sm border rounded-lg bg-[#2a1245] text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 border-purple-700/30';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/booths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated(data.booths[0]);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#1e0f35] rounded-xl border border-emerald-500/30 p-4 space-y-3">
      <input type="text" placeholder="Nome da empresa *" required value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} className={inputClass} autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <input type="text" placeholder="Nº Stand" value={form.booth_number} onChange={(e) => setForm((f) => ({ ...f, booth_number: e.target.value }))} className={inputClass} />
        <input type="text" placeholder="Setor" value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} className={inputClass} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50">
          {loading ? '...' : 'Criar e Fazer Check-in'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-purple-800/30 text-purple-300 rounded-lg text-sm hover:bg-purple-800/50">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// --- Check-In Form ---
function CheckInForm({
  eventId,
  booth,
  onBack,
  onDone,
}: {
  eventId: string;
  booth: EventBooth;
  onBack: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    contact_name: '',
    contact_role: '',
    prospect_type: 'COMPRADOR',
    notes: '',
  });
  const [facadeFile, setFacadeFile] = useState<File | null>(null);
  const [contactFile, setContactFile] = useState<File | null>(null);
  const [facadePreview, setFacadePreview] = useState<string | null>(null);
  const [contactPreview, setContactPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const facadeRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const scanCardRef = useRef<HTMLInputElement>(null);

  // === DRAFT: persiste form + fotos no IndexedDB pra sobreviver a recargas ===
  const draftKey = `checkin-full-${eventId}-${booth.id}`;
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);
  const draftReadyRef = useRef(false);
  // Base64 paralelo das fotos pra draft
  const [facadeB64, setFacadeB64] = useState<{ name: string; type: string; dataUrl: string } | null>(null);
  const [contactB64, setContactB64] = useState<{ name: string; type: string; dataUrl: string } | null>(null);

  // Restaura rascunho ao montar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await draftLoad<{
          form: typeof form;
          facadePhoto: { name: string; type: string; dataUrl: string } | null;
          contactPhoto: { name: string; type: string; dataUrl: string } | null;
        }>(draftKey);
        if (cancelled || !saved || !saved.data) {
          draftReadyRef.current = true;
          return;
        }
        const d = saved.data;
        if (d.form) setForm(d.form);
        if (d.facadePhoto) {
          try {
            const f = await dataUrlToFile(d.facadePhoto.dataUrl, d.facadePhoto.name);
            setFacadeFile(f);
            setFacadePreview(d.facadePhoto.dataUrl);
            setFacadeB64(d.facadePhoto);
          } catch { /* ignora */ }
        }
        if (d.contactPhoto) {
          try {
            const f = await dataUrlToFile(d.contactPhoto.dataUrl, d.contactPhoto.name);
            setContactFile(f);
            setContactPreview(d.contactPhoto.dataUrl);
            setContactB64(d.contactPhoto);
          } catch { /* ignora */ }
        }
        setDraftRestoredAt(saved.updatedAt);
      } catch { /* silent */ } finally {
        draftReadyRef.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [draftKey]);

  // Auto-save debounced
  useEffect(() => {
    if (!draftReadyRef.current) return;
    const t = setTimeout(() => {
      draftSave(draftKey, {
        form,
        facadePhoto: facadeB64,
        contactPhoto: contactB64,
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [draftKey, form, facadeB64, contactB64]);

  const handleDismissDraft = async () => {
    await draftClear(draftKey).catch(() => {});
    setDraftRestoredAt(null);
    setForm({ contact_name: '', contact_role: '', prospect_type: 'COMPRADOR', notes: '' });
    setFacadeFile(null);
    setFacadePreview(null);
    setFacadeB64(null);
    setContactFile(null);
    setContactPreview(null);
    setContactB64(null);
  };

  // Card scanner state
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedExtras, setScannedExtras] = useState<{ phone?: string; email?: string; company?: string } | null>(null);

  // QR Code state
  const [qrLoading, setQrLoading] = useState(false);
  const [qrLinks, setQrLinks] = useState<{ id: string; token: string; label: string; url: string }[]>([]);
  const [selectedQrIdx, setSelectedQrIdx] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrSetupUrl, setQrSetupUrl] = useState<string | null>(null);
  const [qrCopied, setQrCopied] = useState(false);

  const handleFetchQR = async () => {
    setQrLoading(true);
    setQrError(null);
    setQrSetupUrl(null);
    try {
      const res = await fetch(`/api/events/${eventId}/booths/${booth.id}/qr-link`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setQrError(data.error || 'Erro ao buscar QR Codes');
        return;
      }
      if (data.needs_setup || !data.links?.length) {
        setQrError(data.error || 'Nenhum QR Code configurado');
        setQrSetupUrl(data.setup_url || '/settings#qr-codes');
        return;
      }
      setQrLinks(data.links);
      setSelectedQrIdx(0);
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(data.links[0].url, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
    } catch {
      setQrError('Erro de conexao ao buscar QR Codes');
    } finally {
      setQrLoading(false);
    }
  };

  const handleSelectQrLink = async (idx: number) => {
    setSelectedQrIdx(idx);
    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(qrLinks[idx].url, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
    } catch { /* silent */ }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.download = `qr-${booth.company_name.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.href = qrDataUrl;
    a.click();
  };

  const handleCopyLink = async () => {
    const url = qrLinks[selectedQrIdx]?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2000);
    }
  };

  const handleFile = async (file: File | null, type: 'facade' | 'contact') => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (type === 'facade') {
      setFacadeFile(file);
      setFacadePreview(url);
    } else {
      setContactFile(file);
      setContactPreview(url);
    }
    // Converte pra base64 em paralelo pro draft persistente
    try {
      const dataUrl = await fileToDataUrl(file);
      const b64 = { name: file.name, type: file.type || 'application/octet-stream', dataUrl };
      if (type === 'facade') setFacadeB64(b64);
      else setContactB64(b64);
    } catch { /* silent */ }
  };

  const handleScanCard = async (file: File | null) => {
    if (!file) return;
    setScanLoading(true);
    setScanError(null);
    setScannedExtras(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/scan-card', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || 'Erro ao ler cartão');
        return;
      }
      // Preenche campos do form
      setForm((f) => ({
        ...f,
        contact_name: data.name || f.contact_name,
        contact_role: data.cargo || f.contact_role,
      }));
      // Guarda campos extras para mostrar ao usuário
      const extras: { phone?: string; email?: string; company?: string } = {};
      if (data.phone) extras.phone = data.phone;
      if (data.email) extras.email = data.email;
      if (data.company) extras.company = data.company;
      if (Object.keys(extras).length > 0) {
        setScannedExtras(extras);
      }
      // Também usa a foto do cartão como foto de contato (se ainda não tem)
      if (!contactFile) {
        setContactFile(file);
        setContactPreview(URL.createObjectURL(file));
      }
    } catch (e: any) {
      setScanError(e.message || 'Erro ao ler cartão');
    } finally {
      setScanLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Anexar extras do cartão escaneado às notes
      let finalNotes = form.notes;
      if (scannedExtras) {
        const extraLines: string[] = [];
        if (scannedExtras.phone) extraLines.push(`Telefone: ${scannedExtras.phone}`);
        if (scannedExtras.email) extraLines.push(`Email: ${scannedExtras.email}`);
        if (scannedExtras.company) extraLines.push(`Empresa (cartão): ${scannedExtras.company}`);
        if (extraLines.length > 0) {
          finalNotes = finalNotes
            ? `${finalNotes}\n\n--- Dados do cartão ---\n${extraLines.join('\n')}`
            : `--- Dados do cartão ---\n${extraLines.join('\n')}`;
        }
      }

      // Monta campos de texto
      const fields: Record<string, string> = {
        booth_id: booth.id,
        contact_name: form.contact_name,
        contact_role: form.contact_role,
        prospect_type: form.prospect_type,
        notes: finalNotes,
      };
      if (scannedExtras?.phone) fields.contact_phone = scannedExtras.phone;
      if (scannedExtras?.email) fields.contact_email = scannedExtras.email;

      // Converte fotos para base64 (sobrevive no IndexedDB se offline)
      const files: Array<{ field: string; name: string; type: string; base64: string }> = [];
      if (facadeFile) {
        const b64 = await fileToBase64(facadeFile);
        files.push({ field: 'photo_facade', ...b64 });
      }
      if (contactFile) {
        const b64 = await fileToBase64(contactFile);
        files.push({ field: 'photo_contact', ...b64 });
      }

      const result = await enqueueOrSend({
        type: 'booth-checkin',
        endpoint: `/api/events/${eventId}/check-in`,
        method: 'POST',
        body: { __form: true, fields, files },
        meta: { booth_id: booth.id, booth_name: booth.company_name, event_id: eventId },
      });

      if (result.sent) {
        // Enviado com sucesso — limpa rascunho
        draftClear(draftKey).catch(() => {});
        setSuccess(true);
        setTimeout(onDone, 1500);
      } else if (result.queued) {
        // Offline — enfileirou. Payload (com fotos em base64) está seguro no IndexedDB.
        draftClear(draftKey).catch(() => {});
        setSuccess(true);
        setTimeout(onDone, 1500);
      }
      // Se result.response existe (erro HTTP), mantém rascunho pro usuário tentar de novo.
    } catch {
      // silent — mantém rascunho pro usuário tentar de novo
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm border rounded-lg bg-[#2a1245] text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 border-purple-700/30';

  if (success) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-white font-bold text-lg mb-1">Check-in Realizado!</h3>
        <p className="text-purple-300/50 text-sm">{booth.company_name}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-purple-300/50 hover:text-emerald-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h3 className="text-white font-bold text-lg">Check-in: {booth.company_name}</h3>
          <div className="flex gap-3 text-xs text-purple-300/40">
            {booth.booth_number && <span>Stand {booth.booth_number}</span>}
            {booth.sector && <span>{booth.sector}</span>}
          </div>
        </div>
      </div>

      {/* Draft restaurado — banner com opção de descartar */}
      {draftRestoredAt && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 min-w-0 text-xs">
            <div className="font-semibold text-amber-300">Rascunho restaurado</div>
            <div className="text-amber-200/70">Salvo {formatDraftAge(draftRestoredAt)}. Continue de onde parou.</div>
          </div>
          <button
            type="button"
            onClick={handleDismissDraft}
            className="shrink-0 px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={() => setDraftRestoredAt(null)}
            className="shrink-0 p-1 text-amber-400/60 hover:text-amber-300"
            aria-label="Fechar aviso"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* QR Code Section */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4 space-y-3">
        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          QR Code para Captura de Dados
        </h4>
        <p className="text-xs text-purple-300/50">
          Mostre o QR Code para a pessoa no stand. Ela escaneia e preenche seus proprios dados.
        </p>

        {qrError && (
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-200 text-xs border border-amber-500/30 space-y-2">
            <p>{qrError}</p>
            {qrSetupUrl && (
              <a href={qrSetupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 rounded-md font-semibold transition-colors">
                Criar QR Code agora
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            )}
          </div>
        )}

        {qrLinks.length === 0 ? (
          <button
            type="button"
            onClick={handleFetchQR}
            disabled={qrLoading}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {qrLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Mostrar QR Code
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            {/* Link selector if multiple */}
            {qrLinks.length > 1 && (
              <div className="space-y-1">
                <p className="text-[10px] text-purple-300/40 uppercase font-bold tracking-wider">Selecionar link</p>
                <div className="flex flex-wrap gap-1.5">
                  {qrLinks.map((l, idx) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => handleSelectQrLink(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedQrIdx === idx
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-purple-800/20 text-purple-300/60 border border-purple-700/20 hover:bg-purple-800/30'
                      }`}
                    >
                      {l.label || `Link ${idx + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* QR Code Image */}
            {qrDataUrl && (
              <div className="flex justify-center">
                <div className="bg-white rounded-xl p-3">
                  <img src={qrDataUrl} alt="QR Code" className="w-56 h-56" />
                </div>
              </div>
            )}
            <p className="text-center text-xs text-purple-300/50">
              {qrLinks[selectedQrIdx]?.label || 'Link de captura'}
            </p>
            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownloadQR}
                className="flex-1 py-2.5 bg-purple-800/30 text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-800/50 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Baixar PNG
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2.5 bg-purple-800/30 text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-800/50 transition-colors flex items-center justify-center gap-2"
              >
                {qrCopied ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copiar Link
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-purple-700/30" />
        <span className="text-xs text-purple-300/40">ou preencha manualmente</span>
        <div className="flex-1 h-px bg-purple-700/30" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Photos */}
        <div className="grid grid-cols-2 gap-4">
          {/* Facade photo */}
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-2">Foto da Fachada</label>
            <input
              ref={facadeRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null, 'facade')}
            />
            <button
              type="button"
              onClick={() => facadeRef.current?.click()}
              className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-purple-700/30 hover:border-emerald-500/40 transition-colors flex flex-col items-center justify-center gap-2 overflow-hidden bg-[#2a1245]"
            >
              {facadePreview ? (
                <img src={facadePreview} alt="Fachada" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <>
                  <svg className="w-8 h-8 text-purple-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs text-purple-300/40">Tirar foto</span>
                </>
              )}
            </button>
          </div>

          {/* Contact photo */}
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-2">Foto com Contato</label>
            <input
              ref={contactRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null, 'contact')}
            />
            <button
              type="button"
              onClick={() => contactRef.current?.click()}
              className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-purple-700/30 hover:border-emerald-500/40 transition-colors flex flex-col items-center justify-center gap-2 overflow-hidden bg-[#2a1245]"
            >
              {contactPreview ? (
                <img src={contactPreview} alt="Contato" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <>
                  <svg className="w-8 h-8 text-purple-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-xs text-purple-300/40">Tirar foto</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Contact info */}
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Quem nos atendeu</h4>
            <div>
              <input
                ref={scanCardRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  handleScanCard(e.target.files?.[0] || null);
                  if (scanCardRef.current) scanCardRef.current.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => scanCardRef.current?.click()}
                disabled={scanLoading}
                className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Fotografe o cartão de visita para preencher automaticamente"
              >
                {scanLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-cyan-300 rounded-full animate-spin" />
                    Lendo cartão...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Escanear cartão
                  </>
                )}
              </button>
            </div>
          </div>

          {scanError && (
            <div className="p-2 rounded-lg bg-red-500/15 text-red-400 text-xs border border-red-500/20">
              {scanError}
            </div>
          )}

          {scannedExtras && (
            <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs space-y-0.5">
              <p className="text-cyan-300 font-bold mb-1">Dados extraídos do cartão:</p>
              {scannedExtras.phone && <p className="text-cyan-200/80">📞 {scannedExtras.phone}</p>}
              {scannedExtras.email && <p className="text-cyan-200/80">✉️ {scannedExtras.email}</p>}
              {scannedExtras.company && <p className="text-cyan-200/80">🏢 {scannedExtras.company}</p>}
              <p className="text-cyan-300/60 mt-1 text-[10px]">
                Adicionados às observações — serão salvos com o check-in.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-purple-200/80 mb-1">Nome do contato</label>
              <input
                type="text"
                placeholder="Ex: João Silva"
                value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-200/80 mb-1">Cargo</label>
              <input
                type="text"
                placeholder="Ex: Gerente Comercial"
                value={form.contact_role}
                onChange={(e) => setForm((f) => ({ ...f, contact_role: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          {/* Prospect type */}
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-2">Tipo de Prospecção</label>
            <div className="flex gap-2">
              {['COMPRADOR', 'FORNECEDOR', 'AMBOS'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, prospect_type: type }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.prospect_type === type
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-purple-800/20 text-purple-300/60 border border-purple-700/20 hover:bg-purple-800/30'
                  }`}
                >
                  {PROSPECT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-1">Observações</label>
            <textarea
              placeholder="O que conversou, interesses, próximos passos..."
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        {/* Submit — mobile friendly (touch area ≥ 56px) */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 min-h-[56px] bg-emerald-500 text-white rounded-xl font-bold text-base hover:bg-emerald-600 active:bg-emerald-600 active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg shadow-emerald-900/30"
        >
          {loading ? 'Registrando...' : '✓ Registrar Visita'}
        </button>
      </form>
    </div>
  );
}

// --- Walk-In Form (contato avulso, sem stand) ---
// Arquitetura atual: recebe `contactId` ja existente (rascunho criado via
// POST /api/contacts/draft) e opera em cima dele. Texto vai por PATCH debounced.
// Na finalizacao, manda multipart pro walk-in endpoint com `contact_id`, que
// entao marca is_draft=false e faz upload das fotos.
// Rascunho offline-local (IndexedDB) ainda existe como fallback enquanto o
// usuario digita sem internet — mas o registro do contato em si ja esta no banco.
function WalkInForm({
  eventId,
  contactId,
  usesAssociation,
  onBack,
  onDone,
}: {
  eventId: string;
  contactId: string;
  usesAssociation?: boolean;
  onBack: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    contact_name: '',
    company: '',
    contact_role: '',
    contact_phone: '',
    contact_email: '',
    prospect_type: 'COMPRADOR' as 'COMPRADOR' | 'FORNECEDOR' | 'AMBOS',
    notes: '',
    associacao: '',
  });
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [cardPreview, setCardPreview] = useState<string | null>(null);
  const [cardB64, setCardB64] = useState<{ name: string; type: string; dataUrl: string } | null>(null);
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [personB64, setPersonB64] = useState<{ name: string; type: string; dataUrl: string } | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);
  const personInputRef = useRef<HTMLInputElement>(null);

  // QR code pra captura publica: cliente escaneia e preenche no celular dele.
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [showQr, setShowQr] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [associacoes, setAssociacoes] = useState<Array<{ sigla: string; nome_completo: string; contacts_count?: number; last_interaction_at?: string | null }>>([]);

  useEffect(() => {
    if (!usesAssociation) return;
    fetch('/api/associations')
      .then((r) => (r.ok ? r.json() : { associations: [] }))
      .then((d) => setAssociacoes(d.associations || []))
      .catch(() => {});
  }, [usesAssociation]);

  useEffect(() => {
    // Gera o QR code apontando pra pagina publica deste rascunho.
    // window.location so existe no client — por isso tudo dentro do useEffect
    // pra nao criar hydration mismatch com SSR.
    (async () => {
      try {
        const url = `${window.location.origin}/walkin-fill/${contactId}`;
        setQrUrl(url);
        const QRCode = (await import('qrcode')).default;
        const data = await QRCode.toDataURL(url, {
          width: 280,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
        setQrDataUrl(data);
      } catch {
        // silent — feature opcional
      }
    })();
  }, [contactId]);

  // Busca o estado atual do contato no servidor e sincroniza no form local.
  // Usado pelo botao "Atualizar" depois que o cliente escaneou o QR e preencheu.
  const pullFromServer = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`);
      if (!res.ok) return;
      const data = await res.json();
      const c = data.contact;
      if (!c) return;
      setForm((prev) => ({
        ...prev,
        contact_name: c.name && c.name !== '(rascunho)' ? c.name : prev.contact_name,
        company: c.company || prev.company,
        contact_role: c.cargo || prev.contact_role,
        contact_phone: c.phone || prev.contact_phone,
        contact_email: c.email || prev.contact_email,
        associacao: c.associacao || prev.associacao,
      }));
      setSyncedAt(Date.now());
      setTimeout(() => setSyncedAt(null), 3000);
    } catch {
      // silent
    } finally {
      setSyncing(false);
    }
  };

  // Rascunho local (IndexedDB) — complementa o rascunho no banco. Usado pra
  // sobreviver a reloads/celular dormir enquanto o usuario ainda nao clicou
  // "Finalizar". Chave e composta pelo contactId (unico no banco).
  const draftKey = `walkin-contact-${contactId}`;
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);
  const draftReadyRef = useRef(false);

  // Restaura rascunho ao montar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await draftLoad<{
          form: typeof form;
          cardPhoto: { name: string; type: string; dataUrl: string } | null;
          personPhoto: { name: string; type: string; dataUrl: string } | null;
        }>(draftKey);
        if (cancelled || !saved || !saved.data) {
          draftReadyRef.current = true;
          return;
        }
        const d = saved.data;
        if (d.form) setForm(d.form);
        if (d.cardPhoto) {
          try {
            const f = await dataUrlToFile(d.cardPhoto.dataUrl, d.cardPhoto.name);
            setCardFile(f);
            setCardPreview(d.cardPhoto.dataUrl);
            setCardB64(d.cardPhoto);
          } catch { /* ignora */ }
        }
        if (d.personPhoto) {
          try {
            const f = await dataUrlToFile(d.personPhoto.dataUrl, d.personPhoto.name);
            setPersonFile(f);
            setPersonPreview(d.personPhoto.dataUrl);
            setPersonB64(d.personPhoto);
          } catch { /* ignora */ }
        }
        setDraftRestoredAt(saved.updatedAt);
      } catch { /* silent */ } finally {
        draftReadyRef.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [draftKey]);

  // Auto-save debounced — local (IndexedDB) e servidor (PATCH). O local
  // preserva fotos e campos offline; o servidor reflete nome/empresa na
  // lista de Rascunhos pra aparecer de outros dispositivos.
  useEffect(() => {
    if (!draftReadyRef.current) return;
    const t = setTimeout(() => {
      draftSave(draftKey, { form, cardPhoto: cardB64, personPhoto: personB64 }).catch(() => {});
      // Sincroniza os campos textuais pro servidor. Best-effort: se falhar
      // (offline), o draft local ainda garante recuperacao.
      const patchPayload: Record<string, any> = {};
      if (form.contact_name.trim()) patchPayload.name = form.contact_name.trim();
      if (form.company.trim()) patchPayload.company = form.company.trim();
      if (form.contact_role.trim()) patchPayload.cargo = form.contact_role.trim();
      if (form.contact_phone.trim()) patchPayload.phone = form.contact_phone.trim();
      if (form.contact_email.trim()) patchPayload.email = form.contact_email.trim();
      if (form.associacao.trim()) patchPayload.associacao = form.associacao.trim();
      if (Object.keys(patchPayload).length > 0) {
        fetch(`/api/contacts/${contactId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchPayload),
        }).catch(() => { /* silencioso — fallback e o draft local */ });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [draftKey, form, cardB64, personB64, contactId]);

  const handleDismissDraft = async () => {
    await draftClear(draftKey).catch(() => {});
    setDraftRestoredAt(null);
    setForm({
      contact_name: '',
      company: '',
      contact_role: '',
      contact_phone: '',
      contact_email: '',
      prospect_type: 'COMPRADOR',
      notes: '',
      associacao: '',
    });
    setCardFile(null);
    setCardPreview(null);
    setCardB64(null);
    setPersonFile(null);
    setPersonPreview(null);
    setPersonB64(null);
  };

  const handlePersonFile = async (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPersonFile(file);
    setPersonPreview(url);
    try {
      const dataUrl = await fileToDataUrl(file);
      setPersonB64({ name: file.name, type: file.type || 'application/octet-stream', dataUrl });
    } catch { /* silent */ }
  };

  const handleCardFile = async (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCardFile(file);
    setCardPreview(url);
    // Converte pra base64 pro draft
    try {
      const dataUrl = await fileToDataUrl(file);
      setCardB64({ name: file.name, type: file.type || 'application/octet-stream', dataUrl });
    } catch { /* silent */ }

    // OCR via OpenAI pra pre-preencher os campos
    setScanLoading(true);
    setScanError(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/scan-card', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || 'Erro ao ler cartao');
        return;
      }
      setForm((f) => ({
        ...f,
        contact_name: data.name || f.contact_name,
        contact_role: data.cargo || f.contact_role,
        contact_phone: data.phone || f.contact_phone,
        contact_email: data.email || f.contact_email,
        company: data.company || f.company,
        associacao: data.associacao || f.associacao,
      }));
    } catch (e: any) {
      setScanError(e.message || 'Erro ao ler cartao');
    } finally {
      setScanLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contact_name.trim() || form.contact_name.trim().length < 2) {
      setSuccessMsg('Nome e obrigatorio');
      setTimeout(() => setSuccessMsg(null), 2500);
      return;
    }
    const phoneDigits = form.contact_phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setSuccessMsg('Telefone e obrigatorio (min 10 digitos com DDD)');
      setTimeout(() => setSuccessMsg(null), 2500);
      return;
    }
    setLoading(true);
    setSuccessMsg(null);

    try {
      const fields: Record<string, string> = {
        contact_name: form.contact_name.trim(),
        company: form.company.trim(),
        contact_role: form.contact_role.trim(),
        contact_phone: form.contact_phone.trim(),
        contact_email: form.contact_email.trim(),
        prospect_type: form.prospect_type,
        notes: form.notes.trim(),
        associacao: form.associacao.trim(),
        // contact_id diz pro walk-in endpoint "este rascunho ja existe no
        // banco, em vez de criar um novo contato, finaliza este (is_draft=false)".
        contact_id: contactId,
      };

      const files: Array<{ field: string; name: string; type: string; base64: string }> = [];
      if (cardFile) {
        const b64 = await fileToBase64(cardFile);
        files.push({ field: 'photo_contact', ...b64 });
      }
      if (personFile) {
        const b64 = await fileToBase64(personFile);
        files.push({ field: 'photo_person', ...b64 });
      }

      const result = await enqueueOrSend({
        type: 'walk-in',
        endpoint: `/api/events/${eventId}/walk-in`,
        method: 'POST',
        body: { __form: true, fields, files },
        meta: { event_id: eventId, contact_name: form.contact_name.trim() },
      });

      if (result.sent) {
        draftClear(draftKey).catch(() => {});
        setSuccessMsg('Contato avulso registrado!');
        setTimeout(onDone, 1200);
      } else if (result.queued) {
        draftClear(draftKey).catch(() => {});
        setSuccessMsg('Offline — contato salvo na fila');
        setTimeout(onDone, 1500);
      } else if (result.response) {
        // Erro HTTP — tenta ler a mensagem
        let errMsg = 'Erro ao enviar. Tente novamente.';
        let fullBody: any = null;
        try {
          fullBody = await result.response.json();
          if (fullBody?.error) errMsg = fullBody.error;
        } catch { /* ignora */ }
        // DEBUG TEMPORARIO: mostra tudo do body num alert pra diagnostico.
        // Remover apos encontrar a causa do 500.
        if (result.response.status === 500 && fullBody) {
          const lines = [
            `STATUS: ${result.response.status}`,
            `STEP: ${fullBody.step || '-'}`,
            `ERROR: ${fullBody.error || '-'}`,
            `CODE: ${fullBody.code || '-'}`,
            `NAME: ${fullBody.name || '-'}`,
            `DETAILS: ${fullBody.details || '-'}`,
            `HINT: ${fullBody.hint || '-'}`,
            `STACK:`,
            (fullBody.stack || '-'),
          ];
          try { alert(lines.join('\n')); } catch {}
        }
        setSuccessMsg(errMsg);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch {
      setSuccessMsg('Erro inesperado');
      setTimeout(() => setSuccessMsg(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3 py-3 text-base border rounded-lg bg-[#2a1245] text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-500 border-purple-700/30';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-purple-300/60 hover:text-cyan-400 transition-colors" aria-label="Voltar">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-lg">Contato Avulso</h3>
          <p className="text-xs text-cyan-300/60">
            Sem vinculo com stand (corredor, cafe, palestra)
          </p>
          <p className="text-[10px] text-purple-300/40 mt-0.5 font-mono">
            ID: {contactId.slice(0, 8)}...{contactId.slice(-4)}
          </p>
        </div>
      </div>

      {/* QR code + botao Atualizar: o cliente pode escanear e preencher os
          dados no proprio celular dele; o vendedor clica "Atualizar" pra
          puxar os dados que o cliente preencheu. */}
      <div className="bg-[#1e0f35] rounded-xl border border-cyan-500/20 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white">Preenchimento pelo cliente</div>
            <div className="text-[11px] text-purple-300/60 mt-0.5 leading-relaxed">
              Mostre o QR code pro cliente escanear e preencher os dados dele no celular.
              Depois clique <span className="text-cyan-300 font-medium">Atualizar</span> aqui pra puxar.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="shrink-0 px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 rounded-lg text-[11px] font-semibold hover:bg-cyan-500/25 transition-colors"
          >
            {showQr ? 'Esconder QR' : 'Mostrar QR'}
          </button>
        </div>

        {showQr && qrDataUrl && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-purple-800/30">
            <img
              src={qrDataUrl}
              alt="QR code pro cliente preencher"
              className="w-48 h-48 rounded-lg bg-white p-2"
            />
            <p className="text-[10px] text-purple-300/50 text-center break-all px-2">
              {qrUrl}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={pullFromServer}
          disabled={syncing}
          className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Atualizando...' : syncedAt ? '✓ Atualizado!' : 'Atualizar dados do cliente'}
        </button>
      </div>

      {/* Draft restaurado */}
      {draftRestoredAt && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 min-w-0 text-xs">
            <div className="font-semibold text-amber-300">Rascunho restaurado</div>
            <div className="text-amber-200/70">Salvo {formatDraftAge(draftRestoredAt)}. Continue de onde parou.</div>
          </div>
          <button
            type="button"
            onClick={handleDismissDraft}
            className="shrink-0 px-2.5 py-1.5 text-[11px] font-semibold rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
          >
            Descartar
          </button>
        </div>
      )}

      {/* Status banner (sucesso/erro) */}
      {successMsg && (
        <div className="p-3 rounded-lg bg-cyan-500/15 text-cyan-300 text-sm font-medium border border-cyan-500/20 text-center">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Foto da pessoa — opcional, mesmo motivo do check-in em stand:
            ajuda a lembrar de quem e quando for olhar o contato depois. */}
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4">
          <label className="block text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">
            Foto da Pessoa
          </label>
          <p className="text-[11px] text-purple-300/50 mb-3">
            Opcional. Ajuda a lembrar de quem se trata quando voltar pro contato depois.
          </p>

          {personPreview ? (
            <div className="relative">
              <img src={personPreview} alt="Pessoa" className="w-full max-h-64 object-contain rounded-lg border border-purple-700/30 bg-[#2a1245]" />
              <button
                type="button"
                onClick={() => {
                  setPersonFile(null);
                  setPersonPreview(null);
                  setPersonB64(null);
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full text-white hover:bg-black"
                aria-label="Remover foto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => personInputRef.current?.click()}
              className="w-full py-4 min-h-[64px] bg-[#2a1245] border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/60 text-cyan-300 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Tirar foto da pessoa
            </button>
          )}

          <input
            ref={personInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handlePersonFile(e.target.files?.[0] || null)}
          />
        </div>

        {/* Foto do cartao (com OCR automatico) */}
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4">
          <label className="block text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">
            Foto do Cartao de Visita
          </label>
          <p className="text-[11px] text-purple-300/50 mb-3">
            A foto e opcional, mas se tirar, a IA le os dados e preenche o formulario sozinha.
          </p>

          {cardPreview ? (
            <div className="relative">
              <img src={cardPreview} alt="Cartao de visita" className="w-full max-h-64 object-contain rounded-lg border border-purple-700/30 bg-[#2a1245]" />
              <button
                type="button"
                onClick={() => {
                  setCardFile(null);
                  setCardPreview(null);
                  setCardB64(null);
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full text-white hover:bg-black"
                aria-label="Remover foto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {scanLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <div className="bg-cyan-500/90 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Lendo cartao...
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => cardInputRef.current?.click()}
              className="w-full py-4 min-h-[64px] bg-[#2a1245] border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/60 text-cyan-300 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Tirar foto do cartao
            </button>
          )}

          <input
            ref={cardInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleCardFile(e.target.files?.[0] || null)}
          />

          {scanError && (
            <div className="mt-2 p-2 rounded-lg bg-red-500/15 text-red-400 text-xs border border-red-500/20">
              {scanError}
            </div>
          )}
        </div>

        {/* Campos do contato */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-purple-200/80 mb-1">Nome *</label>
            <input
              type="text"
              value={form.contact_name}
              onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
              className={inputClass}
              placeholder="Nome da pessoa"
              required
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-purple-200/80 mb-1">Empresa</label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              className={inputClass}
              placeholder="Nome da empresa (opcional)"
              autoComplete="organization"
            />
          </div>

          {usesAssociation && (
            <AssociacaoComboboxCheckin
              value={form.associacao}
              onChange={(v) => setForm((f) => ({ ...f, associacao: v }))}
              associations={associacoes}
              inputClass={inputClass}
            />
          )}

          <div>
            <label className="block text-xs font-semibold text-purple-200/80 mb-1">Cargo</label>
            <input
              type="text"
              value={form.contact_role}
              onChange={(e) => setForm((f) => ({ ...f, contact_role: e.target.value }))}
              className={inputClass}
              placeholder="Cargo (opcional)"
              autoComplete="organization-title"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-purple-200/80 mb-1">Telefone *</label>
              <input
                type="tel"
                value={form.contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                className={inputClass}
                placeholder="(11) 99999-9999"
                inputMode="tel"
                autoComplete="tel"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-purple-200/80 mb-1">Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                className={inputClass}
                placeholder="email@empresa.com"
                inputMode="email"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-purple-200/80 mb-1">Tipo de prospect</label>
            <div className="grid grid-cols-3 gap-2">
              {(['COMPRADOR', 'FORNECEDOR', 'AMBOS'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, prospect_type: t }))}
                  className={`py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                    form.prospect_type === t
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-[#2a1245] text-purple-300/60 border border-purple-700/30 hover:border-purple-600/50'
                  }`}
                >
                  {t === 'COMPRADOR' ? 'Comprador' : t === 'FORNECEDOR' ? 'Fornecedor' : 'Ambos'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-purple-200/80 mb-1">
              Observacoes <span className="text-purple-300/40">(onde encontrou, contexto, etc)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={inputClass}
              rows={3}
              placeholder="Ex: conheci na fila do cafe, interessado em trator XYZ..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 min-h-[56px] bg-cyan-500 text-white rounded-xl font-bold text-base hover:bg-cyan-600 active:bg-cyan-700 active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg shadow-cyan-900/30"
        >
          {loading ? 'Finalizando...' : '✓ Finalizar cadastro'}
        </button>
      </form>
    </div>
  );
}

// --- Contatos Tab ---
// Lista todos os contatos deste evento (stand + walk-in) inline.
// Mostra nome, empresa, telefone/email, tipo (Stand/Avulso), vendedor, quando criado.
// Clicar na linha abre o contato em nova aba.
function ContatosTab({ eventId }: { eventId: string }) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/contacts?event_id=${eventId}&limit=500`);
        if (res.ok) {
          const data = await res.json();
          if (!abort) setContacts(data.contacts || data || []);
        }
      } catch { /* silent */ }
      finally { if (!abort) setLoading(false); }
    })();
    return () => { abort = true; };
  }, [eventId]);

  const filtered = contacts.filter((c) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(s) ||
      (c.company || '').toLowerCase().includes(s) ||
      (c.email || '').toLowerCase().includes(s) ||
      (c.phone || '').toLowerCase().includes(s)
    );
  });

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const isAvulso = (c: any) => (c.notes || '').trim().startsWith('[Avulso]');

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-[#1e0f35] rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white">
          Contatos da feira
          <span className="ml-2 text-sm text-purple-300/60 font-normal">({filtered.length})</span>
        </h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, empresa, telefone..."
          className="flex-1 max-w-sm px-3 py-2 text-sm bg-[#1e0f35] border border-purple-700/30 rounded-lg text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-12 text-center">
          <p className="text-purple-300/60 text-sm">
            {contacts.length === 0
              ? 'Ainda nao ha contatos registrados nesta feira. Faca um check-in ou walk-in.'
              : 'Nenhum contato encontrado pra essa busca.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 overflow-hidden">
          <div className="divide-y divide-purple-800/20">
            {filtered.map((c) => {
              return (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center gap-4 p-4 hover:bg-purple-800/20 transition-colors"
              >
                <ContactAvatar name={c.name} avatarUrl={c.avatar_url} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-semibold truncate">{c.name}</p>
                    {isAvulso(c) ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        AVULSO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        STAND
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-purple-300/60">
                    {c.company && <span>{c.company}</span>}
                    {c.phone && <span>📞 {c.phone}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                  </div>
                </div>
                <div className="text-right text-[11px] text-purple-300/40 hidden sm:block">
                  {formatDate(c.created_at)}
                </div>
                <svg className="w-4 h-4 text-purple-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Timeline Tab ---
function TimelineTab({ eventId }: { eventId: string }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchVisits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/events/${eventId}/check-in`);
      if (res.ok) {
        const d = await res.json();
        setVisits(d.visits || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const handleDeleteVisit = async (visitId: string, companyName: string) => {
    if (!confirm(`Deletar visita em "${companyName}"?`)) return;
    setDeleting(visitId);
    try {
      const res = await fetch(`/api/events/${eventId}/check-in/${visitId}`, { method: 'DELETE' });
      if (res.ok) fetchVisits();
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-[#1e0f35] rounded-xl" />)}
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="text-center py-12 bg-[#1e0f35] rounded-xl border border-purple-800/30">
        <p className="text-purple-300/50 text-sm">Nenhuma visita registrada ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visits.map((visit: any) => (
        <div key={visit.id} className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-white font-semibold">{visit.event_booths?.company_name || 'Stand'}</p>
              <div className="flex items-center gap-3 text-xs text-purple-300/40 mt-0.5">
                <span>por {visit.user_name}</span>
                <span>{new Date(visit.visited_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                {visit.event_booths?.booth_number && <span>Stand {visit.event_booths.booth_number}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PROSPECT_TYPE_COLORS[visit.prospect_type] || 'bg-neutral-500/20 text-neutral-400'}`}>
                {PROSPECT_TYPE_LABELS[visit.prospect_type] || visit.prospect_type}
              </span>
              <button
                onClick={() => handleDeleteVisit(visit.id, visit.event_booths?.company_name || 'Stand')}
                disabled={deleting === visit.id}
                className="p-1.5 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                title="Deletar visita"
              >
                {deleting === visit.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Contact info */}
          {visit.contact_name && (
            <p className="text-sm text-purple-200/70 mb-2">
              Contato: <span className="text-white">{visit.contact_name}</span>
              {visit.contact_role && <span className="text-purple-300/40"> — {visit.contact_role}</span>}
            </p>
          )}

          {visit.notes && (
            <p className="text-sm text-purple-300/50 mb-3">{visit.notes}</p>
          )}

          {/* Photos */}
          {(visit.photo_facade_url || visit.photo_contact_url) && (
            <div className="flex gap-3 mt-2">
              {visit.photo_facade_url && (
                <a href={visit.photo_facade_url} target="_blank" rel="noopener noreferrer" className="block w-24 h-18 rounded-lg overflow-hidden border border-purple-700/30 hover:border-emerald-500/30 transition-colors">
                  <img src={visit.photo_facade_url} alt="Fachada" className="w-full h-full object-cover" />
                </a>
              )}
              {visit.photo_contact_url && (
                <a href={visit.photo_contact_url} target="_blank" rel="noopener noreferrer" className="block w-24 h-18 rounded-lg overflow-hidden border border-purple-700/30 hover:border-emerald-500/30 transition-colors">
                  <img src={visit.photo_contact_url} alt="Contato" className="w-full h-full object-cover" />
                </a>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// Follow-up pós-evento
// ============================================

function FollowUpTab({ eventId, event }: { eventId: string; event: FairEvent }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'buyers' | 'no_contact'>('buyers');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creatingFollowUpId, setCreatingFollowUpId] = useState<string | null>(null);
  const [followUpCreated, setFollowUpCreated] = useState<Set<string>>(new Set());
  const [templateOpen, setTemplateOpen] = useState(false);
  const [template, setTemplate] = useState(
    `Olá {{nome}}! Aqui é {{vendedor}} da Controlei. Foi um prazer conversar com você no {{evento}}. Gostaria de retomar nossa conversa sobre {{empresa}} e ver como podemos avançar. Tem 5 min essa semana?`
  );

  const fetchVisits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/events/${eventId}/check-in`);
      if (res.ok) {
        const d = await res.json();
        setVisits(d.visits || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const filteredVisits = visits.filter((v) => {
    if (filter === 'buyers') {
      return v.prospect_type === 'COMPRADOR' || v.prospect_type === 'AMBOS';
    }
    if (filter === 'no_contact') {
      return !v.contact_id;
    }
    return true;
  });

  const buyersCount = visits.filter((v) => v.prospect_type === 'COMPRADOR' || v.prospect_type === 'AMBOS').length;
  const noContactCount = visits.filter((v) => !v.contact_id).length;

  // Helper: extrair telefone das notes (quando foi escaneado do cartão)
  const extractPhoneFromNotes = (notes?: string | null): string | null => {
    if (!notes) return null;
    // Formato salvo pelo scan-card: "Telefone: +55 11 99999-9999"
    const m = notes.match(/Telefone:\s*([^\n\r]+)/i);
    if (m && m[1]) return m[1].trim();
    // Fallback: qualquer sequência com dígitos suficientes
    const m2 = notes.match(/(\+?\d[\d\s().-]{8,}\d)/);
    return m2 ? m2[1] : null;
  };

  const buildMessage = (visit: any, contactNameFallback?: string) =>
    template
      .replace(/\{\{nome\}\}/g, visit.contact_name || contactNameFallback || 'você')
      .replace(/\{\{vendedor\}\}/g, visit.user_name || '')
      .replace(/\{\{evento\}\}/g, event.name || '')
      .replace(/\{\{empresa\}\}/g, visit.event_booths?.company_name || '');

  const handleOpenWhatsApp = async (visit: any) => {
    let phone: string | null = null;
    let contactName: string | null = null;

    // 1. Tenta buscar telefone do contato ligado
    if (visit.contact_id) {
      try {
        const res = await fetch(`/api/contacts/${visit.contact_id}`);
        if (res.ok) {
          const d = await res.json();
          phone = d?.contact?.phone_normalized || d?.contact?.phone || null;
          contactName = d?.contact?.name || null;
        }
      } catch {
        // silent
      }
    }

    // 2. Fallback: extrair das notes (escaneado via cartão)
    if (!phone) {
      phone = extractPhoneFromNotes(visit.notes);
    }

    if (!phone) {
      alert('Sem telefone disponível para este contato. Edite o contato e adicione um número, ou escaneie o cartão de visita no check-in.');
      return;
    }

    // Limpa para formato internacional
    let cleanPhone = phone.replace(/\D/g, '');
    // Se não começar com código de país, assume Brasil (55)
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = '55' + cleanPhone;
    }

    const message = buildMessage(visit, contactName || undefined);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyMessage = (visit: any) => {
    const message = template
      .replace(/\{\{nome\}\}/g, visit.contact_name || 'você')
      .replace(/\{\{vendedor\}\}/g, visit.user_name || '')
      .replace(/\{\{evento\}\}/g, event.name || '')
      .replace(/\{\{empresa\}\}/g, visit.event_booths?.company_name || '');
    navigator.clipboard?.writeText(message);
    setCopiedId(visit.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Garante que a visita tenha um contato vinculado; se não tiver, cria
  // via auto_create no endpoint de check-in (usa nome do stand se necessário)
  const ensureContactForVisit = async (visit: any): Promise<string | null> => {
    if (visit.contact_id) return visit.contact_id;
    try {
      const res = await fetch(`/api/events/${eventId}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booth_id: visit.booth_id,
          auto_create: true,
          mark_visited: false,
          prospect_type: visit.prospect_type || 'COMPRADOR',
        }),
      });
      if (!res.ok) return null;
      const d = await res.json();
      const newId = d?.contact?.id || null;
      if (newId) {
        setVisits((prev) => prev.map((v) => (v.id === visit.id ? { ...v, contact_id: newId } : v)));
      }
      return newId;
    } catch {
      return null;
    }
  };

  const handleCreateFollowUp = async (visit: any) => {
    setCreatingFollowUpId(visit.id);
    try {
      let contactId: string | null = visit.contact_id || null;
      if (!contactId) {
        contactId = await ensureContactForVisit(visit);
      }
      if (!contactId) {
        alert('Não foi possível criar/encontrar um contato para esta visita. Verifique se o evento tem pipeline configurado.');
        return;
      }
      const payload = {
        contact_id: contactId,
        type: 'FOLLOW_UP',
        outcome: 'AGUARDANDO_RETORNO',
        note: `Follow-up iniciado a partir do evento ${event.name}${visit.event_booths?.company_name ? ` · ${visit.event_booths.company_name}` : ''}${visit.notes ? `\n\nNotas da visita: ${visit.notes}` : ''}`,
        happened_at: new Date().toISOString(),
      };
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setFollowUpCreated((prev) => new Set(prev).add(visit.id));
      } else {
        const err = await res.json();
        alert(`Erro ao criar follow-up: ${err.error || 'desconhecido'}`);
      }
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setCreatingFollowUpId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-[#1e0f35] rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com stats + template */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Follow-up pós-evento</h3>
            <p className="text-xs text-purple-300/60">
              Transforme visitas em deals e envie mensagens de acompanhamento via WhatsApp.
            </p>
          </div>
          <button
            onClick={() => setTemplateOpen(!templateOpen)}
            className="px-3 py-1.5 bg-purple-800/30 text-purple-200 border border-purple-700/30 rounded-lg text-xs font-medium hover:bg-purple-800/50"
          >
            {templateOpen ? 'Fechar template' : 'Editar template WhatsApp'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-purple-300/50 font-bold">Total visitas</p>
            <p className="text-2xl font-bold text-white">{visits.length}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-purple-300/50 font-bold">Compradores</p>
            <p className="text-2xl font-bold text-emerald-400">{buyersCount}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-purple-300/50 font-bold">Sem contato</p>
            <p className="text-2xl font-bold text-amber-400">{noContactCount}</p>
          </div>
        </div>

        {/* Template editor */}
        {templateOpen && (
          <div className="mt-3 p-3 bg-[#2a1245] rounded-lg border border-purple-700/30">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-purple-300/60 mb-1">
              Template de mensagem · Variáveis: {'{{nome}} {{vendedor}} {{evento}} {{empresa}}'}
            </label>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={4}
              className="w-full bg-[#1e0f35] border border-purple-700/30 rounded-lg px-3 py-2 text-sm text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-1 bg-purple-900/20 rounded-lg p-1 inline-flex">
        {([
          { key: 'buyers', label: `Compradores (${buyersCount})` },
          { key: 'all', label: `Todos (${visits.length})` },
          { key: 'no_contact', label: `Sem contato (${noContactCount})` },
        ] as { key: 'all' | 'buyers' | 'no_contact'; label: string }[]).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-purple-300/60 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filteredVisits.length === 0 ? (
        <div className="text-center py-12 bg-[#1e0f35] rounded-xl border border-purple-800/30">
          <p className="text-purple-300/50 text-sm">Nenhuma visita neste filtro</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVisits.map((visit) => {
            const isBuyer = visit.prospect_type === 'COMPRADOR' || visit.prospect_type === 'AMBOS';
            const isCreating = creatingFollowUpId === visit.id;
            const wasCreated = followUpCreated.has(visit.id);
            return (
              <div key={visit.id} className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4">
                <div className="flex items-start gap-3">
                  {/* Foto da fachada ou avatar */}
                  {visit.photo_facade_url ? (
                    <img
                      src={visit.photo_facade_url}
                      alt={visit.event_booths?.company_name}
                      className="w-16 h-16 rounded-lg object-cover shrink-0 border border-purple-700/30"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-700/40 to-purple-900/40 flex items-center justify-center shrink-0 border border-purple-700/30">
                      <span className="text-lg font-bold text-purple-300/60">
                        {(visit.event_booths?.company_name || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start gap-2 mb-1">
                      <h4 className="text-sm font-bold text-white">
                        {visit.event_booths?.company_name || 'Stand'}
                      </h4>
                      {isBuyer && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          COMPRADOR
                        </span>
                      )}
                      {!visit.contact_id && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          SEM CONTATO
                        </span>
                      )}
                    </div>
                    {visit.contact_name && (
                      <p className="text-xs text-purple-200/70 mb-1">
                        {visit.contact_name}
                        {visit.contact_role && <span className="text-purple-300/40"> — {visit.contact_role}</span>}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-purple-300/40">
                      <span>{visit.user_name}</span>
                      <span>·</span>
                      <span>{new Date(visit.visited_at).toLocaleDateString('pt-BR')}</span>
                      {visit.event_booths?.booth_number && (
                        <>
                          <span>·</span>
                          <span>Stand {visit.event_booths.booth_number}</span>
                        </>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => handleCreateFollowUp(visit)}
                        disabled={isCreating || wasCreated}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                          wasCreated
                            ? 'bg-emerald-500/30 text-emerald-200 cursor-not-allowed'
                            : isCreating
                            ? 'bg-emerald-500/10 text-emerald-300 cursor-wait'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        }`}
                        title={!visit.contact_id ? 'Criará um contato automaticamente e registrará o follow-up' : 'Registrar follow-up no contato'}
                      >
                        {wasCreated ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                            Follow-up registrado
                          </>
                        ) : isCreating ? (
                          'Registrando...'
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Iniciar follow-up
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleOpenWhatsApp(visit)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-600/30"
                        title="Abrir conversa no WhatsApp"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                        </svg>
                        WhatsApp
                      </button>

                      <button
                        onClick={() => handleCopyMessage(visit)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-800/30 text-purple-200 hover:bg-purple-800/50 flex items-center gap-1.5"
                        title="Copiar mensagem personalizada"
                      >
                        {copiedId === visit.id ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                            Copiado
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Copiar msg
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// Mapa Oficial (iframe externo: Zapt, MapYourShow, ExpoFP, etc)
// ============================================

function ExternalMapTab({ url, eventName }: { url: string; eventName: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-purple-300/60">
          Mapa oficial da feira embedado. Pra marcar visitas, use a aba "Stands".
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2a1245] text-purple-200 hover:bg-[#3a1e55] border border-purple-700/30 transition-colors shrink-0"
        >
          Abrir em nova aba
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
      <div className="rounded-xl overflow-hidden border border-purple-800/30 bg-[#1e0f35]" style={{ height: 'calc(100vh - 240px)', minHeight: 500 }}>
        <iframe
          src={url}
          title={`Mapa oficial — ${eventName}`}
          className="w-full h-full border-0"
          allow="geolocation; fullscreen"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}

// ============================================
// Mapa Interativo do Evento
// ============================================

type MapFilter = 'all' | 'pending' | 'visited';

function MapTab({
  eventId,
  event,
  isAdmin,
  onEventUpdated,
  onOpenStand,
}: {
  eventId: string;
  event: FairEvent;
  isAdmin: boolean;
  onEventUpdated: () => void;
  onOpenStand: (boothId: string) => void;
}) {
  const [booths, setBooths] = useState<EventBooth[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MapFilter>('all');
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedBooth, setSelectedBooth] = useState<EventBooth | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [highlightBoothId, setHighlightBoothId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; company: string; visitor?: string | null; contact?: string | null } | null>(null);
  const mapFileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    skipped: number;
    errors: number;
    total_rows?: number;
    rejected_sample?: Array<{ row_number: number; reason: string; preview: string }>;
  } | null>(null);
  const [showRejectedDetails, setShowRejectedDetails] = useState(false);

  // Live presence
  const [livePresence, setLivePresence] = useState<{
    recent_booth_ids: Record<string, { user_name: string; visited_at: string }>;
    active_now: Array<{ user_id: string; user_name: string; last_active: string }>;
    visits_last_1h: number;
  }>({ recent_booth_ids: {}, active_now: [], visits_last_1h: 0 });

  const fetchBooths = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/events/${eventId}/booths`);
      if (res.ok) {
        const data = await res.json();
        setBooths(data.booths || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchBooths(); }, [fetchBooths]);

  // Live presence polling (a cada 15s)
  useEffect(() => {
    let cancelled = false;
    const fetchLive = async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/live`, { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (cancelled) return;
        setLivePresence({
          recent_booth_ids: json.recent_booth_ids || {},
          active_now: json.active_now || [],
          visits_last_1h: json.summary?.visits_last_1h || 0,
        });
        // Quando uma nova visita entra, refetch booths pra refletir no mapa
        const newBoothIds = Object.keys(json.recent_booth_ids || {});
        if (newBoothIds.length > 0) {
          fetchBooths();
        }
      } catch {
        // silent
      }
    };
    fetchLive();
    const interval = setInterval(fetchLive, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [eventId, fetchBooths]);

  const recentBoothIdSet = new Set(Object.keys(livePresence.recent_booth_ids));

  // Stats
  const total = booths.length;
  const visited = booths.filter((b) => b.status === 'VISITADO').length;
  const pending = total - visited;
  const progressPct = total > 0 ? Math.round((visited / total) * 100) : 0;

  const normSearch = searchTerm.trim().toLowerCase();
  const filteredBooths = booths.filter((b) => {
    if (filter === 'visited' && b.status !== 'VISITADO') return false;
    if (filter === 'pending' && b.status === 'VISITADO') return false;
    if (sectorFilter && (b.sector || 'Sem setor') !== sectorFilter) return false;
    if (normSearch) {
      const hay = `${b.company_name || ''} ${b.booth_number || ''} ${b.sector || ''}`.toLowerCase();
      if (!hay.includes(normSearch)) return false;
    }
    return true;
  });

  // Lista de setores únicos (para filtro por setor)
  const allSectors = Array.from(
    new Set(booths.map((b) => b.sector || 'Sem setor'))
  ).sort((a, b) => naturalCompare(a, b));

  // Primeira correspondência da busca (para auto-scroll/highlight)
  const searchMatch = normSearch ? filteredBooths[0] : null;

  // Auto-scroll até o stand quando há highlight
  useEffect(() => {
    if (!highlightBoothId) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`booth-card-${highlightBoothId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    const clear = setTimeout(() => setHighlightBoothId(null), 4500);
    return () => { clearTimeout(t); clearTimeout(clear); };
  }, [highlightBoothId]);

  // Auto-scroll até primeira correspondência da busca
  useEffect(() => {
    if (!searchMatch) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`booth-card-${searchMatch.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    return () => clearTimeout(t);
  }, [searchMatch?.id]);

  // Encontra próximo pendente a partir da ordem natural
  const nextPending = (() => {
    const pendingList = [...booths]
      .filter((b) => b.status !== 'VISITADO')
      .sort((a, b) => {
        const sa = a.sector || '';
        const sb = b.sector || '';
        if (sa !== sb) return naturalCompare(sa, sb);
        return naturalCompare(a.booth_number || '', b.booth_number || '');
      });
    return pendingList[0] || null;
  })();

  const handleGoToNextPending = () => {
    if (!nextPending) return;
    setSearchTerm('');
    setSectorFilter(null);
    setFilter('all');
    setHighlightBoothId(nextPending.id);
  };

  const handleImportCSV = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    setShowRejectedDetails(false);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/events/${eventId}/booths/import`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult({
          created: data.created || 0,
          skipped: data.skipped || 0,
          errors: data.errors || 0,
          total_rows: data.total_rows,
          rejected_sample: data.rejected_sample || [],
        });
        fetchBooths();
      } else {
        setImportResult({ created: 0, skipped: 0, errors: 1 });
      }
    } catch {
      setImportResult({ created: 0, skipped: 0, errors: 1 });
    } finally {
      setImporting(false);
      // Auto-dismiss só quando não há rejeições (se tiver, o usuário precisa ler com calma)
      setTimeout(() => {
        setImportResult((prev) => {
          if (prev && (prev.errors > 0 || prev.skipped > 0)) return prev;
          return null;
        });
      }, 6000);
    }
  };

  const updateBoothPosition = useCallback(
    async (boothId: string, position_x: number | null, position_y: number | null) => {
      // Optimistic update
      setBooths((prev) =>
        prev.map((b) => (b.id === boothId ? { ...b, position_x, position_y } : b))
      );
      try {
        const res = await fetch(`/api/events/${eventId}/booths/${boothId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position_x, position_y }),
        });
        if (!res.ok) {
          // Refetch on failure to revert
          fetchBooths();
        }
      } catch {
        fetchBooths();
      }
    },
    [eventId, fetchBooths]
  );

  const handleUploadMap = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('map_image', file);
      const res = await fetch(`/api/events/${eventId}`, { method: 'PUT', body: formData });
      if (res.ok) {
        onEventUpdated();
      }
    } catch {
      // silent
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveMap = async () => {
    if (!confirm('Remover a planta deste evento? As posições dos stands ficam salvas.')) return;
    setUploading(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map_image_remove: true }),
      });
      if (res.ok) {
        setEditMode(false);
        onEventUpdated();
      }
    } catch {
      // silent
    } finally {
      setUploading(false);
    }
  };

  const mapUrl = event.map_url;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-[#1e0f35] rounded-xl" />
        <div className="h-64 bg-[#1e0f35] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats header */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-purple-300/50 font-bold">Total</p>
            <p className="text-2xl font-bold text-white">{total}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-purple-300/50 font-bold">Visitados</p>
            <p className="text-2xl font-bold text-emerald-400">{visited}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-purple-300/50 font-bold">Pendentes</p>
            <p className="text-2xl font-bold text-amber-400">{pending}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-purple-300/50 font-bold">Progresso</p>
            <p className="text-2xl font-bold text-cyan-400">{progressPct}%</p>
          </div>
        </div>
        <div className="w-full bg-purple-900/40 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-2 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Live presence banner */}
      {livePresence.active_now.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Ao Vivo</span>
          </div>
          <div className="flex items-center -space-x-2">
            {livePresence.active_now.slice(0, 5).map((u) => (
              <div
                key={u.user_id}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 border-2 border-[#1a0a2e] flex items-center justify-center text-[10px] font-bold text-white"
                title={`${u.user_name} ativo agora`}
              >
                {(u.user_name || '?').charAt(0).toUpperCase()}
              </div>
            ))}
            {livePresence.active_now.length > 5 && (
              <div className="w-6 h-6 rounded-full bg-purple-800 border-2 border-[#1a0a2e] flex items-center justify-center text-[9px] font-bold text-white">
                +{livePresence.active_now.length - 5}
              </div>
            )}
          </div>
          <div className="text-xs text-emerald-200/80">
            <span className="font-bold text-white">{livePresence.active_now.length}</span>{' '}
            {livePresence.active_now.length === 1 ? 'pessoa ativa' : 'pessoas ativas'} ·{' '}
            <span className="font-bold text-white">{livePresence.visits_last_1h}</span> visita
            {livePresence.visits_last_1h !== 1 ? 's' : ''} na última hora
          </div>
        </div>
      )}

      {/* Barra de busca + próximo pendente + war room */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar empresa, stand ou setor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-9 py-2 bg-[#1e0f35] border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-purple-300/50 hover:text-white"
              title="Limpar busca"
            >
              ×
            </button>
          )}
          {searchTerm && filteredBooths.length > 0 && (
            <div className="absolute -bottom-5 left-0 text-[10px] text-emerald-400">
              {filteredBooths.length} resultado{filteredBooths.length > 1 ? 's' : ''}
            </div>
          )}
          {searchTerm && filteredBooths.length === 0 && (
            <div className="absolute -bottom-5 left-0 text-[10px] text-amber-400">
              Nenhum stand encontrado
            </div>
          )}
        </div>

        {nextPending && (
          <button
            onClick={handleGoToNextPending}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
            title={`Próximo pendente: ${nextPending.company_name}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Próximo pendente
          </button>
        )}

        <a
          href={`/eventos/${eventId}/war-room`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
          title="Abrir War Room (tela cheia)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          War Room
        </a>
      </div>

      {/* Filters status + por setor */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-purple-900/20 rounded-lg p-1">
            {(['all', 'pending', 'visited'] as MapFilter[]).map((f) => {
              const count = f === 'all' ? total : f === 'visited' ? visited : pending;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-purple-300/60 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : 'Visitados'}
                  <span className="ml-1.5 opacity-60">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Filtro por setor (aparece quando clicado) */}
          {sectorFilter && (
            <button
              onClick={() => setSectorFilter(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-medium hover:bg-cyan-500/30"
              title="Remover filtro de setor"
            >
              <span>Setor: {sectorFilter}</span>
              <span className="text-base leading-none">×</span>
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {mapUrl && (
              <button
                onClick={() => setEditMode((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  editMode
                    ? 'bg-emerald-500 text-white'
                    : 'bg-purple-800/30 text-purple-200/80 hover:bg-purple-800/50'
                }`}
              >
                {editMode ? 'Sair do modo edição' : 'Posicionar stands'}
              </button>
            )}
            <input
              ref={mapFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadMap(file);
                if (mapFileInputRef.current) mapFileInputRef.current.value = '';
              }}
            />
            <input
              ref={importFileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportCSV(file);
                if (importFileInputRef.current) importFileInputRef.current.value = '';
              }}
            />
            <button
              onClick={() => importFileInputRef.current?.click()}
              disabled={importing}
              className="px-3 py-1.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded-lg text-xs font-medium hover:bg-cyan-500/20 disabled:opacity-50"
              title="Importar lista de expositores via CSV/XLSX"
            >
              {importing ? 'Importando...' : 'Importar CSV'}
            </button>
            <button
              onClick={() => mapFileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 bg-purple-800/30 text-purple-200/80 border border-purple-700/30 rounded-lg text-xs font-medium hover:bg-purple-800/50 disabled:opacity-50"
            >
              {uploading ? 'Enviando...' : mapUrl ? 'Trocar planta' : 'Enviar planta baixa'}
            </button>
            {mapUrl && (
              <button
                onClick={handleRemoveMap}
                disabled={uploading}
                className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium hover:bg-red-500/20 disabled:opacity-50"
              >
                Remover planta
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chips de setores (navegação rápida) */}
      {allSectors.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {allSectors.map((s) => {
            const sectorBooths = booths.filter((b) => (b.sector || 'Sem setor') === s);
            const sectorVisited = sectorBooths.filter((b) => b.status === 'VISITADO').length;
            const isActive = sectorFilter === s;
            return (
              <button
                key={s}
                onClick={() => setSectorFilter(isActive ? null : s)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                  isActive
                    ? 'bg-cyan-500/30 border-cyan-400 text-cyan-100'
                    : 'bg-[#1e0f35] border-purple-800/30 text-purple-300/70 hover:border-cyan-500/40 hover:text-cyan-300'
                }`}
              >
                {s}
                <span className="ml-1.5 opacity-60">{sectorVisited}/{sectorBooths.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Feedback de import — detalhado com lista de rejeições */}
      {importResult && (
        <div className={`rounded-lg border ${
          importResult.errors > 0 && importResult.created === 0
            ? 'bg-red-500/10 border-red-500/30 text-red-300'
            : importResult.skipped > 0 || importResult.errors > 0
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        }`}>
          <div className="p-3 flex items-start justify-between gap-3">
            <div className="flex-1 text-sm">
              <div className="font-semibold mb-0.5">
                {importResult.created > 0 ? '✓ ' : '⚠️ '}
                Import concluído
                {importResult.total_rows != null && (
                  <span className="font-normal opacity-70"> · {importResult.total_rows} linha(s) lidas</span>
                )}
              </div>
              <div className="text-xs opacity-90">
                <strong>{importResult.created}</strong> stands criados
                {importResult.skipped > 0 && <> · <strong>{importResult.skipped}</strong> duplicados ignorados</>}
                {importResult.errors > 0 && <> · <strong>{importResult.errors}</strong> com erro</>}
              </div>
            </div>
            {importResult.rejected_sample && importResult.rejected_sample.length > 0 && (
              <button
                onClick={() => setShowRejectedDetails((v) => !v)}
                className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-md bg-white/10 hover:bg-white/15 transition-colors"
              >
                {showRejectedDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
              </button>
            )}
            <button
              onClick={() => setImportResult(null)}
              className="shrink-0 p-1 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Fechar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {showRejectedDetails && importResult.rejected_sample && importResult.rejected_sample.length > 0 && (
            <div className="border-t border-current/20 px-3 py-2 text-xs">
              <div className="mb-1.5 opacity-70">Linhas não importadas (até 20):</div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {importResult.rejected_sample.map((r, i) => (
                  <div key={i} className="flex items-baseline gap-2 font-mono text-[11px]">
                    <span className="shrink-0 opacity-60">
                      {r.row_number > 0 ? `Linha ${r.row_number}:` : '—'}
                    </span>
                    <span className="shrink-0 font-semibold">{r.reason}</span>
                    <span className="opacity-60 truncate">{r.preview}</span>
                  </div>
                ))}
              </div>
              {((importResult.skipped + importResult.errors) > importResult.rejected_sample.length) && (
                <div className="mt-2 opacity-60 italic">
                  ... e mais {(importResult.skipped + importResult.errors) - importResult.rejected_sample.length} linha(s) não mostradas
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main view */}
      {booths.length === 0 ? (
        <div className="text-center py-16 bg-[#1e0f35] rounded-xl border border-purple-800/30">
          <p className="text-purple-300/50 text-sm">Nenhum stand cadastrado neste evento</p>
        </div>
      ) : mapUrl ? (
        <MapImageView
          mapUrl={mapUrl}
          booths={filteredBooths}
          allBooths={booths}
          editMode={editMode && isAdmin}
          highlightBoothId={highlightBoothId}
          recentBoothIds={recentBoothIdSet}
          onBoothClick={(b) => setSelectedBooth(b)}
          onUpdatePosition={updateBoothPosition}
        />
      ) : (
        <CorridorView
          booths={filteredBooths}
          highlightBoothId={highlightBoothId}
          recentBoothIds={recentBoothIdSet}
          onBoothClick={(b) => setSelectedBooth(b)}
          onOpenLightbox={(b) => {
            if (b.visit?.photo_facade_url) {
              setLightbox({
                url: b.visit.photo_facade_url,
                company: b.company_name,
                visitor: b.visit.user_name,
                contact: b.visit.contact_name,
              });
            }
          }}
          onSectorClick={(sector) => setSectorFilter(sector === sectorFilter ? null : sector)}
        />
      )}

      {/* Lightbox de foto */}
      {lightbox && (
        <PhotoLightbox
          url={lightbox.url}
          company={lightbox.company}
          visitor={lightbox.visitor}
          contact={lightbox.contact}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Popover */}
      {selectedBooth && (
        <BoothPopover
          booth={selectedBooth}
          editMode={editMode && isAdmin && !!mapUrl}
          onClose={() => setSelectedBooth(null)}
          onOpenStand={() => {
            const id = selectedBooth.id;
            setHighlightBoothId(id);
            setSelectedBooth(null);
            onOpenStand(id);
          }}
          onOpenLightbox={() => {
            if (selectedBooth?.visit?.photo_facade_url) {
              setLightbox({
                url: selectedBooth.visit.photo_facade_url,
                company: selectedBooth.company_name,
                visitor: selectedBooth.visit.user_name,
                contact: selectedBooth.visit.contact_name,
              });
            }
          }}
          onRemovePosition={async () => {
            await updateBoothPosition(selectedBooth.id, null, null);
            setSelectedBooth(null);
          }}
        />
      )}
    </div>
  );
}

// --- Lightbox de foto do stand ---
function PhotoLightbox({
  url,
  company,
  visitor,
  contact,
  onClose,
}: {
  url: string;
  company: string;
  visitor?: string | null;
  contact?: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl font-light"
        aria-label="Fechar"
      >
        ×
      </button>
      <div
        className="relative max-w-5xl max-h-[90vh] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={company}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
        <div className="bg-[#1e0f35]/90 backdrop-blur-sm border border-purple-700/30 rounded-lg p-4">
          <h3 className="text-lg font-bold text-white">{company}</h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-purple-200/70">
            {visitor && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Visitado por <strong className="text-emerald-400">{visitor}</strong>
              </span>
            )}
            {contact && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Contato: <strong className="text-white">{contact}</strong>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Natural sort helper ---
const boothCollator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
const naturalCompare = (a: string, b: string) => boothCollator.compare(a, b);

// --- Corridor View (auto-grid, sem imagem) ---
function CorridorView({
  booths,
  highlightBoothId,
  recentBoothIds,
  onBoothClick,
  onOpenLightbox: _onOpenLightbox,
  onSectorClick,
}: {
  booths: EventBooth[];
  highlightBoothId?: string | null;
  recentBoothIds?: Set<string>;
  onBoothClick: (b: EventBooth) => void;
  onOpenLightbox?: (b: EventBooth) => void;
  onSectorClick?: (sector: string) => void;
}) {
  // Agrupa por corredor fisico do mapa (prefixo alfabetico do booth_number:
  // A, B, C, D, E, F, G, H, PC, HUB, Rua5 ...) em vez de por tipo de expositor.
  // Isso respeita a sequencia real do mapa oficial.
  function extractCorredor(boothNumber: string | null): string {
    if (!boothNumber) return 'Sem corredor';
    const m = boothNumber.match(/^([A-Za-z]+)/);
    return m ? m[1].toUpperCase() : boothNumber;
  }

  const byCorredor: Record<string, EventBooth[]> = {};
  booths.forEach((b) => {
    const key = extractCorredor(b.booth_number);
    if (!byCorredor[key]) byCorredor[key] = [];
    byCorredor[key].push(b);
  });
  Object.values(byCorredor).forEach((list) =>
    list.sort((a, b) => naturalCompare(a.booth_number || '', b.booth_number || ''))
  );

  // Ordem dos corredores: alfabetica natural (A, B, C... HUB, PC, Rua5, Sem corredor)
  const corredorKeys = Object.keys(byCorredor).sort((a, b) => {
    if (a === 'Sem corredor') return 1;
    if (b === 'Sem corredor') return -1;
    return naturalCompare(a, b);
  });

  if (corredorKeys.length === 0) {
    return (
      <div className="text-center py-12 bg-[#1e0f35] rounded-xl border border-purple-800/30">
        <p className="text-purple-300/50 text-sm">Nenhum stand no filtro atual</p>
      </div>
    );
  }

  // Estatisticas globais
  const totalBooths = booths.length;
  const totalVisited = booths.filter((b) => b.status === 'VISITADO').length;
  const globalPct = totalBooths > 0 ? Math.round((totalVisited / totalBooths) * 100) : 0;

  return (
    <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-3 sm:p-5 space-y-3 sm:space-y-4">
      {/* Header com stats globais */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-purple-800/30">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest truncate">Stands por Corredor</h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
          <span><span className="text-purple-300/60">Total:</span> <span className="font-bold text-white">{totalBooths}</span></span>
          <span className="text-purple-700/40 hidden sm:inline">·</span>
          <span><span className="text-purple-300/60">Visitados:</span> <span className="font-bold text-emerald-400">{totalVisited}</span></span>
          <span className="text-purple-700/40 hidden sm:inline">·</span>
          <span><span className="text-purple-300/60">Cobertura:</span> <span className={`font-bold ${globalPct >= 80 ? 'text-emerald-400' : globalPct >= 50 ? 'text-amber-400' : 'text-purple-300'}`}>{globalPct}%</span></span>
        </div>
      </div>

      {/* Lista de corredores (um por linha, horizontal) */}
      <div className="space-y-4">
        {corredorKeys.map((corredor) => {
          const list = byCorredor[corredor];
          const visited = list.filter((b) => b.status === 'VISITADO').length;
          const pct = list.length > 0 ? Math.round((visited / list.length) * 100) : 0;

          return (
            <div key={corredor} className="border border-purple-800/30 rounded-lg bg-[#160a29]">
              {/* Cabecalho do corredor */}
              <button
                type="button"
                onClick={() => onSectorClick?.(corredor)}
                className="w-full flex items-center justify-between gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 bg-[#2a1245]/40 hover:bg-[#2a1245]/70 transition-colors rounded-t-lg border-b border-purple-800/30"
                title={`Filtrar por corredor ${corredor}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-sm font-bold shrink-0">
                    {corredor.slice(0, 3)}
                  </span>
                  <div className="text-left min-w-0 flex-1">
                    <div className="text-xs font-bold text-white uppercase tracking-wider truncate">
                      {corredor === 'Sem corredor' ? 'Sem numero' : `Corredor ${corredor}`}
                    </div>
                    <div className="text-[10px] text-purple-300/60 truncate">
                      <span className="sm:hidden">{list.length} · {visited}/{list.length} · {pct}%</span>
                      <span className="hidden sm:inline">{list.length} stands · {visited} visitados · {pct}%</span>
                    </div>
                  </div>
                </div>
                <div className="w-20 md:w-32 h-1 bg-purple-900/50 rounded-full overflow-hidden hidden sm:block shrink-0">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>

              {/* Fileira horizontal de stands (wrap quando passa da linha) */}
              <div className="flex flex-wrap gap-1.5 sm:gap-2 p-2 sm:p-3">
                {list.map((b) => {
                  const isVisited = b.status === 'VISITADO';
                  const isHighlighted = highlightBoothId === b.id;
                  const isLive = recentBoothIds?.has(b.id) ?? false;
                  const label = b.booth_number || '—';
                  const logo = b.logo_url;

                  return (
                    <button
                      key={b.id}
                      id={`booth-card-${b.id}`}
                      type="button"
                      onClick={() => onBoothClick(b)}
                      title={`${b.company_name}${b.booth_number ? ` — ${b.booth_number}` : ''}${isLive ? ' · VISITADO AGORA' : ''}${isVisited ? ' · visitado' : ' · pendente'}`}
                      className={`group relative w-[64px] h-[64px] sm:w-[72px] sm:h-[72px] md:w-[84px] md:h-[84px] rounded-lg transition-all hover:scale-110 hover:z-10 overflow-hidden flex flex-col shadow-sm ${
                        isHighlighted
                          ? 'ring-4 ring-yellow-300 scale-110 z-20 animate-pulse'
                          : isLive
                          ? 'ring-2 ring-cyan-400'
                          : isVisited
                          ? 'ring-2 ring-emerald-400 shadow-md shadow-emerald-500/25'
                          : 'ring-1 ring-purple-700/40 hover:ring-emerald-500/60'
                      }`}
                    >
                      {/* Area do logo (topo, ~64px) */}
                      <div className="flex-1 bg-white flex items-center justify-center p-1.5 overflow-hidden">
                        {logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={logo}
                            alt={b.company_name}
                            loading="lazy"
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-neutral-500 text-center line-clamp-3 leading-tight px-1">
                            {b.company_name.slice(0, 18)}
                          </span>
                        )}
                      </div>

                      {/* Rodape: codigo do stand */}
                      <div className={`text-[10px] font-bold py-0.5 px-1 text-center truncate ${
                        isHighlighted
                          ? 'bg-yellow-400 text-black'
                          : isLive
                          ? 'bg-cyan-500 text-white'
                          : isVisited
                          ? 'bg-emerald-500 text-white'
                          : 'bg-[#2a1245] text-purple-200'
                      }`}>
                        {label}
                      </div>

                      {/* Overlay verde quando visitado (sobre o logo) */}
                      {isVisited && (
                        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-md">
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                      {isLive && !isVisited && (
                        <span className="absolute top-1 right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400 border border-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-purple-800/30 text-[10px] text-purple-300/60">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#2a1245] border border-purple-700/40" />Pendente</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" />Visitado</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cyan-500" />Visitado agora</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-400" />Destacado</span>
      </div>
    </div>
  );
}


// --- Map Image View (modo imagem) ---
function MapImageView({
  mapUrl,
  booths,
  allBooths,
  editMode,
  highlightBoothId,
  recentBoothIds,
  onBoothClick,
  onUpdatePosition,
}: {
  mapUrl: string;
  booths: EventBooth[];
  allBooths: EventBooth[];
  editMode: boolean;
  highlightBoothId?: string | null;
  recentBoothIds?: Set<string>;
  onBoothClick: (b: EventBooth) => void;
  onUpdatePosition: (boothId: string, x: number | null, y: number | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pendingBoothId, setPendingBoothId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: fine)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const placedBooths = booths.filter((b) => b.position_x != null && b.position_y != null);
  const unplacedBooths = allBooths
    .filter((b) => b.position_x == null || b.position_y == null)
    .sort((a, b) => {
      const sa = a.sector || '';
      const sb = b.sector || '';
      if (sa !== sb) return naturalCompare(sa, sb);
      return naturalCompare(a.booth_number || '', b.booth_number || '');
    });

  // Calcula coordenadas em % dado um event clientX/Y
  const getPct = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  };

  // Drag handlers (desktop)
  const handlePinPointerDown = (e: React.PointerEvent<HTMLDivElement>, booth: EventBooth) => {
    if (!editMode || !isDesktop) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDraggingId(booth.id);
  };

  const handlePinPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingId) return;
    const pct = getPct(e.clientX, e.clientY);
    if (!pct) return;
    // Atualização optimistic imediata (visual only — o commit vai via pointerUp)
    onUpdatePosition(draggingId, pct.x, pct.y);
  };

  const handlePinPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingId) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDraggingId(null);
  };

  // Click-to-place (mobile, ou desktop sem selecionar pin)
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editMode || !pendingBoothId) return;
    // Ignorar clicks em pins
    if ((e.target as HTMLElement).closest('[data-pin]')) return;
    const pct = getPct(e.clientX, e.clientY);
    if (!pct) return;
    onUpdatePosition(pendingBoothId, pct.x, pct.y);
    setPendingBoothId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
      {/* Map container */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        onPointerMove={draggingId ? handlePinPointerMove : undefined}
        onPointerUp={draggingId ? handlePinPointerUp : undefined}
        className={`relative bg-[#1e0f35] rounded-xl border border-purple-800/30 overflow-hidden select-none ${
          editMode && pendingBoothId ? 'cursor-crosshair' : ''
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mapUrl}
          alt="Planta do evento"
          className="w-full h-auto block pointer-events-none"
          draggable={false}
        />
        {/* Pins */}
        {placedBooths.map((booth) => {
          const isVisited = booth.status === 'VISITADO';
          const isDragging = draggingId === booth.id;
          const isHighlighted = highlightBoothId === booth.id;
          const isLive = recentBoothIds?.has(booth.id) ?? false;
          return (
            <div
              key={booth.id}
              id={`booth-card-${booth.id}`}
              data-pin
              onPointerDown={(e) => handlePinPointerDown(e, booth)}
              onClick={(e) => {
                e.stopPropagation();
                if (draggingId) return;
                onBoothClick(booth);
              }}
              style={{
                left: `${booth.position_x}%`,
                top: `${booth.position_y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isHighlighted || isLive ? 40 : isDragging ? 30 : 10,
                touchAction: editMode ? 'none' : undefined,
              }}
              className={`absolute w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg transition-transform hover:scale-110 border-2 ${
                isHighlighted
                  ? 'bg-yellow-400 border-yellow-200 text-black ring-4 ring-yellow-400/50 scale-125 animate-pulse'
                  : isLive
                  ? 'bg-cyan-500 border-cyan-200 text-white ring-4 ring-cyan-400/50 scale-110 animate-pulse'
                  : isVisited
                  ? 'bg-emerald-500 border-emerald-300 text-white'
                  : 'bg-purple-600 border-purple-300 text-white'
              } ${editMode && isDesktop ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
              title={`${booth.company_name}${booth.booth_number ? ` — #${booth.booth_number}` : ''}${isLive ? ' · VISITADO AGORA' : ''}`}
            >
              {booth.booth_number ? booth.booth_number.slice(0, 3) : '•'}
              {isLive && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-300 border border-white"></span>
                </span>
              )}
            </div>
          );
        })}

        {editMode && pendingBoothId && (
          <div className="absolute top-2 left-2 right-2 bg-emerald-500/90 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg pointer-events-none">
            Toque no mapa para posicionar o stand selecionado
          </div>
        )}
      </div>

      {/* Side panel — edit mode only */}
      {editMode ? (
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-3 max-h-[70vh] overflow-y-auto">
          <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">
            Stands sem posição
          </h4>
          {unplacedBooths.length === 0 ? (
            <p className="text-xs text-purple-300/40">Todos posicionados</p>
          ) : (
            <div className="space-y-1.5">
              {unplacedBooths.map((b) => {
                const isPending = pendingBoothId === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setPendingBoothId(isPending ? null : b.id)}
                    className={`w-full text-left rounded-lg p-2 border transition-colors ${
                      isPending
                        ? 'bg-emerald-500/20 border-emerald-400/60'
                        : 'bg-[#2a1245] border-purple-700/30 hover:border-emerald-500/30'
                    }`}
                  >
                    {b.booth_number && (
                      <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded mr-1">
                        #{b.booth_number}
                      </span>
                    )}
                    <span className="text-xs text-white">{b.company_name}</span>
                    {b.sector && (
                      <p className="text-[10px] text-purple-300/40 mt-0.5 truncate">{b.sector}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-purple-300/40 mt-3 leading-relaxed">
            {isDesktop
              ? 'Desktop: arraste os pins no mapa, ou toque num stand aqui e clique no mapa.'
              : 'Toque num stand desta lista e depois toque no mapa para posicionar.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-3">
          <h4 className="text-[10px] font-bold text-purple-300/60 uppercase tracking-widest mb-2">Legenda</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-emerald-300" />
              <span className="text-purple-200/70">Visitado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-purple-600 border-2 border-purple-300" />
              <span className="text-purple-200/70">Pendente</span>
            </div>
          </div>
          <p className="text-[10px] text-purple-300/40 mt-3">
            Posicionados: {placedBooths.length} · Sem posição: {unplacedBooths.length}
          </p>
        </div>
      )}
    </div>
  );
}

// --- Booth Popover ---
function BoothPopover({
  booth,
  editMode,
  onClose,
  onOpenStand,
  onOpenLightbox,
  onRemovePosition,
}: {
  booth: EventBooth;
  editMode: boolean;
  onClose: () => void;
  onOpenStand: () => void;
  onOpenLightbox?: () => void;
  onRemovePosition: () => void;
}) {
  const isVisited = booth.status === 'VISITADO';
  const visit = booth.visit;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1e0f35] rounded-xl border border-purple-800/30 w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate">{booth.company_name}</h3>
            <div className="flex items-center gap-2 text-xs text-purple-300/60 mt-0.5">
              {booth.booth_number && <span>Stand #{booth.booth_number}</span>}
              {booth.sector && <span>· {booth.sector}</span>}
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              BOOTH_STATUS_COLORS[booth.status] || 'bg-neutral-500/20 text-neutral-400'
            }`}
          >
            {isVisited ? 'Visitado' : 'Pendente'}
          </span>
        </div>

        {visit && (
          <div className="bg-[#2a1245] rounded-lg p-3 mb-4 text-xs">
            {/* Thumbnail da foto (clicável) */}
            {visit.photo_facade_url && (
              <button
                type="button"
                onClick={onOpenLightbox}
                className="w-full h-32 rounded-lg overflow-hidden mb-2 relative group cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={visit.photo_facade_url}
                  alt={booth.company_name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m-3-3h6" />
                  </svg>
                </div>
              </button>
            )}
            {visit.contact_name && (
              <p className="text-white font-medium mb-1">
                {visit.contact_name}
                {visit.contact_role && <span className="text-purple-300/60"> — {visit.contact_role}</span>}
              </p>
            )}
            <p className="text-purple-300/60">
              Visitado por <span className="text-purple-200/80">{visit.user_name}</span> em{' '}
              {new Date(visit.visited_at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={onOpenStand}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-500/20 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Abrir stand
          </button>
          {editMode && booth.position_x != null && (
            <button
              onClick={onRemovePosition}
              className="w-full py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors"
            >
              Remover posição do mapa
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-2 bg-purple-800/30 text-purple-200/80 rounded-lg text-xs font-medium hover:bg-purple-800/50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// Busca de associacao com filtro por sigla OU nome completo, ignorando acento.
// Substitui o <datalist> nativo que no celular de feira ficava travado e so
// filtrava pela sigla — agora o vendedor pode digitar "copercana" ou "acucar"
// e acha na hora.
function formatRelativeDays(isoDate: string | null | undefined): string {
  if (!isoDate) return 'sem histórico';
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return 'sem histórico';
  const diffMs = Date.now() - then;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'há 1 mês';
  if (months < 12) return `há ${months} meses`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'há 1 ano' : `há ${years} anos`;
}

function normalizeAssocSearch(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function AssociacaoComboboxCheckin({
  value,
  onChange,
  associations,
  inputClass,
}: {
  value: string;
  onChange: (v: string) => void;
  associations: Array<{ sigla: string; nome_completo: string; contacts_count?: number; last_interaction_at?: string | null }>;
  inputClass: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return associations.find((a) => a.sigla.trim().toLowerCase() === q) || null;
  }, [query, associations]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeAssocSearch(query);
    if (!q) return associations;
    return associations.filter((a) => {
      const sigla = normalizeAssocSearch(a.sigla);
      const nome = normalizeAssocSearch(a.nome_completo);
      return sigla.includes(q) || nome.includes(q);
    });
  }, [query, associations]);

  const handlePick = (sigla: string) => {
    onChange(sigla);
    setQuery(sigla);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-semibold text-purple-200/80 mb-1">
        Associação / Cooperativa
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={
          associations.length > 0
            ? `Busque por sigla ou nome (${associations.length} cadastradas)`
            : 'Ex: COPERCANA, ORPLANA, ...'
        }
        className={inputClass}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-xl border border-purple-700/40 bg-[#1e0f35] shadow-2xl shadow-black/50">
          {filtered.map((a) => {
            const count = a.contacts_count ?? 0;
            const hasContacts = count > 0;
            return (
              <button
                key={a.sigla}
                type="button"
                onClick={() => handlePick(a.sigla)}
                className="w-full text-left px-4 py-3 min-h-[56px] hover:bg-[#2a1245] active:bg-[#2a1245] border-b border-purple-800/20 last:border-b-0 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-base">{a.sigla}</div>
                  <div className="text-purple-300/70 text-xs truncate">{a.nome_completo}</div>
                </div>
                <span
                  className={
                    'shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border ' +
                    (hasContacts
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-purple-900/40 text-purple-300/60 border-purple-700/30')
                  }
                >
                  {hasContacts ? `${count} contato${count === 1 ? '' : 's'}` : 'sem contato'}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-purple-700/40 bg-[#1e0f35] px-4 py-3 text-purple-300/60 text-sm">
          Nenhuma associação encontrada — o valor digitado será usado mesmo assim.
        </div>
      )}
      {selectedMatch && (selectedMatch.contacts_count ?? 0) > 0 && (
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 px-3 py-2 text-xs">
          <div className="font-semibold">
            ⚠️ Já existem {selectedMatch.contacts_count} contato{selectedMatch.contacts_count === 1 ? '' : 's'} dessa associação
          </div>
          <div className="text-amber-300/80 mt-0.5">
            Última interação {selectedMatch.last_interaction_at ? formatRelativeDays(selectedMatch.last_interaction_at) : 'nenhuma interação ainda'}
          </div>
        </div>
      )}
      {selectedMatch && (selectedMatch.contacts_count ?? 0) === 0 && (
        <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-3 py-2 text-xs font-semibold">
          Primeiro contato dessa associação ✨
        </div>
      )}
    </div>
  );
}
