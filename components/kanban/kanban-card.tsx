'use client';

import { memo, useMemo, useCallback, useState, startTransition } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import type { Contact, PipelineType } from '@/lib/types';
import { CONTACT_TYPE_LABELS, CONTACT_TYPE_COLORS, TEMPERATURA_LABELS, TEMPERATURA_COLORS, PROXIMA_ACAO_LABELS, SEGMENTO_COLORS, resolveTipoDisplay } from '@/lib/utils/labels';
import { getUserColor, getUserInitials } from '@/lib/utils/user-colors';
import { computeLeadScore, getScoreColor } from '@/lib/utils/lead-score';
import ContactAvatar from '@/components/contacts/contact-avatar';

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
  onRequestContact?: (contactId: string) => void;
  hasPendingRequest?: boolean;
  onJumpForward?: (contactId: string) => void;
  onJumpBackward?: (contactId: string) => void;
  onScheduleMeeting?: (contactId: string, contactName: string) => void;
  hasMeeting?: boolean;
  canJumpForward?: boolean;
  canJumpBackward?: boolean;
  showScheduleMeeting?: boolean;
  lastInteractionAt?: string | null;
  bulkMode?: boolean;
  bulkSelected?: boolean;
  onBulkToggle?: (contactId: string) => void;
  pipelineType?: PipelineType;
  attachmentCount?: number;
  isDimmed?: boolean;
  isStuck?: boolean;
  compact?: boolean;
  onCardClick?: (contactId: string) => void;
}

