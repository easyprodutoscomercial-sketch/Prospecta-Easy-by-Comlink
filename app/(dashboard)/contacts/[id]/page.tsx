'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Contact, Interaction, ContactAttachment } from '@/lib/types';
import ContactForm from '@/components/contacts/contact-form';
import ConfirmModal from '@/components/ui/confirm-modal';
import MotivoModal from '@/components/ui/motivo-modal';
import Tabs from '@/components/ui/tabs';
import ContactSidebar from '@/components/contacts/contact-sidebar';
import ContactDetails from '@/components/contacts/contact-details';
import ContactInteractions from '@/components/contacts/contact-interactions';
import ContactAttachments from '@/components/contacts/contact-attachments';
import ContactHistory from '@/components/contacts/contact-history';
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
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [activeTab, setActiveTab] = useState('historico');

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
  const [motivoLoading, setMotivoLoading] = useState(false);

  useEffect(() => { loadContact(); loadCurrentUser(); }, [id]);

  const loadCurrentUser = async () => { try { const r = await fetch('/api/me'); if (r.ok) setCurrentUser(await r.json()); } catch {} };

  const loadContact = async () => {
    const res = await fetch(`/api/contacts/${id}`);
    const data = await res.json();
    setContact(data.contact);
    setInteractions(data.interactions || []);
    setAttachments(data.attachments || []);
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

  const isOwner = currentUser && contact && contact.assigned_to_user_id === currentUser.user_id;
  const isAdmin = currentUser?.role === 'admin';
  const canModify = isOwner || isAdmin;

  const handleStatusChange = async (status: string) => {
    if (status === 'CONVERTIDO' || status === 'PERDIDO') { setPendingStatus(status as any); setShowMotivoModal(true); return; }
    setContact((p) => p ? { ...p, status } as Contact : p);
    await fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    toast.success('Status atualizado');
  };

  const handleMotivoConfirm = async (motivo: string) => {
    if (!pendingStatus) return;
    setMotivoLoading(true);
    try {
      const r = await fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: pendingStatus, motivo_ganho_perdido: motivo }) });
      if (r.ok) { setContact(await r.json()); toast.success('Status atualizado'); } else toast.error('Erro ao atualizar status');
    } catch { toast.error('Erro ao atualizar status'); }
    setMotivoLoading(false); setShowMotivoModal(false); setPendingStatus(null);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const r = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success('Contato deletado'); router.push('/contacts'); } else toast.error('Erro ao deletar');
    setDeleteLoading(false); setShowDeleteModal(false);
  };

  const handleEditSubmit = async (formData: Record<string, any>) => {
    setEditLoading(true); setEditError('');
    try {
      const r = await fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (!r.ok) { const d = await r.json(); setEditError(d.error || 'Erro'); return; }
      setContact(await r.json()); setIsEditing(false); toast.success('Contato atualizado!');
    } catch { setEditError('Erro ao salvar'); } finally { setEditLoading(false); }
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

  const tabs = [
    { key: 'historico', label: 'Historico', count: interactions.length + attachments.length },
    { key: 'atividades', label: 'Atividades', count: interactions.length },
    { key: 'detalhes', label: 'Detalhes' },
    { key: 'arquivos', label: 'Arquivos', count: attachments.length },
  ];

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
      <Link href="/contacts" className="inline-flex items-center gap-1 text-sm text-emerald-400/70 hover:text-emerald-400 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Voltar para contatos
      </Link>

      {/* 2-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full lg:w-[350px] shrink-0 lg:sticky lg:top-6 lg:self-start">
          <ContactSidebar
            contact={contact}
            ownerName={ownerName}
            ownerAvatarUrl={ownerAvatarUrl}
            currentUser={currentUser}
            onStatusChange={handleStatusChange}
            onEdit={() => setIsEditing(true)}
            onDelete={() => setShowDeleteModal(true)}
            onClaim={handleClaimContact}
            onRequestAccess={handleRequestAccess}
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
              {activeTab === 'historico' && (
                <ContactHistory interactions={interactions} attachments={attachments} />
              )}
              {activeTab === 'atividades' && (
                <ContactInteractions
                  contactId={id}
                  interactions={interactions}
                  setInteractions={setInteractions}
                  canModify={!!canModify}
                />
              )}
              {activeTab === 'detalhes' && (
                <ContactDetails contact={contact} />
              )}
              {activeTab === 'arquivos' && (
                <ContactAttachments
                  contactId={id}
                  attachments={attachments}
                  setAttachments={setAttachments}
                  canModify={!!canModify}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDelete}
        title="Deletar contato" message={`Deletar "${contact.name}"? Irreversivel.`} variant="danger" confirmLabel="Deletar" loading={deleteLoading} />
      {pendingStatus && <MotivoModal isOpen={showMotivoModal} onClose={() => { setShowMotivoModal(false); setPendingStatus(null); }} onConfirm={handleMotivoConfirm} tipo={pendingStatus} loading={motivoLoading} />}
    </div>
  );
}
