'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Contact, Interaction, Meeting, ContactAttachment, TelefoneAdicional } from '@/lib/types';
import ContactForm from '@/components/contacts/contact-form';
import ConfirmModal from '@/components/ui/confirm-modal';
import DeleteConfirmModal from '@/components/ui/delete-confirm-modal';
import MotivoModal from '@/components/ui/motivo-modal';
import Tabs from '@/components/ui/tabs';
import ContactSidebar from '@/components/contacts/contact-sidebar';
import ContactDetails from '@/components/contacts/contact-details';
import ContactAvatar from '@/components/contacts/contact-avatar';
import ContactTimeline from '@/components/contacts/contact-timeline';
import AICopilotPanel from '@/components/ai/ai-copilot-panel';
import { ScoreBadge } from '@/components/lead-score/score-badge';
import { ScoreBreakdownChart } from '@/components/lead-score/score-breakdown';
import { ScoreTrend } from '@/components/lead-score/score-trend';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import Breadcrumbs from '@/components/ui/breadcrumbs';
import { useToast } from '@/lib/toast-context';
import { formatStatus, getStatusColor } from '@/lib/utils/labels';

interface CurrentUser { user_id: string; role: string; name: string; }

type AttachmentWithUrl = ContactAttachment & { public_url: string };

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [stand, setStand] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [activeTab, setActiveTab] = useState('timeline');

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [ownerName, setOwnerName] = useState<string>('');
  const [ownerAvatarUrl, setOwnerAvatarUrl] = useState<string | null>(null);
  const [pendingAccessRequest, setPendingAccessRequest] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [claimingContact, setClaimingContact] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletePreview, setDeletePreview] = useState<any>(null);

  const [showMotivoModal, setShowMotivoModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<'CONVERTIDO' | 'PERDIDO' | null>(null);
  const [pendingTerminalStageId, setPendingTerminalStageId] = useState<string | null>(null);
  const [motivoLoading, setMotivoLoading] = useState(false);

  const [scoreData, setScoreData] = useState<{ score: number; breakdown: any; weeklyDelta: number } | null>(null);

  useEffect(() => { loadContact(); loadCurrentUser(); loadScore(); }, [id]);

  // Re-fetch interactions when page regains focus (e.g., returning from pipeline)
  useEffect(() => {
    const handleFocus = () => {
      if (!loading && id) {
        fetch(`/api/interactions?contact_id=${id}`).then(r => r.ok ? r.json() : null).then(data => {
          if (data?.interactions) setInteractions(data.interactions);
        }).catch(() => {});
        fetch(`/api/meetings?contact_id=${id}`).then(r => r.ok ? r.json() : null).then(data => {
          if (data?.meetings) setMeetings(data.meetings);
          else if (Array.isArray(data)) setMeetings(data);
        }).catch(() => {});
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [id, loading]);

  const loadCurrentUser = async () => { try { const r = await fetch('/api/me'); if (r.ok) setCurrentUser(await r.json()); } catch {} };

  const loadScore = async () => {
    try {
      const r = await fetch(`/api/contacts/${id}/score`);
      if (r.ok) setScoreData(await r.json());
    } catch {}
  };

  const loadContact = async () => {
    const [res, meetingsRes] = await Promise.all([
      fetch(`/api/contacts/${id}`),
      fetch(`/api/meetings?contact_id=${id}`),
    ]);
    const data = await res.json();
    setContact(data.contact);
    setInteractions(data.interactions || []);
    setAttachments(data.attachments || []);
    setStand(data.stand || null);
    if (meetingsRes.ok) {
      const meetingsData = await meetingsRes.json();
      setMeetings(meetingsData.meetings || meetingsData || []);
    }
    setLoading(false);
    if (data.contact?.assigned_to_user_id) {
      try {
        const ur = await fetch('/api/users');
        if (ur.ok) { const ud = await ur.json(); const o = (ud.users || []).find((u: any) => u.user_id === data.contact.assigned_to_user_id); if (o) { setOwnerName(o.name); setOwnerAvatarUrl(o.avatar_url || null); } }
      } catch {}
      try {
        const ar = await fetch('/api/access-requests?role=requester');
        if (ar.ok) { const ad = await ar.json(); const p = (ad.requests || []).find((r: any) => r.contact_id === id && r.status === 'PENDING'); if (p) setPendingAccessRequest(true); }
      } catch {}
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const canModify = !!currentUser;

  const handleStatusChange = async (statusOrStageId: string) => {
    // Check if it's a UUID (stage_id) or a legacy status string
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(statusOrStageId);

    if (isUuid) {
      // It's a stage_id - update via stage_id
      setContact((p) => p ? { ...p, stage_id: statusOrStageId } as Contact : p);
      const res = await fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_id: statusOrStageId }) });
      if (res.ok) {
        const updated = await res.json();
        setContact((p) => p ? { ...p, ...updated } : p);
        toast.success('Status atualizado');
      } else {
        toast.error('Erro ao atualizar status');
      }
    } else {
      // Legacy status string
      if (statusOrStageId === 'CONVERTIDO' || statusOrStageId === 'PERDIDO') { setPendingStatus(statusOrStageId as any); setShowMotivoModal(true); return; }
      setContact((p) => p ? { ...p, status: statusOrStageId } as Contact : p);
      await fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: statusOrStageId }) });
      toast.success('Status atualizado');
    }
  };

  const handleTerminalStageClick = (stageId: string, terminalType: 'won' | 'lost') => {
    setPendingTerminalStageId(stageId);
    setPendingStatus(terminalType === 'won' ? 'CONVERTIDO' : 'PERDIDO');
    setShowMotivoModal(true);
  };

  const handleMotivoConfirm = async (motivo: string) => {
    if (!pendingStatus) return;
    setMotivoLoading(true);
    try {
      const body: Record<string, any> = { motivo_ganho_perdido: motivo };
      if (pendingTerminalStageId) {
        body.stage_id = pendingTerminalStageId;
      } else {
        body.status = pendingStatus;
      }
      const r = await fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) { setContact(await r.json()); toast.success('Status atualizado'); } else toast.error('Erro ao atualizar status');
    } catch { toast.error('Erro ao atualizar status'); }
    setMotivoLoading(false); setShowMotivoModal(false); setPendingStatus(null); setPendingTerminalStageId(null);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const r = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success('Contato deletado'); router.push('/contacts'); } else toast.error('Erro ao deletar');
    setDeleteLoading(false); setShowDeleteModal(false);
  };

  // Abre o modal de delete com preview do cascade. Admin-only (ja validado no bot\u00e3o).
  const openDeleteModal = async () => {
    try {
      const r = await fetch(`/api/contacts/${id}/delete-preview`);
      if (r.ok) {
        setDeletePreview(await r.json());
        setShowDeleteModal(true);
      } else {
        toast.error('Erro ao carregar preview');
      }
    } catch {
      toast.error('Erro ao carregar preview');
    }
  };

  const handleEditSubmit = async (formData: Record<string, any>) => {
    setEditLoading(true); setEditError('');
    console.log('[EDICAO] Dados enviados:', JSON.stringify(formData, null, 2));
    try {
      const r = await fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (!r.ok) { const d = await r.json(); console.error('[EDICAO] Erro:', d.error, d.details || ''); setEditError(d.error || 'Erro'); return; }
      const updated = await r.json();
      console.log('[EDICAO] Contato atualizado:', updated.id);
      setContact(updated); setIsEditing(false); toast.success('Contato atualizado!');
    } catch (err: any) { console.error('[EDICAO] Erro de rede:', err.message); setEditError('Erro ao salvar'); } finally { setEditLoading(false); }
  };

  const handleClaimContact = async () => {
    if (!currentUser) return;
    setClaimingContact(true);
    try {
      const r = await fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigned_to_user_id: currentUser.user_id }) });
      if (r.ok) { setContact(await r.json()); setOwnerName(currentUser.name); toast.success('Contato atribuido a voce!'); } else toast.error('Erro');
    } catch { toast.error('Erro'); } finally { setClaimingContact(false); }
  };

  const handleRequestAccess = async () => {
    setRequestingAccess(true);
    try {
      const r = await fetch('/api/access-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: id }) });
      if (r.ok) { setPendingAccessRequest(true); toast.success('Solicitacao enviada!'); }
      else { const d = await r.json(); toast.error(d.error || 'Erro'); }
    } catch { toast.error('Erro'); } finally { setRequestingAccess(false); }
  };

  const handleUpdatePhones = async (telefones: TelefoneAdicional[]) => {
    try {
      const r = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefones_adicionais: telefones }),
      });
      if (r.ok) {
        const updated = await r.json();
        setContact(updated);
        toast.success('Telefones atualizados');
      } else {
        toast.error('Erro ao atualizar telefones');
      }
    } catch {
      toast.error('Erro ao atualizar telefones');
    }
  };

  const handleToggleInexistente = async () => {
    if (!contact) return;
    const newValue = !contact.inexistente;
    setContact((p) => p ? { ...p, inexistente: newValue } : p);
    try {
      const r = await fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inexistente: newValue }) });
      if (r.ok) { const updated = await r.json(); setContact(updated); toast.success(newValue ? 'Contato descartado' : 'Contato recuperado'); }
      else { setContact((p) => p ? { ...p, inexistente: !newValue } : p); toast.error('Erro ao atualizar contato'); }
    } catch { setContact((p) => p ? { ...p, inexistente: !newValue } : p); toast.error('Erro ao atualizar contato'); }
  };

  // Count preenchidos: campos "importantes" do contato que têm valor
  const detalhesCount = (() => {
    if (!contact) return 0;
    const fields = [
      contact.name, contact.company, contact.email, contact.phone, contact.whatsapp,
      contact.cpf, contact.cnpj, contact.cidade, contact.estado, contact.endereco,
      contact.cargo, contact.contato_nome, contact.temperatura, contact.classe,
      contact.origem, contact.segmento, contact.produtos_fornecidos, contact.website,
      contact.instagram, contact.notes,
      (contact.tipo && contact.tipo.length > 0) ? 'tipo' : null,
      (contact.valor_estimado != null && contact.valor_estimado > 0) ? 'valor' : null,
    ];
    return fields.filter((f) => f && String(f).trim() !== '').length;
  })();

  const baseTabs = [
    { key: 'timeline', label: 'Timeline', count: interactions.length + meetings.length + attachments.length },
    { key: 'detalhes', label: 'Detalhes', count: detalhesCount },
  ];
  const tabs = isAdmin
    ? [...baseTabs, { key: 'ai-copilot', label: 'AI Copilot' }]
    : baseTabs;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-[350px] shrink-0"><Skeleton className="h-64 w-full" /></div>
          <div className="flex-1"><Skeleton className="h-8 w-64" /><SkeletonText lines={6} /></div>
        </div>
      </div>
    );
  }

  if (!contact) return <div className="text-center py-12 text-sm text-neutral-500">Contato nao encontrado</div>;

  if (isEditing) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Breadcrumbs items={[{ label: 'Contatos', href: '/contacts' }, { label: contact.name, href: `/contacts/${id}` }, { label: 'Editar' }]} />
        <h1 className="text-xl font-bold text-white">Editar Contato</h1>
        <ContactForm mode="edit" initialData={contact} onSubmit={handleEditSubmit} onCancel={() => setIsEditing(false)} loading={editLoading} error={editError} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Contatos', href: '/contacts' }, { label: contact.name }]} />

      {/* Toolbar: nome + status + açoes rápidas (sempre visível no topo) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <ContactAvatar name={contact.name} avatarUrl={contact.avatar_url} size="xl" />
          <div className="flex items-center gap-3 min-w-0 flex-1 flex-wrap">
            <h1 className={`text-xl sm:text-2xl font-bold truncate ${contact.inexistente ? 'line-through text-neutral-500' : 'text-white'}`}>
              {contact.name}
            </h1>
            <span className={`shrink-0 px-2 py-0.5 text-[11px] font-medium rounded-full whitespace-nowrap ${getStatusColor(contact.status)}`}>
              {formatStatus(contact.status)}
            </span>
          </div>
        </div>
        {canModify && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/15 hover:border-emerald-400 transition-colors min-h-[40px]"
              aria-label="Editar contato"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="hidden sm:inline">Editar</span>
            </button>
            {isAdmin && (
              <button
                onClick={openDeleteModal}
                className="inline-flex items-center justify-center p-2 text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg hover:bg-red-500/15 hover:border-red-400 transition-colors min-h-[40px] min-w-[40px]"
                aria-label="Deletar contato"
                title="Deletar contato"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full lg:w-[350px] shrink-0 lg:sticky lg:top-6 lg:self-start space-y-4">
          <ContactSidebar
            contact={contact}
            ownerName={ownerName}
            ownerAvatarUrl={ownerAvatarUrl}
            currentUser={currentUser}
            onStatusChange={handleStatusChange}
            onTerminalStageClick={handleTerminalStageClick}
            onEdit={() => setIsEditing(true)}
            onDelete={openDeleteModal}
            onClaim={handleClaimContact}
            onRequestAccess={handleRequestAccess}
            onUpdatePhones={handleUpdatePhones}
            onToggleInexistente={handleToggleInexistente}
            onUnassign={async () => {
              try {
                const r = await fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigned_to_user_id: null }) });
                if (r.ok) { setContact(await r.json()); setOwnerName(''); setOwnerAvatarUrl(null); toast.success('Responsavel removido'); }
                else toast.error('Erro ao remover responsavel');
              } catch { toast.error('Erro ao remover responsavel'); }
            }}
            claimingContact={claimingContact}
            requestingAccess={requestingAccess}
            pendingAccessRequest={pendingAccessRequest}
          />

          {/* Lead Score */}
          {scoreData && (
            <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-purple-300/60 uppercase tracking-wider">Lead Score</h3>
                <div className="flex items-center gap-2">
                  <ScoreTrend delta={scoreData.weeklyDelta} />
                  <ScoreBadge score={scoreData.score} size="md" />
                </div>
              </div>
              <ScoreBreakdownChart breakdown={scoreData.breakdown} />
            </div>
          )}
        </div>

        {/* Main area */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* ===== Stand vinculado (vem de check-in de feira) ===== */}
          {stand && stand.booth && (
            <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                  Stand de origem
                </h3>
                <a href={`/eventos/${stand.event?.id}`} className="text-[10px] text-emerald-400 hover:underline">Abrir stand →</a>
              </div>
              <div className="flex items-start gap-4 flex-wrap">
                {/* Logo da marca */}
                <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-purple-700/30">
                  {stand.booth.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={stand.booth.logo_url} alt={stand.booth.company_name} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-[10px] font-bold text-neutral-500 text-center px-1 line-clamp-3">{stand.booth.company_name.slice(0, 18)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white">{stand.booth.company_name}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {stand.booth.booth_number && <span className="text-[11px] font-mono bg-[#2a1245] text-purple-300 px-2 py-0.5 rounded">Stand {stand.booth.booth_number}</span>}
                    {stand.booth.sector && <span className="text-[11px] text-purple-300/70">{stand.booth.sector}</span>}
                    {stand.booth.status === 'VISITADO' && <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">VISITADO</span>}
                  </div>
                  {stand.event && <p className="text-xs text-purple-300/60 mt-1">{stand.event.name}</p>}
                  {stand.booth.website && (
                    <a href={stand.booth.website} target="_blank" rel="noopener noreferrer" className="text-[11px] text-cyan-400 hover:underline mt-1 inline-block">{stand.booth.website}</a>
                  )}
                </div>
              </div>

              {/* Fotos da visita */}
              {stand.visits && stand.visits.length > 0 && stand.visits.some((v: any) => v.photo_facade_url || v.photo_contact_url) && (
                <div className="mt-4 pt-4 border-t border-purple-800/30">
                  <p className="text-[10px] font-bold text-purple-300/60 uppercase tracking-wider mb-2">Fotos da visita</p>
                  <div className="flex gap-2 flex-wrap">
                    {stand.visits.flatMap((v: any) => {
                      const photos = [];
                      if (v.photo_facade_url) photos.push({ url: v.photo_facade_url, label: 'Fachada', visitedAt: v.visited_at });
                      if (v.photo_contact_url) photos.push({ url: v.photo_contact_url, label: 'Cartao', visitedAt: v.visited_at });
                      return photos;
                    }).map((p: any, idx: number) => (
                      <a
                        key={idx}
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative w-24 h-20 rounded-lg overflow-hidden border border-purple-700/30 hover:border-emerald-500 transition-colors group"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={p.label} className="w-full h-full object-cover" loading="lazy" />
                        <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] py-0.5 text-center">{p.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Visitas registradas */}
              <div className="mt-4 pt-4 border-t border-purple-800/30">
                <p className="text-[10px] font-bold text-purple-300/60 uppercase tracking-wider mb-2">{stand.visits?.length || 0} visita{(stand.visits?.length || 0) !== 1 ? 's' : ''} registrada{(stand.visits?.length || 0) !== 1 ? 's' : ''}</p>
                {stand.visits && stand.visits.slice(0, 3).map((v: any) => (
                  <div key={v.id} className="text-[11px] text-purple-200/70 flex items-center gap-2 py-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                    <span className="font-medium text-white">{v.user_name}</span>
                    <span className="text-purple-300/50">visitou</span>
                    <span className="text-purple-300/40">{new Date(v.visited_at || v.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30">
            {/* Tabs */}
            <div className="px-4 sm:px-5 pt-3">
              <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
            </div>

            {/* Tab content */}
            <div className="p-4 sm:p-5">
              {activeTab === 'timeline' && (
                <ContactTimeline
                  contactId={id}
                  interactions={interactions}
                  setInteractions={setInteractions}
                  meetings={meetings}
                  setMeetings={setMeetings}
                  attachments={attachments}
                  setAttachments={setAttachments}
                  canModify={!!canModify}
                />
              )}
              {activeTab === 'detalhes' && (
                <ContactDetails contact={contact} />
              )}
              {activeTab === 'ai-copilot' && (
                <AICopilotPanel
                  contactId={id}
                  contactName={contact.name}
                  contactStatus={contact.status}
                  onActionApplied={loadContact}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDeleteModal && deletePreview && contact && (
        <DeleteConfirmModal
          open={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirmed={() => {
            setShowDeleteModal(false);
            toast.success('Contato deletado');
            router.push('/contacts');
          }}
          title={`Apagar Contato: ${contact.name}`}
          confirmName={contact.name}
          description="Esse contato e tudo ligado a ele sera apagado: interacoes, reunioes, anexos, notificacoes e historico de score. Visitas de stand associadas ficam anonimas (nao sao apagadas)."
          items={[
            { label: 'Interacoes (ligacoes, whatsapp, email)', value: deletePreview.counts?.interactions || 0 },
            { label: 'Reunioes agendadas', value: deletePreview.counts?.meetings || 0 },
            { label: 'Anexos (fotos, arquivos)', value: deletePreview.counts?.attachments || 0 },
            { label: 'Notificacoes', value: deletePreview.counts?.notifications || 0 },
            { label: 'Historico de lead score', value: deletePreview.counts?.score_history || 0 },
            {
              label: 'Valor estimado',
              value: (deletePreview.counts?.valor_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
              prefix: 'R$ ',
              critical: (deletePreview.counts?.valor_estimado || 0) > 0,
            },
          ]}
          deleteUrl={`/api/contacts/${id}`}
        />
      )}
      {pendingStatus && <MotivoModal isOpen={showMotivoModal} onClose={() => { setShowMotivoModal(false); setPendingStatus(null); setPendingTerminalStageId(null); }} onConfirm={handleMotivoConfirm} tipo={pendingStatus} loading={motivoLoading} />}
    </div>
  );
}
