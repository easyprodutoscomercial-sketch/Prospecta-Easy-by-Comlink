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

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [newInteraction, setNewInteraction] = useState({
    type: 'LIGACAO' as const,
    outcome: 'SEM_RESPOSTA' as const,
    note: '',
  });

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
  };

  const handleDelete = async () => {
    if (!confirm(`Deletar "${contact?.name}"? Essa ação é irreversível.`)) return;
    const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/contacts');
    } else {
      alert('Erro ao deletar contato');
    }
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: id,
        ...newInteraction,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setInteractions((prev) => [created, ...prev]);
    }
    setNewInteraction({ type: 'LIGACAO', outcome: 'SEM_RESPOSTA', note: '' });
    setShowInteractionForm(false);
  };

  if (loading) return <div className="text-center py-12 text-sm text-neutral-500">Carregando...</div>;
  if (!contact) return <div className="text-center py-12 text-sm text-neutral-500">Contato não encontrado</div>;

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
              onClick={handleDelete}
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
          <h2 className="text-sm font-medium text-neutral-900">Interações</h2>
          <button
            onClick={() => setShowInteractionForm(!showInteractionForm)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            + Nova Interação
          </button>
        </div>

        {showInteractionForm && (
          <form onSubmit={handleAddInteraction} className="mb-6 p-4 bg-neutral-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Tipo</label>
                <select
                  value={newInteraction.type}
                  onChange={(e) => setNewInteraction({ ...newInteraction, type: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
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
                  onChange={(e) => setNewInteraction({ ...newInteraction, outcome: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                >
                  {Object.entries(INTERACTION_OUTCOME_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-neutral-700 mb-1">Observações</label>
              <textarea
                rows={3}
                value={newInteraction.note}
                onChange={(e) => setNewInteraction({ ...newInteraction, note: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
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
          {interactions.map((interaction) => (
            <div key={interaction.id} className="border-l-2 border-neutral-300 pl-4 py-2">
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
              </div>
            </div>
          ))}
          {interactions.length === 0 && (
            <p className="text-center text-sm text-neutral-400 py-6">Nenhuma interação registrada ainda</p>
          )}
        </div>
      </div>
    </div>
  );
}
