'use client';

import { DragOverlay } from '@dnd-kit/core';
import type { SupportTicket } from '@/lib/types';
import { SUPPORT_KANBAN_COLUMNS } from '@/lib/utils/labels';
import { SuporteKanbanColumn } from './suporte-kanban-column';
import { SuporteKanbanCard } from './suporte-kanban-card';

interface SuporteKanbanBoardProps {
  tickets: SupportTicket[];
  activeTicket: SupportTicket | null;
}

export function SuporteKanbanBoard({ tickets, activeTicket }: SuporteKanbanBoardProps) {
  const grouped: Record<string, SupportTicket[]> = {};
  SUPPORT_KANBAN_COLUMNS.forEach((col) => { grouped[col.id] = []; });
  tickets.forEach((ticket) => {
    if (grouped[ticket.status]) {
      grouped[ticket.status].push(ticket);
    }
  });

  return (
    <>
      <div
        className="flex gap-2.5 overflow-x-auto pb-4 min-h-0 h-full"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${SUPPORT_KANBAN_COLUMNS.length}, minmax(0, 1fr))` }}
      >
        {SUPPORT_KANBAN_COLUMNS.map((col) => (
          <SuporteKanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            color={col.color}
            tickets={grouped[col.id] || []}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTicket ? <SuporteKanbanCard ticket={activeTicket} overlay /> : null}
      </DragOverlay>
    </>
  );
}
