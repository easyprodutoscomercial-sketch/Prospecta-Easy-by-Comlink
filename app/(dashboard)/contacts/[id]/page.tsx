'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Contact, Interaction, Meeting, ContactAttachment, TelefoneAdicional } from '@/lib/types';
import ContactForm from '@/components/contacts/contact-form';
import ConfirmModal from '@/components/ui/confirm-modal';
import MotivoModal from '@/components/ui/motivo-modal';
import Tabs from '@/components/ui/tabs';
import ContactSidebar from '@/components/contacts/contact-sidebar';
import ContactDetails from '@/components/contacts/contact-details';
import ContactTimeline from '@/components/contacts/contact-timeline';
import AICopilotPanel from '@/components/ai/ai-copilot-panel';
import { ScoreBadge } from '@/components/lead-score/score-badge';
import { ScoreBreakdownChart } from '@/components/lead-score/score-breakdown';
import { ScoreTrend } from '@/components/lead-score/score-trend';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast-context';

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
      if (r.ok) { const updated = await r.json(); setContact(updated); toast.success(newValue ? 'Contato marcado como inexistente' : 'Marca de inexistente removida'); }
      else { setContact((p) => p ? { ...p, inexistente: !newValue } : p); toast.error('Erro ao atualizar contato'); }
    } catch { setContact((p) => p ? { ...p, inexistente: !newValue } : p); toast.error('Erro ao atualizar contato'); }
  };

  const baseTabs = [
    { key: 'timeline', label: 'Timeline', count: interactions.length + meetings.length + attachments.length },
    { key: 'detalhes', label: 'Detalhes' },
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
        <button onClick={() => setIsEditing(false)} className="text-sm text-neutral-400 hover:text-white transition-colors">&larr; Voltar</button>
        <h1 className="text-xl font-bold text-white">Editar Contato</h1>
        <ContactForm mode="edit" initialData={contact} onSubmit={handleEditSubmit} onCancel={() => setIsEditing(false)} loading={editLoading} error={editError} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/contacts'}
        className="inline-flex items-center gap-1 text-sm text-emerald-400/70 hover:text-emerald-400 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Voltar para contatos
      </button>

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
            onDelete={() => setShowDeleteModal(true)}
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
        <div className="flex-1 min-w-0">
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
      <ConfirmModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDelete}
        title="Deletar contato" message={`Deletar "${contact.name}"? Irreversivel.`} variant="danger" confirmLabel="Deletar" loading={deleteLoading} />
      {pendingStatus && <MotivoModal isOpen={showMotivoModal} onClose={() => { setShowMotivoModal(false); setPendingStatus(null); setPendingTerminalStageId(null); }} onConfirm={handleMotivoConfirm} tipo={pendingStatus} loading={motivoLoading} />}
    </div>
  );
}
