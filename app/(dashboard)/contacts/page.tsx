'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Contact } from '@/lib/types';
import { formatStatus, getStatusColor, CONTACT_TYPE_LABELS, CONTACT_TYPE_COLORS } from '@/lib/utils/labels';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const abortRef = useRef<AbortController | null>(null);

  // Debounce search input (400ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadContacts();
  }, [debouncedSearch, statusFilter, tipoFilter, assignedFilter]);

  const loadContacts = async () => {
    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (tipoFilter !== 'all') params.set('tipo', tipoFilter);
    if (assignedFilter !== 'all') params.set('assigned', assignedFilter);

    try {
      const res = await fetch(`/api/contacts?${params.toString()}`, { signal: controller.signal });
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Contatos</h1>
        <div className="flex gap-2">
          <Link
            href="/import"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Importar CSV
          </Link>
          <Link
            href="/contacts/new"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            + Novo Contato
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Buscar por nome, email, telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
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
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
          >
            <option value="all">Todos os tipos</option>
            <option value="FORNECEDOR">Fornecedor</option>
            <option value="COMPRADOR">Comprador</option>
          </select>
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
          >
            <option value="all">Todos</option>
            <option value="me">Meus contatos</option>
            <option value="unassigned">Sem responsável</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-neutral-500">Carregando...</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Nome</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Tipo</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Empresa</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Email</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Telefone</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-100">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-5 py-3 whitespace-nowrap">
                    <Link href={`/contacts/${contact.id}`} className="text-sm font-medium text-neutral-900 hover:underline">
                      {contact.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex gap-1">
                      {contact.tipo && contact.tipo.length > 0 ? (
                        contact.tipo.map((t) => (
                          <span key={t} className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${CONTACT_TYPE_COLORS[t] || 'bg-neutral-100 text-neutral-600'}`}>
                            {CONTACT_TYPE_LABELS[t] || t}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-neutral-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-neutral-500">
                    {contact.company || '-'}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-neutral-500">
                    {contact.email || '-'}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-neutral-500">
                    {contact.phone || '-'}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(contact.status)}`}>
                      {formatStatus(contact.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <Link href={`/contacts/${contact.id}`} className="text-xs text-neutral-500 hover:text-neutral-900 font-medium">
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {contacts.length === 0 && (
            <div className="text-center py-12 text-sm text-neutral-500">
              Nenhum contato encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}
