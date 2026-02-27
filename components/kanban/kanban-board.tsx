'use client';

import { useMemo } from 'react';
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
  compact?: boolean;
  onCardClick?: (contactId: string) => void;
  collapsedColumns?: Set<string>;
  onToggleCollapse?: (stageId: string) => void;
}

export function KanbanBoard({ stages, grouped, activeContact, userMap, currentUserId, onClaimContact, onRequestContact, pendingRequestContactIds, onJumpForward, onJumpBackward, onScheduleMeeting, pipelineSettings, contactsWithMeeting, lastInteractionMap, bulkMode, bulkSelectedIds, onBulkToggle, pipelineType, attachmentCountMap, dimmedContactIds, hiddenContactIds, stuckContactIds, compact, onCardClick, collapsedColumns, onToggleCollapse }: KanbanBoardProps) {
  const colCount = stages.length;

  // Dynamic grid: collapsed columns use 48px, expanded use 1fr
  const gridTemplateColumns = useMemo(() => {
    if (colCount > 8) return undefined;
    return stages.map(s => collapsedColumns?.has(s.id) ? '48px' : 'minmax(0, 1fr)').join(' ');
  }, [stages, collapsedColumns, colCount]);

  return (
    <>
      <div
        className="flex gap-2 sm:gap-2.5 overflow-x-auto pb-4 min-h-0 h-full snap-x snap-mandatory sm:snap-none"
        style={colCount <= 8 && gridTemplateColumns ? { display: 'grid', gridTemplateColumns } : undefined}
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
            compact={compact}
            onCardClick={onCardClick}
            collapsed={collapsedColumns?.has(stage.id) ?? false}
            onToggleCollapse={onToggleCollapse ? () => onToggleCollapse(stage.id) : undefined}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeContact ? <KanbanCard contact={activeContact} overlay userMap={userMap} /> : null}
      </DragOverlay>
    </>
  );
}
