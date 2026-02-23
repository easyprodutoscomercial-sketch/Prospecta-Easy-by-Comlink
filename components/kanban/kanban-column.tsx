'use client';

import { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Contact, PipelineStage, PipelineType } from '@/lib/types';
import { KanbanCard, type UserInfo } from './kanban-card';
import { normalizeSearch } from '@/lib/utils/normalize';

interface KanbanColumnProps {
  stage: PipelineStage;
  contacts: Contact[];
  userMap: Record<string, UserInfo>;
  currentUserId?: string;
  onClaimContact?: (contactId: string) => void;
  onRequestContact?: (contactId: string) => void;
  pendingRequestContactIds?: Set<string>;
  onJumpForward?: (contactId: string) => void;
  onJumpBackward?: (contactId: string) => void;
  onScheduleMeeting?: (contactId: string, contactName: string) => void;
  contactsWithMeeting?: Set<string>;
  lastInteractionMap?: Record<string, string>;
  bulkMode?: boolean;
  bulkSelectedIds?: Set<string>;
  onBulkToggle?: (contactId: string) => void;
  pipelineType?: PipelineType;
  attachmentCountMap?: Record<string, number>;
}

const SLUG_ICONS: Record<string, string> = {
  NOVO: 'M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
  EM_PROSPECCAO: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  CONTATADO: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  REUNIAO_MARCADA: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  CONVERTIDO: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  PERDIDO: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
};

