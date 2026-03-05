'use client';

import { PcPedido } from '@/lib/types';
import {
  PC_PEDIDO_SITUACAO_LABELS,
  PC_PEDIDO_SITUACAO_COLORS,
  PC_PEDIDO_SITUACAO_BORDER_COLORS,
} from '@/lib/utils/labels';

interface PcPedidoCardProps {
  pedido: PcPedido;
  onEdit: (pedido: PcPedido) => void;
  onDelete: (id: string) => void;
  onFinalize: (id: string) => void;
  bulkMode?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
}

export default function PcPedidoCard({ pedido, onEdit, onDelete, onFinalize, bulkMode, selected, onToggle }: PcPedidoCardProps) {
  const borderColor = PC_PEDIDO_SITUACAO_BORDER_COLORS[pedido.situacao] || 'border-l-neutral-500';

  return (
    <div
      className={`bg-[#1e0f35] border border-purple-800/20 rounded-xl border-l-4 ${borderColor} p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        {bulkMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle?.(pedido.id)}
            className="mt-1 shrink-0 accent-emerald-500"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-bold text-white">#{pedido.pedido_numero}</span>
            <span className="text-sm text-neutral-300">{pedido.empresa}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                PC_PEDIDO_SITUACAO_COLORS[pedido.situacao] || 'bg-neutral-500/20 text-neutral-400'
              }`}
            >
              {PC_PEDIDO_SITUACAO_LABELS[pedido.situacao] || pedido.situacao}
            </span>
            {pedido.finalizado && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400">
                Finalizado
              </span>
            )}
            {pedido.cotacao_id && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400">
                Da Cotacao
              </span>
            )}
            {pedido.valor != null && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-cyan-500/20 text-cyan-400">
                R$ {Number(pedido.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
          {pedido.informe && (
            <p className="text-xs text-neutral-500 truncate max-w-md">{pedido.informe}</p>
          )}
          {pedido.prazo_entrega && (
            <p className="text-xs text-neutral-500 mt-0.5">
              Prazo: {new Date(pedido.prazo_entrega).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!pedido.finalizado && (
            <button
              onClick={() => onFinalize(pedido.id)}
              className="p-1.5 text-neutral-400 hover:text-emerald-400 transition-colors"
              title="Finalizar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onEdit(pedido)}
            className="p-1.5 text-neutral-400 hover:text-emerald-400 transition-colors"
            title="Editar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(pedido.id)}
            className="p-1.5 text-neutral-400 hover:text-red-400 transition-colors"
            title="Excluir"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
