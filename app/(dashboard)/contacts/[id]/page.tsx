'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { Contact, Interaction } from '@/lib/types';

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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

  if (loading) return <div className="text-center py-8">Carregando...</div>;
  if (!contact) return <div className="text-center py-8">Contato não encontrado</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-0">
      <div className="mb-6">
        <Link href="/contacts" className="text-black hover:text-gray-600 font-medium">
          ← Voltar para contatos
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-black">{contact.name}</h1>
            {contact.company && <p className="text-gray-600">{contact.company}</p>}
          </div>
          <select
            value={contact.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
          >
            <option value="NOVO">Novo</option>
            <option value="EM_PROSPECCAO">Em Prospecção</option>
            <option value="CONTATADO">Contatado</option>
            <option value="REUNIAO_MARCADA">Reunião Marcada</option>
            <option value="CONVERTIDO">Convertido</option>
            <option value="PERDIDO">Perdido</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {contact.email && (
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-medium text-black">{contact.email}</p>
            </div>
          )}
          {contact.phone && (
            <div>
              <p className="text-sm text-gray-600">Telefone</p>
              <p className="font-medium text-black">{contact.phone}</p>
            </div>
          )}
          {contact.cpf && (
            <div>
              <p className="text-sm text-gray-600">CPF</p>
              <p className="font-medium text-black">{contact.cpf}</p>
            </div>
          )}
          {contact.cnpj && (
            <div>
              <p className="text-sm text-gray-600">CNPJ</p>
              <p className="font-medium text-black">{contact.cnpj}</p>
            </div>
          )}
        </div>

        {contact.notes && (
          <div>
            <p className="text-sm text-gray-600 mb-1">Observações</p>
            <p className="text-black">{contact.notes}</p>
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-black">Interações</h2>
          <button
            onClick={() => setShowInteractionForm(!showInteractionForm)}
            className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800"
          >
            + Nova Interação
          </button>
        </div>

        {showInteractionForm && (
          <form onSubmit={handleAddInteraction} className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select
                  value={newInteraction.type}
                  onChange={(e) => setNewInteraction({ ...newInteraction, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                >
                  <option value="LIGACAO">Ligação</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                  <option value="REUNIAO">Reunião</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Resultado</label>
                <select
                  value={newInteraction.outcome}
                  onChange={(e) => setNewInteraction({ ...newInteraction, outcome: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
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
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea
                rows={3}
                value={newInteraction.note}
                onChange={(e) => setNewInteraction({ ...newInteraction, note: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowInteractionForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800">
                Salvar
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {interactions.map((interaction) => (
            <div key={interaction.id} className="border-l-4 border-black pl-4 py-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-black">
                    {interaction.type.replace(/_/g, ' ')} - {interaction.outcome.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(interaction.happened_at).toLocaleString('pt-BR')} - {interaction.created_by_name}
                  </p>
                  {interaction.note && <p className="mt-2 text-gray-700">{interaction.note}</p>}
                </div>
              </div>
            </div>
          ))}
          {interactions.length === 0 && (
            <p className="text-center text-gray-500 py-4">Nenhuma interação registrada ainda</p>
          )}
        </div>
      </div>
    </div>
  );
}
