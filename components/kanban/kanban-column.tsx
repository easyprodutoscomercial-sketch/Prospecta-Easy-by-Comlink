'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Contact, ContactStatus } from '@/lib/types';
import { KanbanCard, type UserInfo } from './kanban-card';

interface KanbanColumnProps {
  status: ContactStatus;
  contacts: Contact[];
  userMap: Record<string, UserInfo>;
  columnLabel?: string;
  columnColor?: string;
  currentUserId?: string;
  onClaimContact?: (contactId: string) => void;
  onJumpForward?: (contactId: string) => void;
  onJumpBackward?: (contactId: string) => void;
}

export function KanbanColumn({ status, contacts, userMap, columnLabel, columnColor, currentUserId, onClaimContact, onJumpForward, onJumpBackward }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = columnColor || '#a3a3a3';
  const label = columnLabel || status;

  return (
    <div
      className={`flex-shrink-0 w-60 md:w-64 xl:w-auto xl:flex-shrink xl:min-w-0 bg-[#1e0f35] border border-purple-800/30 rounded-xl shadow-sm flex flex-col transition-colors overflow-hidden ${
        isOver ? 'ring-2 ring-emerald-500/40 bg-[#2a1245]' : ''
      }`}
    >
      {/* Color bar */}
      <div className="h-1.5 rounded-t-xl" style={{ backgroundColor: color }} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-purple-800/20">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-bold text-neutral-100 flex-1 truncate">
          {label}
        </span>
        <span className="text-xs font-medium text-purple-300/60 bg-purple-800/30 rounded-full px-2 py-0.5">
          {contacts.length}
        </span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2"
      >
        <SortableContext items={contacts.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {contacts.map((contact) => (
            <KanbanCard
              key={contact.id}
              contact={contact}
              userMap={userMap}
              currentUserId={currentUserId}
              onClaimContact={onClaimContact}
              onJumpForward={onJumpForward}
              onJumpBackward={onJumpBackward}
            />
          ))}
        </SortableContext>

        {contacts.length === 0 && (
          <p className="text-xs text-purple-300/40 text-center py-6">Nenhum contato</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-purple-800/20">
        <p className="text-[10px] text-purple-300/40 font-medium">
          {contacts.length} {contacts.length === 1 ? 'contato' : 'contatos'}
        </p>
      </div>
    </div>
  );
}
