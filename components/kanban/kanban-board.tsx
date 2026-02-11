'use client';

import { DragOverlay } from '@dnd-kit/core';
import type { Contact, ContactStatus, PipelineSettings } from '@/lib/types';
import { KanbanColumn } from './kanban-column';
import { KanbanCard, type UserInfo } from './kanban-card';
import { getColumnLabel, getColumnColor } from '@/lib/utils/labels';

const STATUSES: ContactStatus[] = [
  'NOVO',
  'EM_PROSPECCAO',
  'CONTATADO',
  'REUNIAO_MARCADA',
  'CONVERTIDO',
  'PERDIDO',
];

interface KanbanBoardProps {
  grouped: Record<ContactStatus, Contact[]>;
  activeContact: Contact | null;
  userMap: Record<string, UserInfo>;
  currentUserId?: string;
  onClaimContact?: (contactId: string) => void;
  onJumpForward?: (contactId: string) => void;
  onJumpBackward?: (contactId: string) => void;
  pipelineSettings?: PipelineSettings | null;
}

export function KanbanBoard({ grouped, activeContact, userMap, currentUserId, onClaimContact, onJumpForward, onJumpBackward, pipelineSettings }: KanbanBoardProps) {
  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-0 xl:grid xl:grid-cols-6 xl:overflow-x-visible">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            contacts={grouped[status] || []}
            userMap={userMap}
            columnLabel={getColumnLabel(status, pipelineSettings)}
            columnColor={getColumnColor(status, pipelineSettings)}
            currentUserId={currentUserId}
            onClaimContact={onClaimContact}
            onJumpForward={onJumpForward}
            onJumpBackward={onJumpBackward}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeContact ? <KanbanCard contact={activeContact} overlay userMap={userMap} /> : null}
      </DragOverlay>
    </>
  );
}
