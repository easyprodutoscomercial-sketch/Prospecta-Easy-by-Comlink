'use client';

import Link from 'next/link';
import type { SupportTicket } from '@/lib/types';
import {
  SUPPORT_STATUS_LABELS, SUPPORT_STATUS_COLORS,
  SUPPORT_TYPE_LABELS, SUPPORT_TYPE_COLORS,
  SUPPORT_CATEGORY_LABELS, SUPPORT_CATEGORY_COLORS,
  SUPPORT_PRIORITY_LABELS, SUPPORT_PRIORITY_COLORS,
  SUPPORT_SEVERITY_LABELS, SUPPORT_SEVERITY_COLORS,
} from '@/lib/utils/labels';
import { getUserInitials } from '@/lib/utils/user-colors';

interface SuporteListProps {
  tickets: SupportTicket[];
  loading?: boolean;
}

export default function SuporteList({ tickets, loading }: SuporteListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-[#1e0f35] rounded-lg border border-purple-800/20 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-4 bg-purple-800/30 rounded w-2/3" />
              <div className="h-4 bg-purple-800/20 rounded w-16 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto mb-4 text-purple-700/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-neutral-400 text-sm">Nenhum chamado encontrado</p>
        <p className="text-neutral-600 text-xs mt-1">Tente ajustar os filtros ou crie um novo chamado</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tickets.map((ticket) => {
        const isOverdue = ticket.due_date &&
          new Date(ticket.due_date) < new Date() &&
          ticket.status !== 'RESOLVIDO' &&
          ticket.status !== 'FECHADO';

        return (
          <Link
            key={ticket.id}
            href={`/suporte/${ticket.id}`}
            className="flex items-center gap-3 p-3 bg-[#1e0f35] rounded-lg border border-purple-800/20 hover:border-purple-600/40 hover:bg-[#241540] transition-all"
          >
            {/* Priority indicator */}
            <div className={`w-2 h-8 rounded-full shrink-0 ${
              ticket.priority === 'URGENTE' ? 'bg-red-500' :
              ticket.priority === 'ALTA' ? 'bg-orange-500' :
              ticket.priority === 'NORMAL' ? 'bg-neutral-500' : 'bg-blue-500'
            }`} />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-neutral-200 truncate">{ticket.title}</p>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_STATUS_COLORS[ticket.status]}`}>
                  {SUPPORT_STATUS_LABELS[ticket.status]}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_TYPE_COLORS[ticket.ticket_type]}`}>
                  {SUPPORT_TYPE_LABELS[ticket.ticket_type]}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_CATEGORY_COLORS[ticket.category]}`}>
                  {SUPPORT_CATEGORY_LABELS[ticket.category]}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_PRIORITY_COLORS[ticket.priority]}`}>
                  {SUPPORT_PRIORITY_LABELS[ticket.priority]}
                </span>
                {ticket.ticket_type === 'BUG' && ticket.severity && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_SEVERITY_COLORS[ticket.severity]}`}>
                    {SUPPORT_SEVERITY_LABELS[ticket.severity]}
                  </span>
                )}
                {ticket.project_name && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-cyan-500/15 text-cyan-400">
                    {ticket.project_name}
                  </span>
                )}
                {ticket.contact_name && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-800/30 text-purple-300/50">
                    {ticket.contact_name}
                  </span>
                )}
                {isOverdue && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-500/10 text-red-400">
                    Vencido
                  </span>
                )}
              </div>
            </div>

            {/* Assignee */}
            <div className="flex items-center gap-2 shrink-0">
              {ticket.assigned_to_name ? (
                <div className="w-6 h-6 rounded-full bg-purple-700 flex items-center justify-center text-[9px] font-bold text-white" title={ticket.assigned_to_name}>
                  {getUserInitials(ticket.assigned_to_name)}
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border border-dashed border-purple-500/25 flex items-center justify-center text-[9px] text-purple-300/30">?</div>
              )}
              <span className="text-[10px] text-neutral-500">
                {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
