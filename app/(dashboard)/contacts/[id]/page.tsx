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
} from '@/lib/utils/labels';
import ContactForm from '@/components/contacts/contact-form';
import ConfirmModal from '@/components/ui/confirm-modal';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast-context';

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

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // New interaction form
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [newInteraction, setNewInteraction] = useState({
    type: 'LIGACAO' as string,
    outcome: 'SEM_RESPOSTA' as string,
    note: '',
    happened_at: '',
  });

  // Interaction edit/delete
  const [editingInteractionId, setEditingInteractionId] = useState<string | null>(null);
  const [editInteractionData, setEditInteractionData] = useState({ type: '', outcome: '', note: '', happened_at: '' });
  const [deleteInteractionId, setDeleteInteractionId] = useState<string | null>(null);
  const [interactionActionLoading, setInteractionActionLoading] = useState(false);

  // Interaction filter
  const [interactionFilter, setInteractionFilter] = useState('all');

  useEffect(() => {
    loadContact();
  }, [id]);

  const loadContact = async () => {
    const res = await fetch(`/api/contacts/${id}`);
    const data = await res.json();
    setContact(data.contact);
    setInteractions(data.interactions || []);
    setLoading(false);
  };

  const handleStatusChange = async (status: string) => {
    setContact((prev) => prev ? { ...prev, status } as Contact : prev);
    await fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    toast.success('Status atualizado');
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Contato deletado');
      router.push('/contacts');
    } else {
      toast.error('Erro ao deletar contato');
    }
    setDeleteLoading(false);
    setShowDeleteModal(false);
  };

  const handleEditSubmit = async (formData: Record<string, any>) => {
    setEditLoading(true);
    setEditError('');
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error || 'Erro ao salvar');
        return;
      }
      const updated = await res.json();
      setContact(updated);
      setIsEditing(false);
      toast.success('Contato atualizado com sucesso!');
    } catch {
      setEditError('Erro ao salvar alterações');
    } finally {
      setEditLoading(false);
    }
  };

  // Add interaction
  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, any> = {
      contact_id: id,
      type: newInteraction.type,
      outcome: newInteraction.outcome,
      note: newInteraction.note || null,
    };
    if (newInteraction.happened_at) {
      body.happened_at = new Date(newInteraction.happened_at).toISOString();
    }
    const res = await fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const created = await res.json();
      setInteractions((prev) => [created, ...prev]);
      toast.success('Interação adicionada');
    } else {
      toast.error('Erro ao adicionar interação');
    }
    setNewInteraction({ type: 'LIGACAO', outcome: 'SEM_RESPOSTA', note: '', happened_at: '' });
    setShowInteractionForm(false);
  };

  // Edit interaction
  const startEditInteraction = (interaction: Interaction) => {
    setEditingInteractionId(interaction.id);
    setEditInteractionData({
      type: interaction.type,
      outcome: interaction.outcome,
      note: interaction.note || '',
      happened_at: interaction.happened_at ? new Date(interaction.happened_at).toISOString().slice(0, 16) : '',
    });
  };

  const handleSaveInteraction = async () => {
    if (!editingInteractionId) return;
    setInteractionActionLoading(true);
    const body: Record<string, any> = {
      type: editInteractionData.type,
      outcome: editInteractionData.outcome,
      note: editInteractionData.note || null,
    };
    if (editInteractionData.happened_at) {
      body.happened_at = new Date(editInteractionData.happened_at).toISOString();
    }
    const res = await fetch(`/api/interactions/${editingInteractionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setInteractions((prev) => prev.map((i) => (i.id === editingInteractionId ? updated : i)));
      toast.success('Interação atualizada');
    } else {
      toast.error('Erro ao atualizar interação');
    }
    setEditingInteractionId(null);
    setInteractionActionLoading(false);
  };

  const handleDeleteInteraction = async () => {
    if (!deleteInteractionId) return;
    setInteractionActionLoading(true);
    const res = await fetch(`/api/interactions/${deleteInteractionId}`, { method: 'DELETE' });
    if (res.ok) {
      setInteractions((prev) => prev.filter((i) => i.id !== deleteInteractionId));
      toast.success('Interação removida');
    } else {
      toast.error('Erro ao remover interação');
    }
    setDeleteInteractionId(null);
    setInteractionActionLoading(false);
  };

  const filteredInteractions = interactionFilter === 'all'
    ? interactions
    : interactions.filter((i) => i.type === interactionFilter);

  // Loading skeleton
  if (loading) {
    return (
      <div>
        <div className="mb-6"><Skeleton className="h-4 w-40" /></div>
        <div className="bg-white rounded-lg shadow-sm p-5 mb-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <SkeletonText lines={4} />
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <SkeletonText lines={6} />
        </div>
      </div>
    );
  }

  if (!contact) return <div className="text-center py-12 text-sm text-neutral-500">Contato não encontrado</div>;

  // Edit mode
  if (isEditing) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <button onClick={() => setIsEditing(false)} className="text-sm text-neutral-500 hover:text-neutral-900">
            &larr; Voltar para detalhes
          </button>
        </div>
        <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Editar Contato</h1>
        <ContactForm
          mode="edit"
          initialData={contact}
          onSubmit={handleEditSubmit}
          onCancel={() => setIsEditing(false)}
          loading={editLoading}
          error={editError}
        />
      </div>
    );
  }

  const selectClass = 'w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent';

  return (
    <div>
      <div className="mb-6">
        <Link href="/contacts" className="text-sm text-neutral-500 hover:text-neutral-900">
          &larr; Voltar para contatos
        </Link>
      </div>

      {/* Contact header */}
      <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold text-neutral-900">{contact.name}</h1>
              {contact.tipo && contact.tipo.map((t) => (
                <span key={t} className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${CONTACT_TYPE_COLORS[t] || 'bg-neutral-100 text-neutral-600'}`}>
                  {CONTACT_TYPE_LABELS[t] || t}
                </span>
              ))}
              {contact.classe && (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-neutral-100 text-neutral-600">
                  {CLASSE_LABELS[contact.classe] || contact.classe}
                </span>
              )}
            </div>
            {contact.company && <p className="text-sm text-neutral-500">{contact.company}</p>}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={contact.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            >
              <option value="NOVO">Novo</option>
              <option value="EM_PROSPECCAO">Em Prospecção</option>
              <option value="CONTATADO">Contatado</option>
              <option value="REUNIAO_MARCADA">Reunião Marcada</option>
              <option value="CONVERTIDO">Convertido</option>
              <option value="PERDIDO">Perdido</option>
            </select>
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-sm font-medium text-neutral-700 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Editar
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Deletar
            </button>
          </div>
        </div>

        {/* Informações Básicas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contact.email && (
            <div>
              <p className="text-xs text-neutral-500">Email</p>
              <p className="text-sm font-medium text-neutral-900">{contact.email}</p>
            </div>
          )}
          {contact.phone && (
            <div>
              <p className="text-xs text-neutral-500">Telefone</p>
              <p className="text-sm font-medium text-neutral-900">{contact.phone}</p>
            </div>
          )}
          {contact.cpf && (
            <div>
              <p className="text-xs text-neutral-500">CPF</p>
              <p className="text-sm font-medium text-neutral-900">{contact.cpf}</p>
            </div>
          )}
          {contact.cnpj && (
            <div>
              <p className="text-xs text-neutral-500">CNPJ</p>
              <p className="text-sm font-medium text-neutral-900">{contact.cnpj}</p>
            </div>
          )}
          {contact.referencia && (
            <div>
              <p className="text-xs text-neutral-500">Referência</p>
              <p className="text-sm font-medium text-neutral-900">{contact.referencia}</p>
            </div>
          )}
          {contact.whatsapp && (
            <div>
              <p className="text-xs text-neutral-500">WhatsApp</p>
              <p className="text-sm font-medium text-neutral-900">{contact.whatsapp}</p>
            </div>
          )}
        </div>

        {/* Pessoa de Contato */}
        {(contact.contato_nome || contact.cargo) && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Pessoa de Contato</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contact.contato_nome && (
                <div>
                  <p className="text-xs text-neutral-500">Nome</p>
                  <p className="text-sm font-medium text-neutral-900">{contact.contato_nome}</p>
                </div>
              )}
              {contact.cargo && (
                <div>
                  <p className="text-xs text-neutral-500">Cargo</p>
                  <p className="text-sm font-medium text-neutral-900">{contact.cargo}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Endereço */}
        {(contact.endereco || contact.cidade || contact.estado || contact.cep) && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Endereço</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contact.endereco && (
                <div className="md:col-span-2">
                  <p className="text-xs text-neutral-500">Endereço</p>
                  <p className="text-sm font-medium text-neutral-900">{contact.endereco}</p>
                </div>
              )}
              {contact.cidade && (
                <div>
                  <p className="text-xs text-neutral-500">Cidade</p>
                  <p className="text-sm font-medium text-neutral-900">{contact.cidade}</p>
                </div>
              )}
              {contact.estado && (
                <div>
                  <p className="text-xs text-neutral-500">Estado</p>
                  <p className="text-sm font-medium text-neutral-900">{contact.estado}</p>
                </div>
              )}
              {contact.cep && (
                <div>
                  <p className="text-xs text-neutral-500">CEP</p>
                  <p className="text-sm font-medium text-neutral-900">{contact.cep}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Presença Digital */}
        {(contact.website || contact.instagram) && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Presença Digital</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contact.website && (
                <div>
                  <p className="text-xs text-neutral-500">Website</p>
                  <p className="text-sm font-medium text-neutral-900">{contact.website}</p>
                </div>
              )}
              {contact.instagram && (
                <div>
                  <p className="text-xs text-neutral-500">Instagram</p>
                  <p className="text-sm font-medium text-neutral-900">{contact.instagram}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Produtos */}
        {contact.produtos_fornecidos && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-1">Produtos Fornecidos</p>
            <p className="text-sm text-neutral-700">{contact.produtos_fornecidos}</p>
          </div>
        )}

        {/* Observações */}
        {contact.notes && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-1">Observações</p>
            <p className="text-sm text-neutral-700">{contact.notes}</p>
          </div>
        )}
      </div>

      {/* Interactions */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-neutral-900">Interações</h2>
            <span className="text-xs text-neutral-400">{interactions.length} interações</span>
          </div>
          <button
            onClick={() => setShowInteractionForm(!showInteractionForm)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            + Nova Interação
          </button>
        </div>

        {/* Filter */}
        <div className="mb-4">
          <select
            value={interactionFilter}
            onChange={(e) => setInteractionFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
          >
            <option value="all">Todos os tipos</option>
            {Object.entries(INTERACTION_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {showInteractionForm && (
          <form onSubmit={handleAddInteraction} className="mb-6 p-4 bg-neutral-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Tipo</label>
                <select
                  value={newInteraction.type}
                  onChange={(e) => setNewInteraction({ ...newInteraction, type: e.target.value })}
                  className={selectClass}
                >
                  {Object.entries(INTERACTION_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Resultado</label>
                <select
                  value={newInteraction.outcome}
                  onChange={(e) => setNewInteraction({ ...newInteraction, outcome: e.target.value })}
                  className={selectClass}
                >
                  {Object.entries(INTERACTION_OUTCOME_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-neutral-700 mb-1">Data/Hora</label>
              <input
                type="datetime-local"
                value={newInteraction.happened_at}
                onChange={(e) => setNewInteraction({ ...newInteraction, happened_at: e.target.value })}
                className={selectClass}
              />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-neutral-700 mb-1">Observações</label>
              <textarea
                rows={3}
                value={newInteraction.note}
                onChange={(e) => setNewInteraction({ ...newInteraction, note: e.target.value })}
                className={selectClass}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInteractionForm(false)}
                className="px-4 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors">
                Salvar
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {filteredInteractions.map((interaction) => (
            <div key={interaction.id} className="border-l-2 border-neutral-300 pl-4 py-2">
              {editingInteractionId === interaction.id ? (
                /* Edit inline form */
                <div className="p-3 bg-neutral-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Tipo</label>
                      <select
                        value={editInteractionData.type}
                        onChange={(e) => setEditInteractionData({ ...editInteractionData, type: e.target.value })}
                        className={selectClass}
                      >
                        {Object.entries(INTERACTION_TYPE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Resultado</label>
                      <select
                        value={editInteractionData.outcome}
                        onChange={(e) => setEditInteractionData({ ...editInteractionData, outcome: e.target.value })}
                        className={selectClass}
                      >
                        {Object.entries(INTERACTION_OUTCOME_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Data/Hora</label>
                    <input
                      type="datetime-local"
                      value={editInteractionData.happened_at}
                      onChange={(e) => setEditInteractionData({ ...editInteractionData, happened_at: e.target.value })}
                      className={selectClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Observações</label>
                    <textarea
                      rows={2}
                      value={editInteractionData.note}
                      onChange={(e) => setEditInteractionData({ ...editInteractionData, note: e.target.value })}
                      className={selectClass}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingInteractionId(null)}
                      disabled={interactionActionLoading}
                      className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveInteraction}
                      disabled={interactionActionLoading}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                    >
                      {interactionActionLoading ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Read-only view */
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {formatInteractionType(interaction.type)} — {formatInteractionOutcome(interaction.outcome)}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {new Date(interaction.happened_at).toLocaleString('pt-BR')} · {interaction.created_by_name}
                    </p>
                    {interaction.note && <p className="mt-1.5 text-sm text-neutral-600">{interaction.note}</p>}
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button
                      onClick={() => startEditInteraction(interaction)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded transition-colors"
                      title="Editar"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteInteractionId(interaction.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 rounded transition-colors"
                      title="Excluir"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filteredInteractions.length === 0 && (
            <p className="text-center text-sm text-neutral-400 py-6">
              {interactionFilter === 'all' ? 'Nenhuma interação registrada ainda' : 'Nenhuma interação deste tipo'}
            </p>
          )}
        </div>
      </div>

      {/* Delete contact modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Deletar contato"
        message={`Tem certeza que deseja deletar "${contact.name}"? Essa ação é irreversível e todas as interações serão removidas.`}
        variant="danger"
        confirmLabel="Deletar"
        loading={deleteLoading}
      />

      {/* Delete interaction modal */}
      <ConfirmModal
        isOpen={!!deleteInteractionId}
        onClose={() => setDeleteInteractionId(null)}
        onConfirm={handleDeleteInteraction}
        title="Excluir interação"
        message="Tem certeza que deseja excluir esta interação? Essa ação é irreversível."
        variant="danger"
        confirmLabel="Excluir"
        loading={interactionActionLoading}
      />
    </div>
  );
}
