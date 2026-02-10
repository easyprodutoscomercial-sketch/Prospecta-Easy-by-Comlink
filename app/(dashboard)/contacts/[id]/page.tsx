'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Contact, Interaction } from '@/lib/types';

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
    await fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadContact();
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
    await fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: id,
        ...newInteraction,
      }),
    });
    setNewInteraction({ type: 'LIGACAO', outcome: 'SEM_RESPOSTA', note: '' });
    setShowInteractionForm(false);
    loadContact();
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
      <div className="border border-neutral-200 rounded-lg p-5 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">{contact.name}</h1>
            {contact.company && <p className="text-sm text-neutral-500 mt-0.5">{contact.company}</p>}
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
        </div>

        {contact.notes && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-1">Observações</p>
            <p className="text-sm text-neutral-700">{contact.notes}</p>
          </div>
        )}
      </div>

      {/* Interactions */}
      <div className="border border-neutral-200 rounded-lg p-5">
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
                  <option value="LIGACAO">Ligação</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                  <option value="REUNIAO">Reunião</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Resultado</label>
                <select
                  value={newInteraction.outcome}
                  onChange={(e) => setNewInteraction({ ...newInteraction, outcome: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                >
                  <option value="SEM_RESPOSTA">Sem Resposta</option>
                  <option value="RESPONDEU">Respondeu</option>
                  <option value="REUNIAO_MARCADA">Reunião Marcada</option>
                  <option value="NAO_INTERESSADO">Não Interessado</option>
                  <option value="CONVERTIDO">Convertido</option>
                  <option value="SEGUIR_TENTANDO">Seguir Tentando</option>
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
                    {formatType(interaction.type)} — {formatOutcome(interaction.outcome)}
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

function formatType(type: string) {
  const labels: Record<string, string> = {
    LIGACAO: 'Ligação',
    WHATSAPP: 'WhatsApp',
    EMAIL: 'Email',
    REUNIAO: 'Reunião',
    OUTRO: 'Outro',
  };
  return labels[type] || type;
}

function formatOutcome(outcome: string) {
  const labels: Record<string, string> = {
    SEM_RESPOSTA: 'Sem Resposta',
    RESPONDEU: 'Respondeu',
    REUNIAO_MARCADA: 'Reunião Marcada',
    NAO_INTERESSADO: 'Não Interessado',
    CONVERTIDO: 'Convertido',
    SEGUIR_TENTANDO: 'Seguir Tentando',
  };
  return labels[outcome] || outcome;
}