function daysInStage(updatedAt: string): number {
  const diff = Date.now() - new Date(updatedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Border width & color based on deal value */
function getValueBorder(valor: number | null): { width: number; color: string } {
  if (!valor || valor <= 0) return { width: 3, color: '' };
  if (valor >= 50000) return { width: 5, color: '#10b981' };
  if (valor >= 10000) return { width: 4, color: '#34d399' };
  return { width: 3, color: '#6ee7b7' };
}

export const KanbanCard = memo(function KanbanCard({ contact, overlay, userMap, currentUserId, onClaimContact, onRequestContact, hasPendingRequest, onJumpForward, onJumpBackward, onScheduleMeeting, hasMeeting, canJumpForward: canFwd, canJumpBackward: canBwd, showScheduleMeeting: showMeeting, lastInteractionAt, bulkMode, bulkSelected, onBulkToggle, pipelineType, attachmentCount, isDimmed, isStuck, compact, onCardClick }: KanbanCardProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

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
  // Fallback pra string vazia: contatos do quiz tem created_by_user_id null,
  // entao ownerId pode ser '' — userMap['' ] devolve undefined, getUserColor('')
  // devolve cor neutra. Sem o fallback TS reclama de indexar com null.
  const ownerId = contact.assigned_to_user_id || contact.created_by_user_id || '';
  const ownerColorVal = isUnassigned ? { bg: '#525252', text: '#a3a3a3' } : (userMap?.[ownerId]?.color || getUserColor(ownerId));

  const valueBorder = getValueBorder(contact.valor_estimado);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    borderLeftColor: valueBorder.color || ownerColorVal.bg,
    borderLeftWidth: `${valueBorder.width}px`,
  };

  const days = daysInStage(contact.updated_at);
  const owner = userMap?.[ownerId];
  const ownerInitials = owner ? getUserInitials(owner.name) : '?';
  // Cadastrador (created_by_user_id) — mostrado quando diferente do dono atual.
  // Pra dar credito a quem captou o lead mesmo se outro vendedor virar dono depois.
  const creatorId = contact.created_by_user_id || '';
  const creator = creatorId && creatorId !== contact.assigned_to_user_id ? userMap?.[creatorId] : undefined;
  const creatorColorVal = creator?.color || (creatorId ? getUserColor(creatorId) : null);
  const creatorInitials = creator ? getUserInitials(creator.name) : '?';
  const overlayStyle = { borderLeftColor: valueBorder.color || ownerColorVal.bg, borderLeftWidth: `${valueBorder.width}px` };

  const canJumpForward = canFwd !== undefined ? canFwd : true;
  const canJumpBackward = canBwd !== undefined ? canBwd : true;

  const isOverdue = contact.proxima_acao_data && new Date(contact.proxima_acao_data) < new Date();

  const leadScore = useMemo(() => (contact as any).lead_score ?? computeLeadScore(contact), [contact.temperatura, contact.valor_estimado, contact.status, contact.updated_at, contact.proxima_acao_data, contact.proxima_acao_tipo, contact.phone, contact.email, contact.whatsapp, contact.company, contact.assigned_to_user_id, (contact as any).lead_score]);
  const scoreStyle = useMemo(() => getScoreColor(leadScore), [leadScore]);

  const daysSinceLastInteraction = lastInteractionAt
    ? Math.floor((Date.now() - new Date(lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isCooling = daysSinceLastInteraction !== null && daysSinceLastInteraction > 7 && contact.status !== 'CONVERTIDO' && contact.status !== 'PERDIDO';

  const handleClick = useCallback(() => {
    if (isDragging) return;
    if (bulkMode && onBulkToggle) { onBulkToggle(contact.id); return; }
    if (onCardClick) { onCardClick(contact.id); return; }
    startTransition(() => {
      router.push(`/contacts/${contact.id}`);
    });
  }, [isDragging, bulkMode, onBulkToggle, contact.id, router, onCardClick]);

  // Show expanded content: when hovered (desktop), always on overlay, or when not compact
  const showExpanded = isHovered || overlay || !compact;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? overlayStyle : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`bg-[#1e0f35] rounded-xl border-l-[3px] border cursor-grab select-none overflow-hidden transition-[transform,box-shadow,border-color,background-color,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        compact && !isHovered ? 'p-2' : 'p-3'
      } ${
        hasMeeting
          ? 'border-cyan-500/40 shadow-md shadow-cyan-500/10 hover:border-cyan-400/60 hover:shadow-cyan-500/20'
          : 'border-purple-800/20 hover:border-purple-600/40 hover:bg-[#241540] hover:shadow-purple-900/20'
      } ${
        overlay ? 'shadow-2xl ring-2 ring-emerald-500/30 opacity-80 bg-[#241540]' : ''
      } ${
        bulkSelected ? 'ring-2 ring-amber-500/50 bg-amber-500/5' : ''
      } ${
        isDimmed ? 'opacity-30' : ''
      } ${
        isStuck ? 'ring-2 ring-red-500/50' : ''
      }`}
    >
      {/* === SEGMENT STRIPE === */}
      {contact.segmento && (
        <div
          className="-mx-4 -mt-4 mb-2 px-3 py-1 flex items-center gap-1.5"
          style={{ backgroundColor: SEGMENTO_COLORS[contact.segmento].stripe + '25' }}
        >
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: SEGMENTO_COLORS[contact.segmento].stripe }} />
          <span style={{ color: SEGMENTO_COLORS[contact.segmento].stripe }} className="text-[10px] font-bold truncate">
            {contact.segmento}
          </span>
        </div>
      )}

      {/* === EVENT BADGE (feira de origem) === */}
      {contact.event && (
        <div
          onClick={(e) => { e.stopPropagation(); router.push(`/eventos/${contact.event!.id}`); }}
          className="flex items-center gap-1.5 mb-1.5 px-1.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer"
          title={`Feira: ${contact.event.name}`}
        >
          {contact.event.cover_image_url ? (
            <img
              src={contact.event.cover_image_url}
              alt={contact.event.name}
              className="w-5 h-5 rounded object-cover shrink-0"
            />
          ) : (
            <svg className="w-3 h-3 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          )}
          <span className="text-[10px] font-bold text-amber-300 truncate flex-1 min-w-0">
            {contact.event.name}
          </span>
        </div>
      )}

      {/* === COMPACT VIEW (always visible) === */}
      <div className="flex items-center gap-2">
        {/* Bulk checkbox */}
        {bulkMode && (
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
            bulkSelected ? 'bg-amber-500 border-amber-500' : 'border-purple-500/30 hover:border-amber-500/50'
          }`}>
            {bulkSelected && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}

        {/* Owner avatar (vendedor responsavel — discreto) + Cadastrador (se diferente) */}
        <div className="shrink-0 flex items-center -space-x-1.5">
          {isUnassigned ? (
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold border border-dashed border-purple-500/25 text-purple-300/30">?</div>
          ) : (
            <div className="w-6 h-6 rounded-full overflow-hidden opacity-60" title={`Dono: ${owner?.name || ''}`}>
              {owner?.avatar_url ? (
                <img src={owner.avatar_url} alt={owner.name} className="w-6 h-6 object-cover rounded-full" />
              ) : (
                <div
                  className="w-6 h-6 flex items-center justify-center text-[8px] font-bold rounded-full"
                  style={{ backgroundColor: ownerColorVal.bg, color: ownerColorVal.text }}
                >{ownerInitials}</div>
              )}
            </div>
          )}
          {/* Mini avatar do cadastrador (ring cyan pra diferenciar do dono) */}
          {creator && creatorColorVal && (
            <div className="w-4 h-4 rounded-full overflow-hidden ring-1 ring-cyan-400/60 z-10" title={`Cadastrado por ${creator.name}`}>
              {creator.avatar_url ? (
                <img src={creator.avatar_url} alt={creator.name} className="w-4 h-4 object-cover rounded-full" />
              ) : (
                <div
                  className="w-4 h-4 flex items-center justify-center text-[7px] font-bold rounded-full"
                  style={{ backgroundColor: creatorColorVal.bg, color: creatorColorVal.text }}
                >{creatorInitials}</div>
              )}
            </div>
          )}
        </div>

        {/* Contact avatar (foto da pessoa/cartao) */}
        <ContactAvatar name={contact.name} avatarUrl={contact.avatar_url} size="sm" />

        {/* Name + company */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate leading-tight drop-shadow-[0_0_6px_rgba(255,255,255,0.15)]">{contact.name}</p>
          {contact.company && <p className="text-[10px] text-purple-300/50 truncate">{contact.company}</p>}
        </div>

        {/* Compact badges */}
        <div className="flex items-center gap-1 shrink-0">
          {contact.temperatura && (
            <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${TEMPERATURA_COLORS[contact.temperatura] || ''}`}>
              {TEMPERATURA_LABELS[contact.temperatura]?.[0] || ''}
            </span>
          )}
          {isOverdue && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Atrasado" />
          )}
          {contact.valor_estimado != null && contact.valor_estimado > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/15 text-emerald-400">
              {contact.valor_estimado >= 1000
                ? `${(contact.valor_estimado / 1000).toFixed(contact.valor_estimado >= 10000 ? 0 : 1)}k`
                : contact.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          )}
        </div>
      </div>

      {/* === EXPANDED VIEW (on hover or non-compact) === */}
      {showExpanded && (
        <div className={compact && isHovered ? 'animate-card-expand mt-2' : 'mt-2'}>
          {/* Meeting highlight banner */}
          {hasMeeting && !overlay && (
            <div
              onClick={(e) => { e.stopPropagation(); router.push('/calendar'); }}
              className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 cursor-pointer hover:bg-cyan-500/20 transition-colors"
              title="Ver no calendario"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
              <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[10px] font-bold text-cyan-400">Reuniao Agendada</span>
            </div>
          )}

          {/* Substitution requested banner */}
          {hasPendingRequest && !overlay && (
            <div
              onClick={(e) => { e.stopPropagation(); router.push('/requests'); }}
              className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition-colors"
              title="Ver solicitacoes"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                <path d="M8 4l-4 4 4 4" stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 12l4 4-4 4" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                <line x1="4" y1="8" x2="14" y2="8" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" />
                <line x1="10" y1="16" x2="20" y2="16" stroke="#22c55e" strokeWidth={2} strokeLinecap="round" />
              </svg>
              <span className="text-[10px] font-bold text-amber-400">Substituicao solicitada</span>
            </div>
          )}

          {/* Score + Value + Quick contacts */}
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${scoreStyle.bg} ${scoreStyle.text}`} title={`Score: ${leadScore}/100`}>
              {leadScore}
            </span>
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
                  className="w-10 h-10 sm:w-6 sm:h-6 flex items-center justify-center rounded-md hover:bg-green-500/15 transition-colors"
                  title="WhatsApp"
                >
                  <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
              )}
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="w-10 h-10 sm:w-6 sm:h-6 flex items-center justify-center rounded-md hover:bg-blue-500/15 transition-colors"
                  title="Email"
                >
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </a>
              )}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone.replace(/\D/g, '')}`}
                  onClick={(e) => e.stopPropagation()}
                  className="w-10 h-10 sm:w-6 sm:h-6 flex items-center justify-center rounded-md hover:bg-purple-500/15 transition-colors"
                  title="Ligar"
                >
                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                </a>
              )}
            </div>
          </div>

          {/* Claim / Request buttons */}
          {!overlay && (
            <div className="flex items-center gap-1 mt-1.5">
              {isUnassigned && currentUserId && onClaimContact && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClaimContact(contact.id); }}
                  className="flex items-center gap-1 text-[10px] font-medium text-purple-300/40 hover:text-emerald-400 hover:bg-emerald-500/10 px-1.5 py-0.5 rounded transition-colors"
                  title="Apontar para mim"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Apontar
                </button>
              )}
              {!isUnassigned && currentUserId && contact.assigned_to_user_id !== currentUserId && onRequestContact && !hasPendingRequest && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRequestContact(contact.id); }}
                  className="flex items-center gap-1 text-[10px] font-medium text-amber-400/40 hover:text-amber-400 hover:bg-amber-500/10 px-1.5 py-0.5 rounded transition-colors"
                  title="Pegar cliente"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Pegar
                </button>
              )}
            </div>
          )}

          {/* Badges row */}
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {resolveTipoDisplay(contact.tipo).map((t) => (
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
            {isCooling && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-orange-500/15 text-orange-400" title={`Sem interacao ha ${daysSinceLastInteraction} dias`}>
                ❄ {daysSinceLastInteraction}d
              </span>
            )}
            {!isCooling && daysSinceLastInteraction !== null && daysSinceLastInteraction > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-purple-300/30 bg-purple-800/20" title={`Ultimo contato ha ${daysSinceLastInteraction} dias`}>
                {daysSinceLastInteraction}d
              </span>
            )}
            {days > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto ${days > 7 ? 'text-amber-400 bg-amber-500/10' : 'text-purple-300/30 bg-purple-800/20'}`}>
                {days}d no stage
              </span>
            )}
          </div>

          {/* Attachment indicator for BUGS pipeline */}
          {pipelineType === 'BUGS' && !overlay && (
            <div className="mt-2 pt-2 border-t border-purple-800/15">
              <div
                onClick={(e) => { e.stopPropagation(); router.push(`/contacts/${contact.id}?tab=anexos`); }}
                className="flex items-center gap-1.5 text-[10px] cursor-pointer hover:bg-purple-500/10 px-2 py-1.5 rounded-md transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className={`font-medium ${(attachmentCount || 0) > 0 ? 'text-emerald-400' : 'text-purple-300/40'}`}>
                  {(attachmentCount || 0) > 0 ? `${attachmentCount} anexo(s)` : 'Sem anexos'}
                </span>
              </div>
            </div>
          )}

          {/* Schedule meeting */}
          {!overlay && showMeeting && onScheduleMeeting && (
            <div className="mt-2 pt-2 border-t border-purple-800/15">
              <button
                onClick={(e) => { e.stopPropagation(); onScheduleMeeting(contact.id, contact.name); }}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] font-bold text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-500/10 px-2 py-1.5 rounded-md transition-colors"
                title="Agendar reuniao"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Agendar Reuniao
              </button>
            </div>
          )}

          {/* Jump buttons */}
          {!overlay && (onJumpForward || onJumpBackward) && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-800/15">
              {canJumpBackward && onJumpBackward ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onJumpBackward(contact.id); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-red-400/60 hover:text-red-400 hover:bg-red-500/10 px-3 py-2 sm:px-2 sm:py-1 rounded-md transition-colors"
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
                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10 px-3 py-2 sm:px-2 sm:py-1 rounded-md transition-colors"
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
      )}
    </div>
  );
});
