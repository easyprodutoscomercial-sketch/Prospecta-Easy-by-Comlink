'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import type { Contact } from '@/lib/types';
import { CONTACT_TYPE_LABELS, CONTACT_TYPE_COLORS, TEMPERATURA_LABELS, TEMPERATURA_COLORS, PROXIMA_ACAO_LABELS } from '@/lib/utils/labels';
import { getUserColor, getUserInitials } from '@/lib/utils/user-colors';

export interface UserInfo {
  name: string;
  color: { bg: string; text: string };
  avatar_url?: string | null;
}

interface KanbanCardProps {
  contact: Contact;
  overlay?: boolean;
  userMap?: Record<string, UserInfo>;
  currentUserId?: string;
  onClaimContact?: (contactId: string) => void;
}

function daysInStage(updatedAt: string): number {
  const diff = Date.now() - new Date(updatedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function KanbanCard({ contact, overlay, userMap, currentUserId, onClaimContact }: KanbanCardProps) {
  const router = useRouter();
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

  const isUnassigned = !contact.assigned_to_user_id;
  const ownerId = contact.assigned_to_user_id || contact.created_by_user_id;
  const ownerColorVal = isUnassigned ? { bg: '#d4d4d4', text: '#737373' } : (userMap?.[ownerId]?.color || getUserColor(ownerId));

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    borderLeftColor: ownerColorVal.bg,
  };

  const days = daysInStage(contact.updated_at);

  const owner = userMap?.[ownerId];
  const ownerInitials = owner ? getUserInitials(owner.name) : '?';

  const overlayStyle = { borderLeftColor: ownerColorVal.bg };

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? overlayStyle : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => {
        if (!isDragging) router.push(`/contacts/${contact.id}`);
      }}
      className={`bg-[#2a1245] rounded-lg p-3.5 shadow-sm border-l-[3px] border border-purple-800/30 cursor-grab hover:shadow-lg hover:shadow-purple-900/20 hover:border-purple-700/40 transition-all select-none ${
        overlay ? 'shadow-lg ring-2 ring-emerald-500/20 rotate-2' : ''
      }`}
    >
      {/* Header: nome + avatar do responsável */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-neutral-100 truncate flex-1">{contact.name}</p>
        <div className="flex items-center gap-1 shrink-0">
          {/* Claim button for unassigned contacts */}
          {isUnassigned && currentUserId && onClaimContact && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClaimContact(contact.id);
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-dashed border-purple-500/30 text-purple-300/40 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Apontar para mim"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          )}
          {/* Owner avatar */}
          {isUnassigned ? (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-dashed border-purple-500/30 text-purple-300/40"
              title="Sem responsavel"
            >
              ?
            </div>
          ) : (
            <div className="avatar-bounce shrink-0" title={owner?.name || 'Responsavel'}>
              {owner?.avatar_url ? (
                <img
                  src={owner.avatar_url}
                  alt={owner.name}
                  className="w-10 h-10 xl:w-11 xl:h-11 object-cover"
                />
              ) : (
                <div
                  className="w-10 h-10 xl:w-11 xl:h-11 flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: ownerColorVal.bg, color: ownerColorVal.text }}
                >
                  {ownerInitials}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {contact.company && (
        <p className="text-xs text-purple-300/60 truncate mt-0.5">{contact.company}</p>
      )}

      {contact.phone && (
        <p className="text-xs text-purple-300/40 mt-0.5">{contact.phone}</p>
      )}

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {contact.tipo?.map((t) => (
          <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CONTACT_TYPE_COLORS[t] || ''}`}>
            {CONTACT_TYPE_LABELS[t] || t}
          </span>
        ))}

        {contact.temperatura && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TEMPERATURA_COLORS[contact.temperatura] || ''}`}>
            {TEMPERATURA_LABELS[contact.temperatura] || contact.temperatura}
          </span>
        )}

        {contact.proxima_acao_tipo && contact.proxima_acao_data && (() => {
          const isOverdue = new Date(contact.proxima_acao_data) < new Date();
          const dateStr = new Date(contact.proxima_acao_data).toLocaleDateString('pt-BR');
          if (isOverdue) {
            return (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700 animate-pulse">
                ! Atrasado
              </span>
            );
          }
          return (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-800/30 text-purple-300/50">
              {PROXIMA_ACAO_LABELS[contact.proxima_acao_tipo!] || contact.proxima_acao_tipo} {dateStr}
            </span>
          );
        })()}

        {days > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-800/30 text-purple-300/50 ml-auto">
            {days}d
          </span>
        )}
      </div>
    </div>
  );
}
