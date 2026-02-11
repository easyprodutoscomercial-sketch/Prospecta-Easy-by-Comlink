'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Contact, Interaction } from '@/lib/types';
import {
  formatStatus,
  getStatusColor,
  formatInteractionType,
  formatInteractionOutcome,
  CONTACT_TYPE_LABELS,
  CONTACT_TYPE_COLORS,
  INTERACTION_TYPE_LABELS,
  INTERACTION_OUTCOME_LABELS,
  CLASSE_LABELS,
  TEMPERATURA_LABELS,
  TEMPERATURA_COLORS,
  ORIGEM_LABELS,
  PROXIMA_ACAO_LABELS,
  ACTIVITY_TEMPLATES,
} from '@/lib/utils/labels';
import ContactForm from '@/components/contacts/contact-form';
import ConfirmModal from '@/components/ui/confirm-modal';
import MotivoModal from '@/components/ui/motivo-modal';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast-context';

interface CurrentUser { user_id: string; role: string; name: string; }

function FieldValue({ value, placeholder = 'Nao informado' }: { value: string | null | undefined; placeholder?: string }) {
  if (value && value.trim() !== '') return <p className="text-sm font-medium text-neutral-100">{value}</p>;
  return <p className="text-sm text-neutral-600 italic">{placeholder}</p>;
}

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

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

  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [newInteraction, setNewInteraction] = useState({ type: 'LIGACAO' as string, outcome: 'SEM_RESPOSTA' as string, note: '', happened_at: '' });
  const [editingInteractionId, setEditingInteractionId] = useState<string | null>(null);
  const [editInteractionData, setEditInteractionData] = useState({ type: '', outcome: '', note: '', happened_at: '' });
  const [deleteInteractionId, setDeleteInteractionId] = useState<string | null>(null);
  const [interactionActionLoading, setInteractionActionLoading] = useState(false);
  const [interactionFilter, setInteractionFilter] = useState('all');

  useEffect(() => { loadContact(); loadCurrentUser(); }, [id]);

  const loadCurrentUser = async () => { try { const r = await fetch('/api/me'); if (r.ok) setCurrentUser(await r.json()); } catch {} };

  const loadContact = async () => {
    const res = await fetch(`/api/contacts/${id}`);
    const data = await res.json();
    setContact(data.contact);
    setInteractions(data.interactions || []);
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
  const canModify = isOwner || isAdmin || !contact?.assigned_to_user_id;
  const isOtherOwner = contact?.assigned_to_user_id && !isOwner && !isAdmin;

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

  const handleQuickTemplate = async (tpl: typeof ACTIVITY_TEMPLATES[number]) => {
    const r = await fetch('/api/interactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: id, type: tpl.type, outcome: tpl.outcome, note: tpl.note }) });
    if (r.ok) { const created = await r.json(); setInteractions((p) => [created, ...p]); toast.success('Interacao registrada'); }
    else { const d = await r.json(); toast.error(d.error || 'Erro'); }
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

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, any> = { contact_id: id, type: newInteraction.type, outcome: newInteraction.outcome, note: newInteraction.note || null };
    if (newInteraction.happened_at) body.happened_at = new Date(newInteraction.happened_at).toISOString();
    const r = await fetch('/api/interactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { const created = await r.json(); setInteractions((p) => [created, ...p]); toast.success('Interacao adicionada'); }
    else { const d = await r.json(); toast.error(d.error || 'Erro'); }
    setNewInteraction({ type: 'LIGACAO', outcome: 'SEM_RESPOSTA', note: '', happened_at: '' }); setShowInteractionForm(false);
  };

  const startEditInteraction = (i: Interaction) => {
    setEditingInteractionId(i.id);
    setEditInteractionData({ type: i.type, outcome: i.outcome, note: i.note || '', happened_at: i.happened_at ? new Date(i.happened_at).toISOString().slice(0, 16) : '' });
  };

  const handleSaveInteraction = async () => {
    if (!editingInteractionId) return;
    setInteractionActionLoading(true);
    const body: Record<string, any> = { type: editInteractionData.type, outcome: editInteractionData.outcome, note: editInteractionData.note || null };
    if (editInteractionData.happened_at) body.happened_at = new Date(editInteractionData.happened_at).toISOString();
    const r = await fetch(`/api/interactions/${editingInteractionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { const u = await r.json(); setInteractions((p) => p.map((i) => (i.id === editingInteractionId ? u : i))); toast.success('Atualizada'); }
    else toast.error('Erro');
    setEditingInteractionId(null); setInteractionActionLoading(false);
  };

  const handleDeleteInteraction = async () => {
    if (!deleteInteractionId) return;
    setInteractionActionLoading(true);
    const r = await fetch(`/api/interactions/${deleteInteractionId}`, { method: 'DELETE' });
    if (r.ok) { setInteractions((p) => p.filter((i) => i.id !== deleteInteractionId)); toast.success('Removida'); } else toast.error('Erro');
    setDeleteInteractionId(null); setInteractionActionLoading(false);
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

  const filteredInteractions = interactionFilter === 'all' ? interactions : interactions.filter((i) => i.type === interactionFilter);

  const inputCls = 'w-full px-3 py-2 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5 space-y-4"><Skeleton className="h-8 w-64" /><SkeletonText lines={4} /></div>
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
        Voltar
      </Link>

      {/* Banners */}
      {isOtherOwner && (
        <div className="p-3 bg-amber-900/30 border border-amber-700/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm font-medium text-amber-300">Contato atribuido a {ownerName || 'outro usuario'}. Apenas o responsavel pode modificar.</p>
          {pendingAccessRequest ? (
            <button disabled className="px-3 py-1.5 text-xs font-medium text-emerald-400 border border-amber-600/50 rounded-lg opacity-60 cursor-not-allowed shrink-0">Solicitacao Pendente</button>
          ) : (
            <button onClick={handleRequestAccess} disabled={requestingAccess} className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-500 disabled:opacity-40 transition-colors shrink-0">
              {requestingAccess ? 'Enviando...' : 'Solicitar Acesso'}
            </button>
          )}
        </div>
      )}

      {!contact.assigned_to_user_id && currentUser && (
        <div className="p-3 bg-emerald-900/20 border border-emerald-700/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm font-medium text-emerald-300">Este contato nao tem responsavel atribuido.</p>
          <button onClick={handleClaimContact} disabled={claimingContact} className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-40 transition-colors shadow-lg shadow-emerald-600/20 shrink-0">
            {claimingContact ? 'Atribuindo...' : 'Apontar para mim'}
          </button>
        </div>
      )}

      {/* Header + actions */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h1 className="text-lg sm:text-xl font-bold text-emerald-400">{contact.name}</h1>
              {contact.tipo?.map((t) => (
                <span key={t} className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${CONTACT_TYPE_COLORS[t] || 'bg-[#2a1245] text-neutral-400'}`}>{CONTACT_TYPE_LABELS[t] || t}</span>
              ))}
            </div>
            <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(contact.status)}`}>{formatStatus(contact.status)}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <select value={contact.status} onChange={(e) => handleStatusChange(e.target.value)} disabled={!!isOtherOwner}
              className={`px-3 py-1.5 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isOtherOwner ? 'opacity-40 cursor-not-allowed' : ''}`}>
              <option value="NOVO">Novo</option>
              <option value="EM_PROSPECCAO">Em Prospecao</option>
              <option value="CONTATADO">Contatado</option>
              <option value="REUNIAO_MARCADA">Reuniao Marcada</option>
              <option value="CONVERTIDO">Convertido</option>
              <option value="PERDIDO">Perdido</option>
            </select>
            {canModify && (
              <>
                <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 text-sm font-semibold text-emerald-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors">Editar</button>
                <button onClick={() => setShowDeleteModal(true)} className="px-3 py-1.5 text-sm font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors">Deletar</button>
              </>
            )}
          </div>
        </div>

        {/* ALL FIELDS */}
        <div className="space-y-6">
          <Section title="Responsavel">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Responsavel</Label>
                {contact.assigned_to_user_id ? (
                  <div className="flex items-center gap-3 mt-1">
                    <div className="avatar-orbit shrink-0">
                      {ownerAvatarUrl ? (
                        <img src={ownerAvatarUrl} alt={ownerName} className="w-16 h-16 object-cover" />
                      ) : (
                        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white">
                          {ownerName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <span className="text-neutral-100 text-sm font-medium">{ownerName || 'Carregando...'}</span>
                  </div>
                ) : (
                  <p className="text-neutral-600 italic text-sm mt-1">Sem responsavel</p>
                )}
              </div>
            </div>
          </Section>

          <Section title="Dados Basicos">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Nome</Label><FieldValue value={contact.name} /></div>
              <div><Label>Empresa</Label><FieldValue value={contact.company} /></div>
              <div><Label>Email</Label><FieldValue value={contact.email} /></div>
              <div><Label>Telefone</Label><FieldValue value={contact.phone} /></div>
              <div><Label>WhatsApp</Label><FieldValue value={contact.whatsapp} /></div>
              <div><Label>CPF</Label><FieldValue value={contact.cpf} /></div>
              <div><Label>CNPJ</Label><FieldValue value={contact.cnpj} /></div>
              <div><Label>Referencia</Label><FieldValue value={contact.referencia} /></div>
            </div>
          </Section>

          <Section title="Tipo e Classificacao">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                {contact.tipo && contact.tipo.length > 0 ? (
                  <div className="flex gap-1 flex-wrap">{contact.tipo.map((t) => (<span key={t} className={`px-2 py-0.5 text-xs font-medium rounded-full ${CONTACT_TYPE_COLORS[t] || 'bg-[#2a1245] text-neutral-400'}`}>{CONTACT_TYPE_LABELS[t] || t}</span>))}</div>
                ) : <p className="text-sm text-neutral-600 italic">Nao informado</p>}
              </div>
              <div><Label>Classe</Label><FieldValue value={contact.classe ? (CLASSE_LABELS[contact.classe] || contact.classe) : null} /></div>
              <div className="sm:col-span-2"><Label>Produtos Fornecidos</Label><FieldValue value={contact.produtos_fornecidos} /></div>
            </div>
          </Section>

          <Section title="Pessoa de Contato">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Nome do Contato</Label><FieldValue value={contact.contato_nome} /></div>
              <div><Label>Cargo</Label><FieldValue value={contact.cargo} /></div>
            </div>
          </Section>

          <Section title="Endereco">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><Label>Endereco</Label><FieldValue value={contact.endereco} /></div>
              <div><Label>Cidade</Label><FieldValue value={contact.cidade} /></div>
              <div><Label>Estado</Label><FieldValue value={contact.estado} /></div>
              <div><Label>CEP</Label><FieldValue value={contact.cep} /></div>
            </div>
          </Section>

          <Section title="Presenca Digital">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Website</Label><FieldValue value={contact.website} /></div>
              <div><Label>Instagram</Label><FieldValue value={contact.instagram} /></div>
            </div>
          </Section>

          <Section title="Qualificacao">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Temperatura</Label>
                {contact.temperatura ? (
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${TEMPERATURA_COLORS[contact.temperatura] || ''}`}>{TEMPERATURA_LABELS[contact.temperatura] || contact.temperatura}</span>
                ) : <p className="text-sm text-neutral-600 italic">Nao informado</p>}
              </div>
              <div><Label>Origem</Label><FieldValue value={contact.origem ? (ORIGEM_LABELS[contact.origem] || contact.origem) : null} /></div>
              <div><Label>Proxima Acao</Label><FieldValue value={contact.proxima_acao_tipo ? (PROXIMA_ACAO_LABELS[contact.proxima_acao_tipo] || contact.proxima_acao_tipo) : null} /></div>
              <div><Label>Data Proxima Acao</Label><FieldValue value={contact.proxima_acao_data ? new Date(contact.proxima_acao_data).toLocaleString('pt-BR') : null} /></div>
              <div className="sm:col-span-2"><Label>Motivo Ganho/Perdido</Label><FieldValue value={contact.motivo_ganho_perdido} /></div>
            </div>
          </Section>

          <Section title="Observacoes" noBorder>
            <FieldValue value={contact.notes} placeholder="Sem observacoes" />
          </Section>

          <div className="pt-4 border-t border-purple-800/30 flex items-center gap-4 text-xs text-neutral-600 flex-wrap">
            <span>Criado: {new Date(contact.created_at).toLocaleString('pt-BR')}</span>
            <span>Atualizado: {new Date(contact.updated_at).toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </div>

      {/* Interactions */}
      {canModify && (
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold text-emerald-400">Interacoes <span className="text-red-400/60 font-normal">({interactions.length})</span></h2>
            <button onClick={() => setShowInteractionForm(!showInteractionForm)} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20">
              + Nova Interacao
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <select value={interactionFilter} onChange={(e) => setInteractionFilter(e.target.value)} className="px-2 py-1.5 text-xs border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="all">Todos</option>
              {Object.entries(INTERACTION_TYPE_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
            </select>
            {ACTIVITY_TEMPLATES.map((tpl) => (
              <button key={tpl.label} onClick={() => handleQuickTemplate(tpl)} className="px-2 py-1 text-[11px] font-medium text-neutral-400 bg-[#2a1245] rounded-lg hover:bg-purple-800/30 hover:text-white transition-colors">{tpl.label}</button>
            ))}
          </div>

          {showInteractionForm && (
            <form onSubmit={handleAddInteraction} className="mb-6 p-3 sm:p-4 bg-[#2a1245]/50 rounded-xl border border-purple-700/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div><label className="block text-xs font-medium text-neutral-400 mb-1">Tipo</label>
                  <select value={newInteraction.type} onChange={(e) => setNewInteraction({ ...newInteraction, type: e.target.value })} className={inputCls}>{Object.entries(INTERACTION_TYPE_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}</select></div>
                <div><label className="block text-xs font-medium text-neutral-400 mb-1">Resultado</label>
                  <select value={newInteraction.outcome} onChange={(e) => setNewInteraction({ ...newInteraction, outcome: e.target.value })} className={inputCls}>{Object.entries(INTERACTION_OUTCOME_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}</select></div>
              </div>
              <div className="mb-3"><label className="block text-xs font-medium text-neutral-400 mb-1">Data/Hora</label><input type="datetime-local" value={newInteraction.happened_at} onChange={(e) => setNewInteraction({ ...newInteraction, happened_at: e.target.value })} className={inputCls} /></div>
              <div className="mb-3"><label className="block text-xs font-medium text-neutral-400 mb-1">Observacoes</label><textarea rows={3} value={newInteraction.note} onChange={(e) => setNewInteraction({ ...newInteraction, note: e.target.value })} className={inputCls} /></div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowInteractionForm(false)} className="px-3 py-1.5 text-sm text-neutral-400 border border-purple-700/30 rounded-lg hover:bg-purple-800/30 transition-colors">Cancelar</button>
                <button type="submit" className="px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors">Salvar</button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {filteredInteractions.map((interaction) => (
              <div key={interaction.id} className="border-l-2 border-purple-700/30 pl-3 sm:pl-4 py-2">
                {editingInteractionId === interaction.id ? (
                  <div className="p-3 bg-[#2a1245]/50 rounded-lg border border-purple-700/30 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><label className="block text-xs font-medium text-neutral-400 mb-1">Tipo</label>
                        <select value={editInteractionData.type} onChange={(e) => setEditInteractionData({ ...editInteractionData, type: e.target.value })} className={inputCls}>{Object.entries(INTERACTION_TYPE_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}</select></div>
                      <div><label className="block text-xs font-medium text-neutral-400 mb-1">Resultado</label>
                        <select value={editInteractionData.outcome} onChange={(e) => setEditInteractionData({ ...editInteractionData, outcome: e.target.value })} className={inputCls}>{Object.entries(INTERACTION_OUTCOME_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}</select></div>
                    </div>
                    <div><label className="block text-xs font-medium text-neutral-400 mb-1">Data/Hora</label><input type="datetime-local" value={editInteractionData.happened_at} onChange={(e) => setEditInteractionData({ ...editInteractionData, happened_at: e.target.value })} className={inputCls} /></div>
                    <div><label className="block text-xs font-medium text-neutral-400 mb-1">Observacoes</label><textarea rows={2} value={editInteractionData.note} onChange={(e) => setEditInteractionData({ ...editInteractionData, note: e.target.value })} className={inputCls} /></div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingInteractionId(null)} disabled={interactionActionLoading} className="px-3 py-1.5 text-xs text-neutral-400 border border-purple-700/30 rounded-lg hover:bg-purple-800/30 transition-colors">Cancelar</button>
                      <button onClick={handleSaveInteraction} disabled={interactionActionLoading} className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors">{interactionActionLoading ? 'Salvando...' : 'Salvar'}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-200">{formatInteractionType(interaction.type)} — {formatInteractionOutcome(interaction.outcome)}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{new Date(interaction.happened_at).toLocaleString('pt-BR')} · {interaction.created_by_name}</p>
                      {interaction.note && <p className="mt-1.5 text-sm text-neutral-400 break-words">{interaction.note}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEditInteraction(interaction)} className="p-1.5 text-neutral-600 hover:text-emerald-400 rounded transition-colors" title="Editar">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={() => setDeleteInteractionId(interaction.id)} className="p-1.5 text-neutral-600 hover:text-red-400 rounded transition-colors" title="Excluir">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredInteractions.length === 0 && (
              <p className="text-center text-sm text-neutral-600 py-6">{interactionFilter === 'all' ? 'Nenhuma interacao registrada' : 'Nenhuma interacao deste tipo'}</p>
            )}
          </div>
        </div>
      )}

      {isOtherOwner && interactions.length > 0 && (
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4 sm:p-5">
          <h2 className="text-sm font-bold text-emerald-400 mb-4">Interacoes <span className="text-red-400/60">({interactions.length})</span></h2>
          <div className="space-y-3">
            {interactions.slice(0, 5).map((i) => (
              <div key={i.id} className="border-l-2 border-purple-700/30 pl-3 sm:pl-4 py-2">
                <p className="text-sm text-neutral-300">{formatInteractionType(i.type)} — {formatInteractionOutcome(i.outcome)}</p>
                <p className="text-xs text-neutral-600 mt-0.5">{new Date(i.happened_at).toLocaleString('pt-BR')} · {i.created_by_name}</p>
              </div>
            ))}
            {interactions.length > 5 && <p className="text-xs text-neutral-600 text-center py-2">+{interactions.length - 5} interacoes</p>}
          </div>
        </div>
      )}

      <ConfirmModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDelete}
        title="Deletar contato" message={`Deletar "${contact.name}"? Irreversivel.`} variant="danger" confirmLabel="Deletar" loading={deleteLoading} />
      <ConfirmModal isOpen={!!deleteInteractionId} onClose={() => setDeleteInteractionId(null)} onConfirm={handleDeleteInteraction}
        title="Excluir interacao" message="Excluir esta interacao?" variant="danger" confirmLabel="Excluir" loading={interactionActionLoading} />
      {pendingStatus && <MotivoModal isOpen={showMotivoModal} onClose={() => { setShowMotivoModal(false); setPendingStatus(null); }} onConfirm={handleMotivoConfirm} tipo={pendingStatus} loading={motivoLoading} />}
    </div>
  );
}

// Section helper
function Section({ title, children, noBorder }: { title: string; children: React.ReactNode; noBorder?: boolean }) {
  return (
    <div className={noBorder ? '' : 'pb-5 border-b border-purple-800/30'}>
      <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-purple-300/80 font-semibold mb-0.5">{children}</p>;
}