// Map of named icons to SVG paths (for icon selector)
export const STAGE_ICON_OPTIONS: Record<string, { label: string; path: string }> = {
  plus_circle: { label: 'Novo', path: 'M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  search: { label: 'Busca', path: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  phone: { label: 'Telefone', path: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
  calendar: { label: 'Calendario', path: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  check_circle: { label: 'Aprovado', path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  x_circle: { label: 'Recusado', path: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
  lightning: { label: 'Raio', path: 'M13 10V3L4 14h7v7l9-11h-7z' },
  star: { label: 'Estrela', path: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  chat: { label: 'Chat', path: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  mail: { label: 'Email', path: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  users: { label: 'Pessoas', path: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  dollar: { label: 'Dinheiro', path: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  rocket: { label: 'Foguete', path: 'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z' },
  flag: { label: 'Bandeira', path: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z' },
  trophy: { label: 'Trofeu', path: 'M8 21h8m-4-4v4m-4.5-9.5L7 12l.5-.5m9 0L17 12l-.5-.5M5 3h14a1 1 0 011 1v2a6 6 0 01-6 6h-4a6 6 0 01-6-6V4a1 1 0 011-1z' },
  hand_shake: { label: 'Acordo', path: 'M7 11l4-4 4 4m-8 4l4-4 4 4' },
};

function getIconForStage(stage: PipelineStage): string {
  // Custom icon from stage config
  if (stage.icon && STAGE_ICON_OPTIONS[stage.icon]) return STAGE_ICON_OPTIONS[stage.icon].path;
  // Try slug match for known slugs
  if (SLUG_ICONS[stage.slug]) return SLUG_ICONS[stage.slug];
  // Terminal stages
  if (stage.is_terminal && stage.terminal_type === 'won') return SLUG_ICONS.CONVERTIDO;
  if (stage.is_terminal && stage.terminal_type === 'lost') return SLUG_ICONS.PERDIDO;
  // Default
  return 'M13 10V3L4 14h7v7l9-11h-7z';
}

function contactMatchesFilter(contact: Contact, query: string, userMap: Record<string, UserInfo>): boolean {
  const q = normalizeSearch(query);
  const owner = userMap[contact.assigned_to_user_id || contact.created_by_user_id];
  const fields = [
    contact.name,
    contact.company,
    contact.email,
    contact.phone,
    contact.whatsapp,
    contact.cidade,
    contact.estado,
    contact.contato_nome,
    contact.cargo,
    contact.referencia,
    contact.produtos_fornecidos,
    contact.cpf,
    contact.cnpj,
    contact.notes,
    contact.valor_estimado != null ? contact.valor_estimado.toString() : null,
    ...(contact.tipo || []),
    contact.temperatura,
    contact.proxima_acao_tipo,
    owner?.name,
  ];
  return fields.some(f => f && normalizeSearch(f).includes(q));
}

export function KanbanColumn({ stage, contacts, userMap, currentUserId, onClaimContact, onRequestContact, pendingRequestContactIds, onJumpForward, onJumpBackward, onScheduleMeeting, contactsWithMeeting, lastInteractionMap, bulkMode, bulkSelectedIds, onBulkToggle, pipelineType, attachmentCountMap }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const [filter, setFilter] = useState('');
  const color = stage.color || '#a3a3a3';
  const label = stage.name;
  const totalValue = contacts.reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
  const iconPath = getIconForStage(stage);

  const hasScheduledMeeting = contacts.some(c => contactsWithMeeting?.has(c.id));

  const filtered = useMemo(() => {
    if (!filter.trim()) return contacts;
    return contacts.filter(c => contactMatchesFilter(c, filter.trim(), userMap));
  }, [contacts, filter, userMap]);

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
            <svg className="w-3.5 h-3.5" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
            </svg>
          </div>
          <span className="text-xs font-semibold text-neutral-200 flex-1 truncate">{label}</span>
          {hasScheduledMeeting && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 whitespace-nowrap">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          )}
          <span
            className="text-xs font-bold rounded-full px-2 py-0.5 min-w-[26px] text-center"
            style={{ backgroundColor: `${color}25`, color }}
          >
            {filter.trim() ? `${filtered.length}/${contacts.length}` : contacts.length}
          </span>
        </div>

        {/* Value bar */}
        {totalValue > 0 && (
          <div className="px-3 pb-2">
            <p className="text-[10px] font-semibold text-emerald-400/80">
              {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
            </p>
          </div>
        )}

        {/* Filter input */}
        <div className="px-2 pb-2">
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-purple-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar..."
              className="w-full pl-7 pr-6 py-1 text-[10px] bg-[#1e0f35] border border-purple-800/20 rounded-md text-neutral-300 placeholder-purple-400/25 focus:outline-none focus:border-purple-600/40 focus:ring-1 focus:ring-purple-600/20"
            />
            {filter && (
              <button
                onClick={() => setFilter('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-purple-400/40 hover:text-purple-300 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Color accent line */}
        <div className="h-[2px] mx-3" style={{ backgroundColor: `${color}30` }} />
      </div>

      {/* Cards — scrollable */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]"
        style={{ maxHeight: 'calc(100vh - 280px)' }}
      >
        <SortableContext items={filtered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {filtered.map((contact) => (
            <KanbanCard
              key={contact.id}
              contact={contact}
              userMap={userMap}
              currentUserId={currentUserId}
              onClaimContact={onClaimContact}
              onRequestContact={onRequestContact}
              hasPendingRequest={pendingRequestContactIds?.has(contact.id)}
              onJumpForward={onJumpForward}
              onJumpBackward={onJumpBackward}
              onScheduleMeeting={onScheduleMeeting}
              hasMeeting={contactsWithMeeting?.has(contact.id)}
              showScheduleMeeting={stage.allow_meeting === true || /reuniao/i.test(stage.slug) || /reuni[aã]o/i.test(stage.name)}
              lastInteractionAt={lastInteractionMap?.[contact.id] || null}
              bulkMode={bulkMode}
              bulkSelected={bulkSelectedIds?.has(contact.id)}
              onBulkToggle={onBulkToggle}
              pipelineType={pipelineType}
              attachmentCount={attachmentCountMap?.[contact.id] || 0}
            />
          ))}
        </SortableContext>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-8 h-8 rounded-full bg-purple-800/20 flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-purple-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={filter.trim() ? 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' : 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4'} />
              </svg>
            </div>
            <p className="text-[10px] text-purple-300/30">{filter.trim() ? 'Nenhum resultado' : 'Nenhum contato'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
