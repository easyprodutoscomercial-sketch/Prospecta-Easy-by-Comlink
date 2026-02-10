'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Contact } from '@/lib/types';
import { formatStatus, getStatusColor, CONTACT_TYPE_LABELS, CONTACT_TYPE_COLORS } from '@/lib/utils/labels';
import Pagination from '@/components/ui/pagination';
import { SkeletonTable } from '@/components/ui/skeleton';
import BulkActionBar from '@/components/contacts/bulk-action-bar';
import ConfirmModal from '@/components/ui/confirm-modal';
import { useToast } from '@/lib/toast-context';

type SortField = 'name' | 'company' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function ContactsPage() {
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const abortRef = useRef<AbortController | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Debounce search input (400ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter/search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, tipoFilter, assignedFilter]);

  useEffect(() => {
    loadContacts();
  }, [debouncedSearch, statusFilter, tipoFilter, assignedFilter, page, sortBy, sortDir]);

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
    params.set('page', String(page));
    params.set('limit', String(limit));
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);

    try {
      const res = await fetch(`/api/contacts?${params.toString()}`, { signal: controller.signal });
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
    }
    setLoading(false);
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortBy !== field) return <span className="text-neutral-300 ml-1">&#8597;</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '&#8593;' : '&#8595;'}</span>;
  };

  // Selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Export CSV
  const handleExport = () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (tipoFilter !== 'all') params.set('tipo', tipoFilter);
    if (assignedFilter !== 'all') params.set('assigned', assignedFilter);
    window.open(`/api/contacts/export?${params.toString()}`, '_blank');
    toast.success('Exportação iniciada');
  };

  // Bulk status change
  const handleBulkStatusChange = async (status: string) => {
    setBulkLoading(true);
    const res = await fetch('/api/contacts/batch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds), status }),
    });
    if (res.ok) {
      toast.success(`Status atualizado para ${selectedIds.size} contatos`);
      clearSelection();
      loadContacts();
    } else {
      toast.error('Erro ao atualizar status em massa');
    }
    setBulkLoading(false);
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    setBulkLoading(true);
    const res = await fetch('/api/contacts/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    if (res.ok) {
      toast.success(`${selectedIds.size} contatos deletados`);
      clearSelection();
      setShowBulkDeleteModal(false);
      loadContacts();
    } else {
      toast.error('Erro ao deletar contatos em massa');
    }
    setBulkLoading(false);
  };

  // Bulk export selected
  const handleBulkExport = () => {
    // For selected items, just trigger the normal export (which exports based on filters)
    handleExport();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Contatos</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Exportar CSV
          </button>
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
        <SkeletonTable rows={8} cols={7} />
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={contacts.length > 0 && selectedIds.size === contacts.length}
                      onChange={toggleSelectAll}
                      className="rounded border-neutral-300"
                    />
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide cursor-pointer select-none hover:text-neutral-700"
                    onClick={() => handleSort('name')}
                  >
                    Nome <span dangerouslySetInnerHTML={{ __html: sortBy === 'name' ? (sortDir === 'asc' ? '&#8593;' : '&#8595;') : '&#8597;' }} />
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Tipo</th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide cursor-pointer select-none hover:text-neutral-700"
                    onClick={() => handleSort('company')}
                  >
                    Empresa <span dangerouslySetInnerHTML={{ __html: sortBy === 'company' ? (sortDir === 'asc' ? '&#8593;' : '&#8595;') : '&#8597;' }} />
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Telefone</th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide cursor-pointer select-none hover:text-neutral-700"
                    onClick={() => handleSort('status')}
                  >
                    Status <span dangerouslySetInnerHTML={{ __html: sortBy === 'status' ? (sortDir === 'asc' ? '&#8593;' : '&#8595;') : '&#8597;' }} />
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide cursor-pointer select-none hover:text-neutral-700"
                    onClick={() => handleSort('created_at')}
                  >
                    Data <span dangerouslySetInnerHTML={{ __html: sortBy === 'created_at' ? (sortDir === 'asc' ? '&#8593;' : '&#8595;') : '&#8597;' }} />
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-100">
                {contacts.map((contact) => (
                  <tr key={contact.id} className={`hover:bg-neutral-50 transition-colors ${selectedIds.has(contact.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(contact.id)}
                        onChange={() => toggleSelect(contact.id)}
                        className="rounded border-neutral-300"
                      />
                    </td>
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
                    <td className="px-5 py-3 whitespace-nowrap text-xs text-neutral-400">
                      {new Date(contact.created_at).toLocaleDateString('pt-BR')}
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

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onChangeStatus={handleBulkStatusChange}
        onDelete={() => setShowBulkDeleteModal(true)}
        onExport={handleBulkExport}
        onCancel={clearSelection}
      />

      {/* Bulk delete confirmation */}
      <ConfirmModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        title="Deletar contatos"
        message={`Tem certeza que deseja deletar ${selectedIds.size} contato${selectedIds.size > 1 ? 's' : ''}? Essa ação é irreversível.`}
        variant="danger"
        confirmLabel="Deletar"
        loading={bulkLoading}
      />
    </div>
  );
}
