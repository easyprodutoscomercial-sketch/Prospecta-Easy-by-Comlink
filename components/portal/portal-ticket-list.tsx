'use client';

import {
  SUPPORT_STATUS_LABELS, SUPPORT_STATUS_COLORS,
  SUPPORT_TYPE_LABELS, SUPPORT_TYPE_COLORS,
  SUPPORT_PRIORITY_LABELS, SUPPORT_PRIORITY_COLORS,
} from '@/lib/utils/labels';

interface PortalTicket {
  id: string;
  title: string;
  ticket_type: string;
  category: string;
  priority: string;
  severity: string | null;
  status: string;
  created_at: string;
}

interface PortalTicketListProps {
  tickets: PortalTicket[];
  onSelect: (ticketId: string) => void;
}

export default function PortalTicketList({ tickets, onSelect }: PortalTicketListProps) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-12 h-12 mx-auto mb-3 text-purple-700/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-neutral-400 text-sm">Nenhum chamado encontrado</p>
        <p className="text-neutral-600 text-xs mt-1">Abra um novo chamado usando o botao acima</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tickets.map((ticket) => (
        <button
          key={ticket.id}
          onClick={() => onSelect(ticket.id)}
          className="w-full text-left flex items-center gap-3 p-3 bg-[#1e0f35] rounded-lg border border-purple-800/20 hover:border-purple-600/40 hover:bg-[#241540] transition-all"
        >
          {/* Status dot */}
          <div className={`w-2 h-2 rounded-full shrink-0 ${
            ticket.status === 'ABERTO' ? 'bg-red-500' :
            ticket.status === 'EM_ANDAMENTO' ? 'bg-blue-500' :
            ticket.status === 'AGUARDANDO' ? 'bg-amber-500' :
            ticket.status === 'RESOLVIDO' ? 'bg-emerald-500' : 'bg-neutral-500'
          }`} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-200 truncate">{ticket.title}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_STATUS_COLORS[ticket.status] || 'bg-neutral-500/20 text-neutral-400'}`}>
                {SUPPORT_STATUS_LABELS[ticket.status] || ticket.status}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_TYPE_COLORS[ticket.ticket_type] || ''}`}>
                {SUPPORT_TYPE_LABELS[ticket.ticket_type] || ticket.ticket_type}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_PRIORITY_COLORS[ticket.priority] || ''}`}>
                {SUPPORT_PRIORITY_LABELS[ticket.priority] || ticket.priority}
              </span>
            </div>
          </div>

          {/* Date */}
          <span className="text-[10px] text-neutral-500 shrink-0">
            {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
          </span>
        </button>
      ))}
    </div>
  );
}
