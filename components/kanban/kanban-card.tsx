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
  onJumpForward?: (contactId: string) => void;
  onJumpBackward?: (contactId: string) => void;
}

function daysInStage(updatedAt: string): number {
  const diff = Date.now() - new Date(updatedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

const STATUS_ORDER = ['NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA', 'CONVERTIDO', 'PERDIDO'];

export function KanbanCard({ contact, overlay, userMap, currentUserId, onClaimContact, onJumpForward, onJumpBackward }: KanbanCardProps) {
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
  const ownerColorVal = isUnassigned ? { bg: '#525252', text: '#a3a3a3' } : (userMap?.[ownerId]?.color || getUserColor(ownerId));

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

  const statusIdx = STATUS_ORDER.indexOf(contact.status);
  const canJumpForward = statusIdx >= 0 && statusIdx < STATUS_ORDER.length - 2;
  const canJumpBackward = statusIdx > 0;

  const isOverdue = contact.proxima_acao_data && new Date(contact.proxima_acao_data) < new Date();

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? overlayStyle : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => { if (!isDragging) router.push(`/contacts/${contact.id}`); }}
      className={`bg-[#1e0f35] rounded-xl p-3 border-l-[3px] border border-purple-800/20 cursor-grab select-none transition-all duration-200 hover:border-purple-600/40 hover:bg-[#241540] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-900/20 ${
        overlay ? 'shadow-2xl ring-2 ring-emerald-500/30 rotate-2 scale-105 bg-[#241540]' : ''
      }`}
    >
      {/* Header: name + avatar */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-100 truncate">{contact.name}</p>
          {contact.company && <p className="text-[11px] text-purple-300/50 truncate mt-0.5">{contact.company}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isUnassigned && currentUserId && onClaimContact && (
            <button
              onClick={(e) => { e.stopPropagation(); onClaimContact(contact.id); }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-dashed border-purple-500/30 text-purple-300/40 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Apontar para mim"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          )}
          {isUnassigned ? (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-dashed border-purple-500/25 text-purple-300/30" title="Sem responsavel">?</div>
          ) : (
            <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden opacity-60" title={owner?.name || ''}>
              {owner?.avatar_url ? (
                <img src={owner.avatar_url} alt={owner.name} className="w-9 h-9 object-cover rounded-full" />
              ) : (
                <div
                  className="w-9 h-9 flex items-center justify-center text-[9px] font-bold rounded-full"
                  style={{ backgroundColor: ownerColorVal.bg, color: ownerColorVal.text }}
                >{ownerInitials}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Value + quick contacts */}
      <div className="flex items-center gap-1.5 mt-2">
        {contact.valor_estimado != null && contact.valor_estimado > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/15 text-emerald-400">
            {contact.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {(contact.whatsapp || contact.phone) && (
            <a
              href={`https://wa.me/55${(contact.whatsapp || contact.phone || '').replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-green-500/15 transition-colors"
              title="WhatsApp"
            >
              <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              onClick={(e) => e.stopPropagation()}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-blue-500/15 transition-colors"
              title="Email"
            >
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone.replace(/\D/g, '')}`}
              onClick={(e) => e.stopPropagation()}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-purple-500/15 transition-colors"
              title="Ligar"
            >
              <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </a>
          )}
        </div>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        {contact.tipo?.map((t) => (
          <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CONTACT_TYPE_COLORS[t] || 'bg-purple-800/30 text-purple-300/50'}`}>
            {CONTACT_TYPE_LABELS[t] || t}
          </span>
        ))}
        {contact.temperatura && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TEMPERATURA_COLORS[contact.temperatura] || ''}`}>
            {TEMPERATURA_LABELS[contact.temperatura] || contact.temperatura}
          </span>
        )}
        {isOverdue && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-500/20 text-red-400 animate-pulse">! Atrasado</span>
        )}
        {!isOverdue && contact.proxima_acao_tipo && contact.proxima_acao_data && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-800/30 text-purple-300/40">
            {PROXIMA_ACAO_LABELS[contact.proxima_acao_tipo] || contact.proxima_acao_tipo} {new Date(contact.proxima_acao_data).toLocaleDateString('pt-BR')}
          </span>
        )}
        {days > 0 && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto ${days > 7 ? 'text-amber-400 bg-amber-500/10' : 'text-purple-300/30 bg-purple-800/20'}`}>
            {days}d
          </span>
        )}
      </div>

      {/* Jump buttons — always visible */}
      {!overlay && (onJumpForward || onJumpBackward) && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-800/15">
          {canJumpBackward && onJumpBackward ? (
            <button
              onClick={(e) => { e.stopPropagation(); onJumpBackward(contact.id); }}
              className="flex items-center gap-1 text-[10px] font-bold text-red-400/60 hover:text-red-400 hover:bg-red-500/10 px-2 py-1 rounded-md transition-colors"
              title="Voltar etapa"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Voltar
            </button>
          ) : <span />}
          {canJumpForward && onJumpForward ? (
            <button
              onClick={(e) => { e.stopPropagation(); onJumpForward(contact.id); }}
              className="flex items-center gap-1 text-[10px] font-bold text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10 px-2 py-1 rounded-md transition-colors"
              title="Avancar etapa"
            >
              Avancar
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : <span />}
        </div>
      )}
    </div>
  );
}
