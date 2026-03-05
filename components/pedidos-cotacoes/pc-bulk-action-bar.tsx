'use client';

import { useState } from 'react';

interface PcBulkActionBarProps {
  selectedCount: number;
  entityType: 'clients' | 'pedidos' | 'cotacoes';
  onChangeStatus: (value: string) => void;
  onDelete: () => void;
  onFinalize?: () => void;
  onExport: () => void;
  onCancel: () => void;
}

const STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  clients: [
    { value: 'SIM', label: 'Sim' },
    { value: 'NAO', label: 'Nao' },
    { value: 'AGUARDANDO_ACEITE', label: 'Aguardando Aceite' },
    { value: 'PRE_CADASTRO', label: 'Pre-Cadastro' },
  ],
  pedidos: [
    { value: 'PENDENTE', label: 'Pendente' },
    { value: 'ACEITO', label: 'Aceito' },
    { value: 'RECUSADO', label: 'Recusado' },
    { value: 'EM_ANDAMENTO', label: 'Em Andamento' },
    { value: 'FINALIZADO', label: 'Finalizado' },
  ],
  cotacoes: [
    { value: 'RESPONDEU', label: 'Respondeu' },
    { value: 'NAO_RESPONDEU', label: 'Nao Respondeu' },
  ],
};

export default function PcBulkActionBar({
  selectedCount,
  entityType,
  onChangeStatus,
  onDelete,
  onFinalize,
  onExport,
  onCancel,
}: PcBulkActionBarProps) {
  const [statusValue, setStatusValue] = useState('');

  if (selectedCount === 0) return null;

  const options = STATUS_OPTIONS[entityType] || [];

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-40 bg-[#120826] border-t border-purple-800/30 text-white px-6 py-3 flex items-center justify-between shadow-2xl">
      <span className="text-sm font-medium">
        {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <select
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value)}
            className="px-2 py-1.5 text-xs bg-[#1e0f35] border border-purple-800/30 rounded-lg text-white focus:outline-none"
          >
            <option value="">Alterar status...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {statusValue && (
            <button
              onClick={() => { onChangeStatus(statusValue); setStatusValue(''); }}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Aplicar
            </button>
          )}
        </div>
        {onFinalize && entityType === 'pedidos' && (
          <button
            onClick={onFinalize}
            className="px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-700 rounded-lg hover:bg-emerald-900/30 transition-colors"
          >
            Finalizar
          </button>
        )}
        <button
          onClick={onExport}
          className="px-3 py-1.5 text-xs font-medium border border-purple-800/30 rounded-lg hover:bg-purple-800/20 transition-colors"
        >
          Exportar
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-800 rounded-lg hover:bg-red-900/30 transition-colors"
        >
          Deletar
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs border border-purple-800/30 rounded-lg hover:bg-purple-800/20 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
