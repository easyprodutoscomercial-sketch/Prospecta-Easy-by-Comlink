'use client';

import { useState, useEffect } from 'react';
import {
  SUPPORT_STATUS_LABELS, SUPPORT_STATUS_COLORS,
  SUPPORT_TYPE_LABELS, SUPPORT_TYPE_COLORS,
  SUPPORT_PRIORITY_LABELS, SUPPORT_PRIORITY_COLORS,
  SUPPORT_CATEGORY_LABELS,
} from '@/lib/utils/labels';
import PortalComments from './portal-comments';

interface PortalTicketDetailProps {
  token: string;
  ticketId: string;
  onBack: () => void;
}

interface TicketDetail {
  id: string;
  title: string;
  description: string | null;
  ticket_type: string;
  category: string;
  priority: string;
  severity: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  public_url: string;
  created_at: string;
}

interface Comment {
  id: string;
  user_name: string;
  content: string;
  is_status_change: boolean;
  created_at: string;
}

export default function PortalTicketDetail({ token, ticketId, onBack }: PortalTicketDetailProps) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/portal/${token}/tickets/${ticketId}`);
        if (res.ok) {
          const data = await res.json();
          setTicket(data.ticket);
          setComments(data.comments || []);
          setAttachments(data.attachments || []);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, [token, ticketId]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-purple-800/30 rounded w-2/3" />
        <div className="h-4 bg-purple-800/20 rounded w-1/3" />
        <div className="h-32 bg-purple-800/10 rounded" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-8">
        <p className="text-neutral-400 text-sm">Chamado nao encontrado</p>
        <button onClick={onBack} className="mt-2 text-sm text-emerald-400 hover:text-emerald-300">Voltar</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>

      {/* Title + Badges */}
      <div>
        <h2 className="text-lg font-bold text-neutral-100 mb-2">{ticket.title}</h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${SUPPORT_STATUS_COLORS[ticket.status] || ''}`}>
            {SUPPORT_STATUS_LABELS[ticket.status] || ticket.status}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${SUPPORT_TYPE_COLORS[ticket.ticket_type] || ''}`}>
            {SUPPORT_TYPE_LABELS[ticket.ticket_type] || ticket.ticket_type}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${SUPPORT_PRIORITY_COLORS[ticket.priority] || ''}`}>
            {SUPPORT_PRIORITY_LABELS[ticket.priority] || ticket.priority}
          </span>
          <span className="text-xs px-2 py-0.5 rounded font-medium bg-purple-800/20 text-purple-300/50">
            {SUPPORT_CATEGORY_LABELS[ticket.category] || ticket.category}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500">
          <span>Criado em {new Date(ticket.created_at).toLocaleDateString('pt-BR')}</span>
          {ticket.resolved_at && (
            <span className="text-emerald-400">Resolvido em {new Date(ticket.resolved_at).toLocaleDateString('pt-BR')}</span>
          )}
        </div>
      </div>

      {/* Description */}
      {ticket.description && (
        <div className="bg-[#160b2e] rounded-lg border border-purple-800/15 p-4">
          <p className="text-sm text-neutral-300 whitespace-pre-wrap">{ticket.description}</p>
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Anexos</h3>
          <div className="space-y-1">
            {attachments.map((att) => (
              <a
                key={att.id}
                href={att.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-[#160b2e] border border-purple-800/20 rounded-lg hover:border-purple-600/30 transition-colors"
              >
                <svg className="w-4 h-4 text-purple-400/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-xs text-neutral-300 truncate flex-1">{att.file_name}</span>
                <span className="text-[10px] text-neutral-500">{formatFileSize(att.file_size)}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <PortalComments
        token={token}
        ticketId={ticketId}
        comments={comments}
        onNewComment={(comment) => setComments((prev) => [...prev, comment])}
      />
    </div>
  );
}
