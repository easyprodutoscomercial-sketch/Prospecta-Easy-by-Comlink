'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { PcPedido } from '@/lib/types';
import { PC_PEDIDO_KANBAN_COLUMNS } from '@/lib/utils/labels';
import PcPedidoKanbanColumn from './pc-pedido-kanban-column';
import PcPedidoKanbanCard from './pc-pedido-kanban-card';

interface PcPedidosKanbanProps {
  pedidos: PcPedido[];
  onEdit: (pedido: PcPedido) => void;
  onRefresh: () => void;
}

export default function PcPedidosKanban({ pedidos, onEdit, onRefresh }: PcPedidosKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const activePedido = activeId ? pedidos.find((p) => p.id === activeId) : null;

  // Group pedidos by situacao, mapping finalizado to FINALIZADO column
  const getColumnId = (p: PcPedido) => {
    if (p.finalizado) return 'FINALIZADO';
    return p.situacao;
  };

  const groupedPedidos: Record<string, PcPedido[]> = {};
  PC_PEDIDO_KANBAN_COLUMNS.forEach((col) => {
    groupedPedidos[col.id] = [];
  });
  pedidos.forEach((p) => {
    const colId = getColumnId(p);
    if (groupedPedidos[colId]) {
      groupedPedidos[colId].push(p);
    }
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const pedidoId = String(active.id);
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return;

    // Determine target column
    let targetColumn = String(over.id);

    // If dropped on a card, find which column that card is in
    if (!PC_PEDIDO_KANBAN_COLUMNS.find((c) => c.id === targetColumn)) {
      const overPedido = pedidos.find((p) => p.id === targetColumn);
      if (overPedido) {
        targetColumn = getColumnId(overPedido);
      } else {
        return;
      }
    }

    const currentColumn = getColumnId(pedido);
    if (currentColumn === targetColumn) return;

    // Build update body
    const body: any = {};
    if (targetColumn === 'FINALIZADO') {
      body.finalizado = true;
      body.situacao = pedido.situacao === 'FINALIZADO' ? 'ACEITO' : pedido.situacao;
    } else {
      body.situacao = targetColumn;
      body.finalizado = false;
    }

    try {
      const res = await fetch(`/api/pedidos-cotacoes/pedidos/${pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update');
      onRefresh();
    } catch (err) {
      console.error('Error updating pedido via kanban:', err);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PC_PEDIDO_KANBAN_COLUMNS.map((col) => (
          <PcPedidoKanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            color={col.color}
            pedidos={groupedPedidos[col.id] || []}
            onEdit={onEdit}
          />
        ))}
      </div>

      <DragOverlay>
        {activePedido ? (
          <PcPedidoKanbanCard pedido={activePedido} onEdit={() => {}} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
