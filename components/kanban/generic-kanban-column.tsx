'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ReactNode } from 'react';

export interface GenericKanbanColumnDef {
  id: string;
  label: string;
  color: string;
}

interface GenericKanbanColumnProps<T extends { id: string }> {
  column: GenericKanbanColumnDef;
  items: T[];
  renderCard: (item: T) => ReactNode;
  emptyLabel?: string;
}

export function GenericKanbanColumn<T extends { id: string }>({
  column,
  items,
  renderCard,
  emptyLabel = 'Nenhum item',
}: GenericKanbanColumnProps<T>) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      className={`flex-shrink-0 w-60 md:w-64 xl:w-auto xl:flex-shrink xl:min-w-0 bg-[#160b2e] rounded-xl flex flex-col transition-all duration-200 overflow-hidden ${
        isOver
          ? 'ring-2 ring-emerald-500/40 bg-[#1e0f35] shadow-lg shadow-emerald-900/20'
          : 'border border-purple-800/15'
      }`}
    >
      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${column.color}15` }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
          </div>
          <span className="text-xs font-semibold text-neutral-200 flex-1 truncate">{column.label}</span>
          <span className="text-[10px] font-bold text-purple-300/50 bg-purple-800/20 rounded-md px-1.5 py-0.5 min-w-[22px] text-center">
            {items.length}
          </span>
        </div>
        <div className="h-[2px] mx-3" style={{ backgroundColor: `${column.color}30` }} />
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px] max-h-[50vh] sm:max-h-[calc(100vh-340px)]"
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => renderCard(item))}
        </SortableContext>

        {items.length === 0 && (
          <div className={`flex flex-col items-center justify-center py-10 px-3 text-center rounded-lg border-2 border-dashed transition-colors ${isOver ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-purple-700/20 bg-purple-900/5'}`}>
            <div className="w-10 h-10 rounded-full bg-purple-800/30 flex items-center justify-center mb-2.5">
              <svg className="w-5 h-5 text-purple-300/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-purple-200/80 mb-0.5">{emptyLabel}</p>
            <p className="text-[10px] text-purple-300/50 leading-relaxed">Arraste um card para esta coluna</p>
          </div>
        )}
      </div>
    </div>
  );
}
