'use client';

import { useState, useEffect, useCallback } from 'react';
import { PcCotacao, PcCotacaoResposta } from '@/lib/types';
import { PC_COTACAO_RESPOSTA_LABELS } from '@/lib/utils/labels';
import PcCotacaoGroupCard from './pc-cotacao-group-card';
import PcCotacaoFormModal from './pc-cotacao-form-modal';
import PcCotacoesSpreadsheet from './pc-cotacoes-spreadsheet';
import { DateRangePicker } from '@/components/reports/date-range-picker';
import PcPedidoFormModal from './pc-pedido-form-modal';
import PcCotacaoComparisonModal from './pc-cotacao-comparison-modal';
import PcBulkActionBar from './pc-bulk-action-bar';

interface CotacaoGroup {
  cotacao_numero: string;
  cotacao_nome: string | null;
  cotacoes: PcCotacao[];
}

export default function PcCotacoesTab() {
  const [groups, setGroups] = useState<CotacaoGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [respostaFilter, setRespostaFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCotacao, setEditingCotacao] = useState<PcCotacao | undefined>(undefined);
  const [spreadsheetMode, setSpreadsheetMode] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [comparisonGroup, setComparisonGroup] = useState<CotacaoGroup | null>(null);
  const [convertingCotacao, setConvertingCotacao] = useState<PcCotacao | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchCotacoes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ group_by: 'cotacao_numero' });
      if (search) params.set('search', search);
      if (respostaFilter) params.set('resposta', respostaFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/pedidos-cotacoes/cotacoes?${params}`);
      if (!res.ok) throw new Error('Failed to fetch cotacoes');
      const data = await res.json();
      setGroups(data.groups ?? data ?? []);
    } catch (err) {
      console.error('Error fetching cotacoes:', err);
    } finally {
      setLoading(false);
    }
  }, [search, respostaFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchCotacoes();
  }, [fetchCotacoes]);

  const handleCreate = () => {
    setEditingCotacao(undefined);
    setModalOpen(true);
  };

  const handleEdit = (cotacao: PcCotacao) => {
    setEditingCotacao(cotacao);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta cotacao?')) return;
    try {
      const res = await fetch(`/api/pedidos-cotacoes/cotacoes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchCotacoes();
    } catch (err) {
      console.error('Error deleting cotacao:', err);
    }
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditingCotacao(undefined);
    fetchCotacoes();
  };

  const handleConvertToPedido = (cotacao: PcCotacao) => {
    setConvertingCotacao(cotacao);
  };

  const handleCompare = (group: CotacaoGroup) => {
    setComparisonGroup(group);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Deletar ${selectedIds.size} cotacao(oes)?`)) return;
    try {
      const res = await fetch('/api/pedidos-cotacoes/cotacoes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error('Bulk delete failed');
      setSelectedIds(new Set());
      setBulkMode(false);
      fetchCotacoes();
    } catch (err) {
      console.error('Error bulk deleting:', err);
    }
  };

  const handleBulkResposta = async (resposta: string) => {
    try {
      const res = await fetch('/api/pedidos-cotacoes/cotacoes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_resposta', ids: Array.from(selectedIds), resposta }),
      });
      if (!res.ok) throw new Error('Bulk resposta failed');
      setSelectedIds(new Set());
      setBulkMode(false);
      fetchCotacoes();
    } catch (err) {
      console.error('Error bulk resposta:', err);
    }
  };

  const respostaOptions: PcCotacaoResposta[] = ['RESPONDEU', 'NAO_RESPONDEU'];

  if (spreadsheetMode) {
    return (
      <PcCotacoesSpreadsheet
        onClose={() => setSpreadsheetMode(false)}
        onSaved={() => {
          setSpreadsheetMode(false);
          fetchCotacoes();
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
            placeholder="Buscar cotacao, fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
          />
        </div>
        <select
          value={respostaFilter}
          onChange={(e) => setRespostaFilter(e.target.value)}
          className="px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
        >
          <option value="">Todas Respostas</option>
          {respostaOptions.map((r) => (
            <option key={r} value={r}>
              {PC_COTACAO_RESPOSTA_LABELS[r]}
            </option>
          ))}
        </select>
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
            if (respostaFilter) params.set('resposta', respostaFilter);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            window.open(`/api/pedidos-cotacoes/cotacoes/export?${params}`, '_blank');
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
          Nova Cotacao
        </button>
      </div>
      <DateRangePicker
        from={dateFrom}
        to={dateTo}
        onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
      />

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#1e0f35] border border-purple-800/20 rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-purple-800/20 rounded w-1/3 mb-3" />
              <div className="h-4 bg-purple-800/20 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-[#1e0f35] border border-purple-800/20 rounded-xl p-8 text-center">
          <p className="text-neutral-500 text-sm">Nenhuma cotacao encontrada</p>
          <button
            onClick={handleCreate}
            className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
          >
            Criar primeira cotacao
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <PcCotacaoGroupCard
              key={group.cotacao_numero}
              cotacaoNumero={group.cotacao_numero}
              cotacaoNome={group.cotacao_nome}
              cotacoes={group.cotacoes}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onConvertToPedido={handleConvertToPedido}
              onCompare={() => handleCompare(group)}
              bulkMode={bulkMode}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <PcCotacaoFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCotacao(undefined);
        }}
        onSaved={handleSaved}
        cotacao={editingCotacao}
      />

      {/* Pedido from Cotacao Modal */}
      <PcPedidoFormModal
        isOpen={!!convertingCotacao}
        onClose={() => setConvertingCotacao(null)}
        onSaved={() => {
          setConvertingCotacao(null);
          fetchCotacoes();
        }}
        fromCotacao={convertingCotacao}
      />

      {/* Comparison Modal */}
      {comparisonGroup && (
        <PcCotacaoComparisonModal
          isOpen={!!comparisonGroup}
          onClose={() => setComparisonGroup(null)}
          cotacoes={comparisonGroup.cotacoes}
          cotacaoNumero={comparisonGroup.cotacao_numero}
        />
      )}

      {/* Bulk Action Bar */}
      <PcBulkActionBar
        selectedCount={selectedIds.size}
        entityType="cotacoes"
        onChangeStatus={handleBulkResposta}
        onDelete={handleBulkDelete}
        onExport={() => {
          const params = new URLSearchParams();
          if (search) params.set('search', search);
          if (respostaFilter) params.set('resposta', respostaFilter);
          if (dateFrom) params.set('date_from', dateFrom);
          if (dateTo) params.set('date_to', dateTo);
          window.open(`/api/pedidos-cotacoes/cotacoes/export?${params}`, '_blank');
        }}
        onCancel={() => { setBulkMode(false); setSelectedIds(new Set()); }}
      />
    </div>
  );
}
