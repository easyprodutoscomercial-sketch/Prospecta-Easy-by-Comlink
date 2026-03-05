'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PcPedido } from '@/lib/types';
import PcPedidoKanbanCard from './pc-pedido-kanban-card';

interface PcPedidoKanbanColumnProps {
  id: string;
  label: string;
  color: string;
  pedidos: PcPedido[];
  onEdit: (pedido: PcPedido) => void;
}

export default function PcPedidoKanbanColumn({ id, label, color, pedidos, onEdit }: PcPedidoKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[250px] w-[250px] bg-[#1e0f35] border border-purple-800/20 rounded-xl overflow-hidden ${
        isOver ? 'ring-2 ring-emerald-500/50' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-purple-800/20">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="text-xs text-neutral-500 ml-auto">{pedidos.length}</span>
      </div>

      {/* Cards */}
      <SortableContext items={pedidos.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[60vh] min-h-[100px]">
          {pedidos.length === 0 ? (
            <div className="text-xs text-neutral-600 text-center py-4">
              Sem pedidos
            </div>
          ) : (
            pedidos.map((pedido) => (
              <PcPedidoKanbanCard
                key={pedido.id}
                pedido={pedido}
                onEdit={onEdit}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
