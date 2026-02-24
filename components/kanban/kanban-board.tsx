'use client';

import { DragOverlay } from '@dnd-kit/core';
import type { Contact, PipelineStage, PipelineSettings, PipelineType } from '@/lib/types';
import { KanbanColumn } from './kanban-column';
import { KanbanCard, type UserInfo } from './kanban-card';

interface KanbanBoardProps {
  stages: PipelineStage[];
  grouped: Record<string, Contact[]>;
  activeContact: Contact | null;
  userMap: Record<string, UserInfo>;
  currentUserId?: string;
  onClaimContact?: (contactId: string) => void;
  onRequestContact?: (contactId: string) => void;
  pendingRequestContactIds?: Set<string>;
  onJumpForward?: (contactId: string) => void;
  onJumpBackward?: (contactId: string) => void;
  onScheduleMeeting?: (contactId: string, contactName: string) => void;
  pipelineSettings?: PipelineSettings | null;
  contactsWithMeeting?: Set<string>;
  lastInteractionMap?: Record<string, string>;
  bulkMode?: boolean;
  bulkSelectedIds?: Set<string>;
  onBulkToggle?: (contactId: string) => void;
  pipelineType?: PipelineType;
  attachmentCountMap?: Record<string, number>;
  dimmedContactIds?: Set<string>;
  hiddenContactIds?: Set<string>;
  stuckContactIds?: Set<string>;
}

export function KanbanBoard({ stages, grouped, activeContact, userMap, currentUserId, onClaimContact, onRequestContact, pendingRequestContactIds, onJumpForward, onJumpBackward, onScheduleMeeting, pipelineSettings, contactsWithMeeting, lastInteractionMap, bulkMode, bulkSelectedIds, onBulkToggle, pipelineType, attachmentCountMap, dimmedContactIds, hiddenContactIds, stuckContactIds }: KanbanBoardProps) {
  const colCount = stages.length;
  const gridClass = colCount <= 6
    ? `xl:grid xl:grid-cols-${colCount} xl:overflow-x-visible`
    : 'xl:overflow-x-auto';

  return (
    <>
      <div
        className={`flex gap-2.5 overflow-x-auto pb-4 min-h-0 h-full`}
        style={colCount <= 8 ? { display: 'grid', gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` } : undefined}
      >
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            contacts={grouped[stage.id] || []}
            userMap={userMap}
            currentUserId={currentUserId}
            onClaimContact={onClaimContact}
            onRequestContact={onRequestContact}
            pendingRequestContactIds={pendingRequestContactIds}
            onJumpForward={onJumpForward}
            onJumpBackward={onJumpBackward}
            onScheduleMeeting={onScheduleMeeting}
            contactsWithMeeting={contactsWithMeeting}
            lastInteractionMap={lastInteractionMap}
            bulkMode={bulkMode}
            bulkSelectedIds={bulkSelectedIds}
            onBulkToggle={onBulkToggle}
            pipelineType={pipelineType}
            attachmentCountMap={attachmentCountMap}
            dimmedContactIds={dimmedContactIds}
            hiddenContactIds={hiddenContactIds}
            stuckContactIds={stuckContactIds}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeContact ? <KanbanCard contact={activeContact} overlay userMap={userMap} /> : null}
      </DragOverlay>
    </>
  );
}
