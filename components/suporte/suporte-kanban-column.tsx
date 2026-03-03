'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { SupportTicket } from '@/lib/types';
import { SuporteKanbanCard } from './suporte-kanban-card';

interface SuporteKanbanColumnProps {
  id: string;
  label: string;
  color: string;
  tickets: SupportTicket[];
}

export function SuporteKanbanColumn({ id, label, color, tickets }: SuporteKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

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
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          </div>
          <span className="text-xs font-semibold text-neutral-200 flex-1 truncate">{label}</span>
          <span className="text-[10px] font-bold text-purple-300/50 bg-purple-800/20 rounded-md px-1.5 py-0.5 min-w-[22px] text-center">
            {tickets.length}
          </span>
        </div>
        <div className="h-[2px] mx-3" style={{ backgroundColor: `${color}30` }} />
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]"
        style={{ maxHeight: 'calc(100vh - 340px)' }}
      >
        <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tickets.map((ticket) => (
            <SuporteKanbanCard key={ticket.id} ticket={ticket} />
          ))}
        </SortableContext>

        {tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-8 h-8 rounded-full bg-purple-800/20 flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-purple-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-[10px] text-purple-300/30">Nenhum chamado</p>
          </div>
        )}
      </div>
    </div>
  );
}
