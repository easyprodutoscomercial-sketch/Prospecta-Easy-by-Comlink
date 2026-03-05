'use client';

import { useState, useEffect, useCallback } from 'react';
import { PcPedido, PcPedidoSituacao } from '@/lib/types';
import { PC_PEDIDO_SITUACAO_LABELS } from '@/lib/utils/labels';
import PcPedidoCard from './pc-pedido-card';
import PcPedidoFormModal from './pc-pedido-form-modal';
import PcPedidosSpreadsheet from './pc-pedidos-spreadsheet';
import PcPedidosKanban from './pc-pedidos-kanban';
import { DateRangePicker } from '@/components/reports/date-range-picker';
import PcBulkActionBar from './pc-bulk-action-bar';

export default function PcPedidosTab() {
  const [pedidos, setPedidos] = useState<PcPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState<PcPedido | undefined>(undefined);
  const [finalizadosExpanded, setFinalizadosExpanded] = useState(false);
    const [spreadsheetMode, setSpreadsheetMode] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
            if (situacaoFilter) params.set('situacao', situacaoFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/pedidos-cotacoes/pedidos?${params}`);
      if (!res.ok) throw new Error('Failed to fetch pedidos');
      const data = await res.json();
      setPedidos(data.pedidos ?? data.data ?? data ?? []);
    } catch (err) {
      console.error('Error fetching pedidos:', err);
    } finally {
      setLoading(false);
    }
  }, [search, situacaoFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  const handleCreate = () => {
    setEditingPedido(undefined);
    setModalOpen(true);
  };

  const handleEdit = (pedido: PcPedido) => {
    setEditingPedido(pedido);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este pedido?')) return;
    try {
      const res = await fetch(`/api/pedidos-cotacoes/pedidos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchPedidos();
    } catch (err) {
      console.error('Error deleting pedido:', err);
    }
  };

  const handleFinalize = async (id: string) => {
    try {
      const res = await fetch(`/api/pedidos-cotacoes/pedidos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalizado: true }),
      });
      if (!res.ok) throw new Error('Failed to finalize');
      fetchPedidos();
    } catch (err) {
      console.error('Error finalizing pedido:', err);
    }
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditingPedido(undefined);
    fetchPedidos();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Deletar ${selectedIds.size} pedido(s)?`)) return;
    try {
      const res = await fetch('/api/pedidos-cotacoes/pedidos/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error('Bulk delete failed');
      setSelectedIds(new Set());
      setBulkMode(false);
      fetchPedidos();
    } catch (err) {
      console.error('Error bulk deleting:', err);
    }
  };

  const handleBulkStatus = async (situacao: string) => {
    try {
      const res = await fetch('/api/pedidos-cotacoes/pedidos/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_status', ids: Array.from(selectedIds), situacao }),
      });
      if (!res.ok) throw new Error('Bulk status failed');
      setSelectedIds(new Set());
      setBulkMode(false);
      fetchPedidos();
    } catch (err) {
      console.error('Error bulk status:', err);
    }
  };

  const handleBulkFinalize = async () => {
    if (!confirm(`Finalizar ${selectedIds.size} pedido(s)?`)) return;
    try {
      const res = await fetch('/api/pedidos-cotacoes/pedidos/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finalize', ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error('Bulk finalize failed');
      setSelectedIds(new Set());
      setBulkMode(false);
      fetchPedidos();
    } catch (err) {
      console.error('Error bulk finalizing:', err);
    }
  };

  const ativos = pedidos.filter((p) => !p.finalizado);
  const finalizados = pedidos.filter((p) => p.finalizado);

  const situacaoOptions: PcPedidoSituacao[] = ['PENDENTE', 'ACEITO', 'RECUSADO', 'EM_ANDAMENTO', 'FINALIZADO'];

  if (spreadsheetMode) {
    return (
      <PcPedidosSpreadsheet
        onClose={() => setSpreadsheetMode(false)}
        onSaved={() => {
          setSpreadsheetMode(false);
          fetchPedidos();
        }}
      />
    );
  }

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
            placeholder="Buscar pedido, empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
          />
        </div>
        <select
          value={situacaoFilter}
          onChange={(e) => setSituacaoFilter(e.target.value)}
          className="px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
        >
          <option value="">Todas Situacoes</option>
          {situacaoOptions.map((s) => (
            <option key={s} value={s}>
              {PC_PEDIDO_SITUACAO_LABELS[s]}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg border border-purple-800/30 overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-xs font-medium ${viewMode === 'list' ? 'bg-emerald-500/15 text-emerald-400' : 'text-neutral-400 hover:text-neutral-300'}`}
          >
            Lista
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-2 text-xs font-medium ${viewMode === 'kanban' ? 'bg-emerald-500/15 text-emerald-400' : 'text-neutral-400 hover:text-neutral-300'}`}
          >
            Kanban
          </button>
        </div>
        <button
          onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border ${
            bulkMode ? 'bg-amber-500/15 text-amber-400 border-amber-600/50' : 'border-purple-800/30 text-neutral-300 hover:bg-purple-800/20'
          }`}
        >
          Selecionar
        </button>
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (situacaoFilter) params.set('situacao', situacaoFilter);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            window.open(`/api/pedidos-cotacoes/pedidos/export?${params}`, '_blank');
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
          onClick={() => setSpreadsheetMode(true)}
          className="flex items-center gap-2 border border-emerald-600/50 hover:bg-emerald-600/10 text-emerald-400 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
          title="Inserir via planilha"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18M9 6v12M15 6v12" />
          </svg>
          Planilha
        </button>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Pedido
        </button>
      </div>
      <DateRangePicker
        from={dateFrom}
        to={dateTo}
        onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
      />

      {/* Kanban View */}
      {viewMode === 'kanban' ? (
        <PcPedidosKanban pedidos={pedidos} onEdit={handleEdit} onRefresh={fetchPedidos} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#1e0f35] border border-purple-800/20 rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-purple-800/20 rounded w-1/3 mb-3" />
              <div className="h-4 bg-purple-800/20 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Pedidos Ativos */}
          <div>
            <h3 className="text-sm font-medium text-neutral-300 mb-3">
              Pedidos Ativos ({ativos.length})
            </h3>
            {ativos.length === 0 ? (
              <div className="bg-[#1e0f35] border border-purple-800/20 rounded-xl p-8 text-center">
                <p className="text-neutral-500 text-sm">Nenhum pedido ativo</p>
                <button
                  onClick={handleCreate}
                  className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                >
                  Criar primeiro pedido
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {ativos.map((pedido) => (
                  <PcPedidoCard
                    key={pedido.id}
                    pedido={pedido}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onFinalize={handleFinalize}
                    bulkMode={bulkMode}
                    selected={selectedIds.has(pedido.id)}
                    onToggle={toggleSelect}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pedidos Finalizados */}
          {finalizados.length > 0 && (
            <div>
              <button
                onClick={() => setFinalizadosExpanded(!finalizadosExpanded)}
                className="flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-neutral-300 mb-3"
              >
                {finalizadosExpanded ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                Pedidos Finalizados ({finalizados.length})
              </button>

              {finalizadosExpanded && (
                <div className="space-y-3">
                  {finalizados.map((pedido) => (
                    <PcPedidoCard
                      key={pedido.id}
                      pedido={pedido}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onFinalize={handleFinalize}
                      bulkMode={bulkMode}
                      selected={selectedIds.has(pedido.id)}
                      onToggle={toggleSelect}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      <PcPedidoFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingPedido(undefined);
        }}
        onSaved={handleSaved}
        pedido={editingPedido}
      />

      {/* Bulk Action Bar */}
      <PcBulkActionBar
        selectedCount={selectedIds.size}
        entityType="pedidos"
        onChangeStatus={handleBulkStatus}
        onDelete={handleBulkDelete}
        onFinalize={handleBulkFinalize}
        onExport={() => {
          const params = new URLSearchParams();
          if (search) params.set('search', search);
          if (situacaoFilter) params.set('situacao', situacaoFilter);
          if (dateFrom) params.set('date_from', dateFrom);
          if (dateTo) params.set('date_to', dateTo);
          window.open(`/api/pedidos-cotacoes/pedidos/export?${params}`, '_blank');
        }}
        onCancel={() => { setBulkMode(false); setSelectedIds(new Set()); }}
      />
    </div>
  );
}
