'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import type { SupportTicket } from '@/lib/types';
import {
  SUPPORT_TYPE_LABELS, SUPPORT_TYPE_COLORS,
  SUPPORT_CATEGORY_LABELS, SUPPORT_CATEGORY_COLORS,
  SUPPORT_PRIORITY_LABELS, SUPPORT_PRIORITY_COLORS,
  SUPPORT_SEVERITY_LABELS, SUPPORT_SEVERITY_COLORS,
} from '@/lib/utils/labels';
import { getUserInitials } from '@/lib/utils/user-colors';

interface SuporteKanbanCardProps {
  ticket: SupportTicket;
  overlay?: boolean;
}

export function SuporteKanbanCard({ ticket, overlay }: SuporteKanbanCardProps) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ticket.id,
    data: { ticket },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isOverdue = ticket.due_date &&
    new Date(ticket.due_date) < new Date() &&
    ticket.status !== 'RESOLVIDO' &&
    ticket.status !== 'FECHADO';

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => { if (!isDragging) router.push(`/suporte/${ticket.id}`); }}
      className={`bg-[#1e0f35] rounded-xl p-3 border cursor-grab select-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg border-purple-800/20 hover:border-purple-600/40 hover:bg-[#241540] hover:shadow-purple-900/20 ${
        overlay ? 'shadow-2xl ring-2 ring-emerald-500/30 rotate-2 scale-105 bg-[#241540]' : ''
      }`}
    >
      {/* Title */}
      <p className="text-sm font-medium text-neutral-100 line-clamp-2">{ticket.title}</p>

      {/* Badges */}
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_TYPE_COLORS[ticket.ticket_type] || ''}`}>
          {SUPPORT_TYPE_LABELS[ticket.ticket_type] || ticket.ticket_type}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_CATEGORY_COLORS[ticket.category] || ''}`}>
          {SUPPORT_CATEGORY_LABELS[ticket.category] || ticket.category}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_PRIORITY_COLORS[ticket.priority] || ''}`}>
          {SUPPORT_PRIORITY_LABELS[ticket.priority] || ticket.priority}
        </span>
        {ticket.ticket_type === 'BUG' && ticket.severity && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_SEVERITY_COLORS[ticket.severity] || ''}`}>
            {SUPPORT_SEVERITY_LABELS[ticket.severity] || ticket.severity}
          </span>
        )}
      </div>

      {/* Project badge */}
      {ticket.project_name && (
        <div className="flex items-center gap-1 mt-1.5">
          <svg className="w-3 h-3 text-cyan-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="text-[10px] text-cyan-400/50 truncate">{ticket.project_name}</span>
        </div>
      )}

      {/* Contact link */}
      {ticket.contact_name && (
        <div className="flex items-center gap-1 mt-1.5">
          <svg className="w-3 h-3 text-purple-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[10px] text-purple-300/50 truncate">{ticket.contact_name}</span>
        </div>
      )}

      {/* Footer: assignee + due date */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-800/15">
        <div className="flex items-center gap-1.5">
          {ticket.assigned_to_name ? (
            <div className="w-5 h-5 rounded-full bg-purple-700 flex items-center justify-center text-[8px] font-bold text-white" title={ticket.assigned_to_name}>
              {getUserInitials(ticket.assigned_to_name)}
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border border-dashed border-purple-500/30 flex items-center justify-center text-[8px] text-purple-300/30">?</div>
          )}
          <span className="text-[10px] text-neutral-500 truncate max-w-[80px]">
            {ticket.assigned_to_name || 'Sem responsavel'}
          </span>
        </div>
        {ticket.due_date && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            isOverdue ? 'text-red-400 bg-red-500/10' : 'text-purple-300/30 bg-purple-800/20'
          }`}>
            {new Date(ticket.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}
