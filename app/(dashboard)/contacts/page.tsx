'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Contact } from '@/lib/types';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');

  useEffect(() => {
    loadContacts();
  }, [search, statusFilter, assignedFilter]);

  const loadContacts = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (assignedFilter !== 'all') params.set('assigned', assignedFilter);

    const res = await fetch(`/api/contacts?${params.toString()}`);
    const data = await res.json();
    setContacts(data.contacts || []);
    setLoading(false);
  };

  return (
    <div className="px-4 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-black">Contatos</h1>
        <div className="space-x-2">
          <Link
            href="/import"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Importar CSV
          </Link>
          <Link
            href="/contacts/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800"
          >
            + Novo Contato
          </Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Buscar por nome, email, telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
          >
            <option value="all">Todos os status</option>
            <option value="NOVO">Novo</option>
            <option value="EM_PROSPECCAO">Em Prospecção</option>
            <option value="CONTATADO">Contatado</option>
            <option value="REUNIAO_MARCADA">Reunião Marcada</option>
            <option value="CONVERTIDO">Convertido</option>
            <option value="PERDIDO">Perdido</option>
          </select>
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
          >
            <option value="all">Todos</option>
            <option value="me">Meus contatos</option>
            <option value="unassigned">Sem responsável</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Carregando...</div>
      ) : (
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/contacts/${contact.id}`} className="text-black hover:text-gray-600 font-medium">
                      {contact.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {contact.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {contact.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(contact.status)}`}>
                      {contact.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link href={`/contacts/${contact.id}`} className="text-black hover:text-gray-600 font-medium">
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {contacts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhum contato encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    NOVO: 'bg-gray-100 text-gray-800',
    EM_PROSPECCAO: 'bg-yellow-100 text-yellow-800',
    CONTATADO: 'bg-blue-100 text-blue-800',
    REUNIAO_MARCADA: 'bg-green-100 text-green-800',
    CONVERTIDO: 'bg-emerald-100 text-emerald-800',
    PERDIDO: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}
