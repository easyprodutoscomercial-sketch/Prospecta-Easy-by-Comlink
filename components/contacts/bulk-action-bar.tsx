'use client';

import { useState } from 'react';

interface BulkActionBarProps {
  selectedCount: number;
  onChangeStatus: (status: string) => void;
  onDelete?: () => void;
  onExport: () => void;
  onCancel: () => void;
}

export default function BulkActionBar({
  selectedCount,
  onChangeStatus,
  onDelete,
  onExport,
  onCancel,
}: BulkActionBarProps) {
  const [statusValue, setStatusValue] = useState('');

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-40 bg-neutral-900 text-white px-6 py-3 flex items-center justify-between shadow-2xl">
      <span className="text-sm font-medium">{selectedCount} selecionado{selectedCount > 1 ? 's' : ''}</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <select
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value)}
            className="px-2 py-1.5 text-xs bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none"
          >
            <option value="">Alterar status...</option>
            <option value="NOVO">Novo</option>
            <option value="EM_PROSPECCAO">Em Prospecção</option>
            <option value="CONTATADO">Contatado</option>
            <option value="REUNIAO_MARCADA">Reunião Marcada</option>
            <option value="CONVERTIDO">Convertido</option>
            <option value="PERDIDO">Perdido</option>
          </select>
          {statusValue && (
            <button
              onClick={() => { onChangeStatus(statusValue); setStatusValue(''); }}
              className="px-3 py-1.5 text-xs font-medium bg-white text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              Aplicar
            </button>
          )}
        </div>
        <button
          onClick={onExport}
          className="px-3 py-1.5 text-xs font-medium border border-neutral-600 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          Exportar
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-800 rounded-lg hover:bg-red-900/30 transition-colors"
          >
            Deletar
          </button>
        )}
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs border border-neutral-600 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
