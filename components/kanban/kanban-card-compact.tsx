'use client';

import { memo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Contact } from '@/lib/types';
import type { UserInfo } from './kanban-card';
import { getUserColor, getUserInitials } from '@/lib/utils/user-colors';
import { SEGMENTO_COLORS } from '@/lib/utils/labels';
import ContactAvatar from '@/components/contacts/contact-avatar';

interface KanbanCardCompactProps {
  contact: Contact;
  overlay?: boolean;
  userMap?: Record<string, UserInfo>;
  onCardClick?: (contactId: string) => void;
  bulkMode?: boolean;
  bulkSelected?: boolean;
  onBulkToggle?: (contactId: string) => void;
  isDimmed?: boolean;
}

export const KanbanCardCompact = memo(function KanbanCardCompact({ contact, overlay, userMap, onCardClick, bulkMode, bulkSelected, onBulkToggle, isDimmed }: KanbanCardCompactProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: contact.id,
    data: { contact },
  });

  const ownerId = contact.assigned_to_user_id || contact.created_by_user_id || '';
  const isUnassigned = !contact.assigned_to_user_id;
  const ownerColorVal = isUnassigned ? { bg: '#525252', text: '#a3a3a3' } : (userMap?.[ownerId]?.color || getUserColor(ownerId));
  const owner = userMap?.[ownerId];
  const ownerInitials = owner ? getUserInitials(owner.name) : '?';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleClick = useCallback(() => {
    if (isDragging) return;
    if (bulkMode && onBulkToggle) { onBulkToggle(contact.id); return; }
    onCardClick?.(contact.id);
  }, [isDragging, bulkMode, onBulkToggle, contact.id, onCardClick]);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={handleClick}
      className={`bg-[#1e0f35] rounded-lg px-2 py-1.5 border cursor-grab select-none overflow-hidden transition-[transform,box-shadow,opacity] duration-150 hover:-translate-y-0.5 hover:bg-[#241540] ${
        bulkSelected ? 'ring-2 ring-amber-500/50 bg-amber-500/5' : 'border-purple-800/15 hover:border-purple-600/30'
      } ${
        overlay ? 'shadow-2xl ring-2 ring-emerald-500/30 opacity-80' : ''
      } ${
        isDimmed ? 'opacity-30' : ''
      }`}
    >
      {/* Segment stripe */}
      {contact.segmento && (
        <div
          className="-mx-3 -mt-2 mb-1 px-2 py-0.5 flex items-center gap-1"
          style={{ backgroundColor: SEGMENTO_COLORS[contact.segmento].stripe + '25' }}
        >
          <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: SEGMENTO_COLORS[contact.segmento].stripe }} />
          <span style={{ color: SEGMENTO_COLORS[contact.segmento].stripe }} className="text-[8px] font-bold truncate">
            {contact.segmento}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {/* Bulk checkbox */}
        {bulkMode && (
          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
            bulkSelected ? 'bg-amber-500 border-amber-500' : 'border-purple-500/30'
          }`}>
            {bulkSelected && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}

        {/* Mini owner avatar (vendedor) */}
        <div className="shrink-0">
          {owner?.avatar_url ? (
            <img src={owner.avatar_url} alt="" className="w-4 h-4 object-cover rounded-full" />
          ) : (
            <div
              className="w-4 h-4 flex items-center justify-center text-[6px] font-bold rounded-full"
              style={{ backgroundColor: ownerColorVal.bg, color: ownerColorVal.text }}
            >{ownerInitials}</div>
          )}
        </div>

        {/* Contact avatar (foto da pessoa/cartao) */}
        <ContactAvatar name={contact.name} avatarUrl={contact.avatar_url} size="xs" />

        {/* Name */}
        <span className="text-[11px] font-bold text-white truncate flex-1">{contact.name}</span>

        {/* Value badge */}
        {contact.valor_estimado != null && contact.valor_estimado > 0 && (
          <span className="text-[9px] px-1 py-0.5 rounded font-bold bg-emerald-500/15 text-emerald-400 shrink-0">
            {contact.valor_estimado >= 1000
              ? `${(contact.valor_estimado / 1000).toFixed(0)}k`
              : contact.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        )}
      </div>
    </div>
  );
});
