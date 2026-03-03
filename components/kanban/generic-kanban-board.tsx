'use client';

import { DragOverlay } from '@dnd-kit/core';
import { ReactNode } from 'react';
import { GenericKanbanColumn, type GenericKanbanColumnDef } from './generic-kanban-column';

interface GenericKanbanBoardProps<T extends { id: string }> {
  columns: GenericKanbanColumnDef[];
  groupedItems: Record<string, T[]>;
  renderCard: (item: T) => ReactNode;
  renderOverlay?: () => ReactNode;
  emptyLabel?: string;
}

export function GenericKanbanBoard<T extends { id: string }>({
  columns,
  groupedItems,
  renderCard,
  renderOverlay,
  emptyLabel,
}: GenericKanbanBoardProps<T>) {
  return (
    <>
      <div
        className="flex gap-2.5 overflow-x-auto pb-4 min-h-0 h-full"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))` }}
      >
        {columns.map((col) => (
          <GenericKanbanColumn
            key={col.id}
            column={col}
            items={groupedItems[col.id] || []}
            renderCard={renderCard}
            emptyLabel={emptyLabel}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {renderOverlay?.() ?? null}
      </DragOverlay>
    </>
  );
}
