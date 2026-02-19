'use client';

import { DragOverlay } from '@dnd-kit/core';
import type { BugReport } from '@/lib/types';
import { BUG_KANBAN_COLUMNS } from '@/lib/utils/labels';
import { BugKanbanColumn } from './bug-kanban-column';
import { BugKanbanCard } from './bug-kanban-card';

interface BugKanbanBoardProps {
  bugs: BugReport[];
  activeBug: BugReport | null;
}

export function BugKanbanBoard({ bugs, activeBug }: BugKanbanBoardProps) {
  const grouped: Record<string, BugReport[]> = {};
  BUG_KANBAN_COLUMNS.forEach((col) => { grouped[col.id] = []; });
  bugs.forEach((bug) => {
    if (grouped[bug.status]) {
      grouped[bug.status].push(bug);
    }
  });

  return (
    <>
      <div
        className="flex gap-2.5 overflow-x-auto pb-4 min-h-0 h-full"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${BUG_KANBAN_COLUMNS.length}, minmax(0, 1fr))` }}
      >
        {BUG_KANBAN_COLUMNS.map((col) => (
          <BugKanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            color={col.color}
            bugs={grouped[col.id] || []}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeBug ? <BugKanbanCard bug={activeBug} overlay /> : null}
      </DragOverlay>
    </>
  );
}
