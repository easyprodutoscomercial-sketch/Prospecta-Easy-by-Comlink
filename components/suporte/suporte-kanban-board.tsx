'use client';

import { DragOverlay } from '@dnd-kit/core';
import type { SupportTicket, PipelineStage } from '@/lib/types';
import { SUPPORT_KANBAN_COLUMNS } from '@/lib/utils/labels';
import { SuporteKanbanColumn } from './suporte-kanban-column';
import { SuporteKanbanCard } from './suporte-kanban-card';

interface SuporteKanbanBoardProps {
  tickets: SupportTicket[];
  activeTicket: SupportTicket | null;
  stages?: PipelineStage[];
}

export function SuporteKanbanBoard({ tickets, activeTicket, stages }: SuporteKanbanBoardProps) {
  // Use dynamic stages if available, fallback to static columns
  const columns = stages && stages.length > 0
    ? stages.map((s) => ({ id: s.id, label: s.name, color: s.color }))
    : SUPPORT_KANBAN_COLUMNS;

  const useStageId = stages && stages.length > 0;

  const terminalStageIds = new Set<string>();
  if (stages) {
    stages.forEach((s) => { if (s.is_terminal) terminalStageIds.add(s.id); });
  }

  const grouped: Record<string, SupportTicket[]> = {};
  columns.forEach((col) => { grouped[col.id] = []; });
  tickets.forEach((ticket) => {
    const key = useStageId ? (ticket.stage_id || '') : ticket.status;
    if (grouped[key]) {
      grouped[key].push(ticket);
    }
  });

  return (
    <>
      <div
        className="flex gap-2.5 overflow-x-auto pb-4 min-h-0 h-full"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))` }}
      >
        {columns.map((col) => (
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
        {activeTicket ? <SuporteKanbanCard ticket={activeTicket} overlay terminalStageIds={terminalStageIds} /> : null}
      </DragOverlay>
    </>
  );
}
