'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PcPedido } from '@/lib/types';
import { PC_PEDIDO_SITUACAO_COLORS, PC_PEDIDO_SITUACAO_LABELS } from '@/lib/utils/labels';

interface PcPedidoKanbanCardProps {
  pedido: PcPedido;
  onEdit: (pedido: PcPedido) => void;
}

export default function PcPedidoKanbanCard({ pedido, onEdit }: PcPedidoKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pedido.id, data: { pedido } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(pedido)}
      className="bg-[#120826] border border-purple-800/20 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-purple-800/40 transition-colors"
    >
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-xs font-bold text-white">#{pedido.pedido_numero}</span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            PC_PEDIDO_SITUACAO_COLORS[pedido.situacao] || 'bg-neutral-500/20 text-neutral-400'
          }`}
        >
          {PC_PEDIDO_SITUACAO_LABELS[pedido.situacao] || pedido.situacao}
        </span>
      </div>
      <p className="text-sm text-neutral-300 truncate">{pedido.empresa}</p>
      {pedido.valor != null && (
        <p className="text-xs text-cyan-400 mt-1">
          R$ {Number(pedido.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      )}
    </div>
  );
}
