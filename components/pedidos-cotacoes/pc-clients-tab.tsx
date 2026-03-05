'use client';

import { useState, useEffect, useCallback } from 'react';
import { PcClient, PcClientStatus } from '@/lib/types';
import { PC_CLIENT_STATUS_LABELS, PC_CLIENT_STATUS_COLORS } from '@/lib/utils/labels';
import PcClientFormModal from './pc-client-form-modal';
import { DateRangePicker } from '@/components/reports/date-range-picker';
import PcClientDrawer from './pc-client-drawer';
import PcBulkActionBar from './pc-bulk-action-bar';

const PAGE_SIZE = 15;

export default function PcClientsTab() {
  const [clients, setClients] = useState<PcClient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<PcClient | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [drawerClientId, setDrawerClientId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status_sac', statusFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/pedidos-cotacoes/clients?${params}`);
      if (!res.ok) throw new Error('Failed to fetch clients');
      const data = await res.json();
      setClients(data.clients ?? data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateFrom, dateTo]);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/pedidos-cotacoes/clients/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchClients();
    } catch (err) {
      console.error('Error deleting client:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (client: PcClient) => {
    setEditingClient(client);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingClient(undefined);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditingClient(undefined);
    fetchClients();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Deletar ${selectedIds.size} cliente(s)?`)) return;
    try {
      const res = await fetch('/api/pedidos-cotacoes/clients/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error('Bulk delete failed');
      setSelectedIds(new Set());
      setBulkMode(false);
      fetchClients();
    } catch (err) {
      console.error('Error bulk deleting:', err);
    }
  };

  const handleBulkStatus = async (status: string) => {
    try {
      const res = await fetch('/api/pedidos-cotacoes/clients/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_status', ids: Array.from(selectedIds), status }),
      });
      if (!res.ok) throw new Error('Bulk status failed');
      setSelectedIds(new Set());
      setBulkMode(false);
      fetchClients();
    } catch (err) {
      console.error('Error bulk status:', err);
    }
  };

  const statusOptions: PcClientStatus[] = ['SIM', 'NAO', 'AGUARDANDO_ACEITE', 'PRE_CADASTRO'];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar fornecedor, CNPJ, contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
        >
          <option value="">Todos os Status</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {PC_CLIENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (statusFilter) params.set('status_sac', statusFilter);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            window.open(`/api/pedidos-cotacoes/clients/export?${params}`, '_blank');
          }}
          className="flex items-center gap-2 border border-purple-800/30 hover:bg-purple-800/20 text-neutral-300 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
          title="Exportar Excel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar
        </button>
        <button
          onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border ${
            bulkMode ? 'bg-amber-500/15 text-amber-400 border-amber-600/50' : 'border-purple-800/30 text-neutral-300 hover:bg-purple-800/20'
          }`}
        >
          Selecionar
        </button>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Cliente
        </button>
      </div>
      <DateRangePicker
        from={dateFrom}
        to={dateTo}
        onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
      />

      {/* Table */}
      <div className="bg-[#1e0f35] border border-purple-800/20 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-purple-800/20">
                {bulkMode && (
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === clients.length && clients.length > 0}
                      onChange={() => {
                        if (selectedIds.size === clients.length) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(clients.map((c) => c.id)));
                        }
                      }}
                      className="accent-emerald-500"
                    />
                  </th>
                )}
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                  Fornecedor
                </th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                  CNPJ
                </th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                  Contato
                </th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                  Email
                </th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                  Status SAC
                </th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-purple-800/10">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-purple-800/20 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={bulkMode ? 7 : 6} className="px-4 py-8 text-center text-neutral-500 text-sm">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-purple-800/10 hover:bg-purple-800/10 cursor-pointer"
                    onClick={() => setDrawerClientId(client.id)}
                  >
                    {bulkMode && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(client.id)}
                          onChange={() => toggleSelect(client.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-emerald-500"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-neutral-300 font-medium">
                      {client.fornecedor}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300">
                      {client.cnpj || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300">
                      {client.contato || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300">
                      {client.email || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          PC_CLIENT_STATUS_COLORS[client.status_sac] || 'bg-neutral-500/20 text-neutral-400'
                        }`}
                      >
                        {PC_CLIENT_STATUS_LABELS[client.status_sac] || client.status_sac}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleEdit(client)}
                          className="p-1.5 text-neutral-400 hover:text-emerald-400 transition-colors"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(client.id)}
                          disabled={deletingId === client.id}
                          className="p-1.5 text-neutral-400 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Excluir"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-purple-800/20">
            <p className="text-xs text-neutral-500">
              {total} cliente{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm text-neutral-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <PcClientFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingClient(undefined);
        }}
        onSaved={handleSaved}
        client={editingClient}
      />

      {/* Drawer 360 */}
      <PcClientDrawer
        clientId={drawerClientId}
        onClose={() => setDrawerClientId(null)}
        onEdit={(client) => {
          setDrawerClientId(null);
          handleEdit(client);
        }}
      />

      {/* Bulk Action Bar */}
      <PcBulkActionBar
        selectedCount={selectedIds.size}
        entityType="clients"
        onChangeStatus={handleBulkStatus}
        onDelete={handleBulkDelete}
        onExport={() => {
          const params = new URLSearchParams();
          if (search) params.set('search', search);
          if (statusFilter) params.set('status_sac', statusFilter);
          if (dateFrom) params.set('date_from', dateFrom);
          if (dateTo) params.set('date_to', dateTo);
          window.open(`/api/pedidos-cotacoes/clients/export?${params}`, '_blank');
        }}
        onCancel={() => { setBulkMode(false); setSelectedIds(new Set()); }}
      />
    </div>
  );
}
