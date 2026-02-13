'use client';

import { useState, useMemo } from 'react';
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

const STATUS_ICONS: Record<string, string> = {
  NOVO: 'M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
  EM_PROSPECCAO: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  CONTATADO: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  REUNIAO_MARCADA: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  CONVERTIDO: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  PERDIDO: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
};

function contactMatchesFilter(contact: Contact, query: string, userMap: Record<string, UserInfo>): boolean {
  const q = query.toLowerCase();
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
    contact.valor_estimado != null ? contact.valor_estimado.toString() : null,
    ...(contact.tipo || []),
    contact.temperatura,
    contact.proxima_acao_tipo,
    owner?.name,
  ];
  return fields.some(f => f && f.toLowerCase().includes(q));
}

export function KanbanColumn({ status, contacts, userMap, columnLabel, columnColor, currentUserId, onClaimContact, onJumpForward, onJumpBackward }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [filter, setFilter] = useState('');
  const color = columnColor || '#a3a3a3';
  const label = columnLabel || status;
  const totalValue = contacts.reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
  const iconPath = STATUS_ICONS[status] || STATUS_ICONS.NOVO;

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
          <span className="text-[10px] font-bold text-purple-300/50 bg-purple-800/20 rounded-md px-1.5 py-0.5 min-w-[22px] text-center">
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
              onJumpForward={onJumpForward}
              onJumpBackward={onJumpBackward}
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
