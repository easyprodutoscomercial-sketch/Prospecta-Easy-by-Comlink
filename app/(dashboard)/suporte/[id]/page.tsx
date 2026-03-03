'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { SupportTicket, SupportAttachment, SupportComment } from '@/lib/types';
import Tabs from '@/components/ui/tabs';
import SuporteDetailSidebar from '@/components/suporte/suporte-detail-sidebar';
import SuporteAttachments from '@/components/suporte/suporte-attachments';
import SuporteComments from '@/components/suporte/suporte-comments';
import {
  SUPPORT_STATUS_COLORS, SUPPORT_STATUS_LABELS,
  SUPPORT_TYPE_COLORS, SUPPORT_TYPE_LABELS,
  SUPPORT_CATEGORY_COLORS, SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_COLORS, SUPPORT_PRIORITY_LABELS,
} from '@/lib/utils/labels';
import ConfirmModal from '@/components/ui/confirm-modal';
import { useToast } from '@/lib/toast-context';
import { useSupportPipeline } from '@/lib/support-pipeline-context';

export default function SuporteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { currentPipeline } = useSupportPipeline();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [comments, setComments] = useState<SupportComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const stages = currentPipeline?.stages || [];

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/suporte/${id}`);
        if (res.ok) {
          const data = await res.json();
          setTicket(data.ticket || data);
          setAttachments(data.attachments || []);
          setComments(data.comments || []);
        } else {
          router.push('/suporte');
        }
      } catch {
        router.push('/suporte');
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/suporte/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Chamado removido');
        router.push('/suporte');
      } else {
        toast.error('Erro ao remover');
      }
    } catch {
      toast.error('Erro ao remover');
    }
    setDeleting(false);
    setShowDelete(false);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-purple-800/30 rounded w-1/3" />
          <div className="h-4 bg-purple-800/20 rounded w-1/2" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-60 bg-purple-800/10 rounded" />
            <div className="h-60 bg-purple-800/10 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  const tabs = [
    { key: 'details', label: 'Detalhes' },
    { key: 'attachments', label: 'Anexos', count: attachments.length },
    { key: 'comments', label: 'Comentarios', count: comments.length },
  ];

  // Find current stage for badge display
  const currentStage = stages.find((s) => s.id === ticket.stage_id);
  const isTerminal = currentStage
    ? currentStage.is_terminal
    : (ticket.status === 'RESOLVIDO' || ticket.status === 'FECHADO');

  const isOverdue = ticket.due_date &&
    new Date(ticket.due_date) < new Date() &&
    !isTerminal;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Back + actions */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push('/suporte')} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <button
          onClick={() => setShowDelete(true)}
          className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-red-400 border border-purple-800/30 hover:border-red-500/30 rounded-lg transition-colors"
        >
          Excluir
        </button>
      </div>

      {/* Title + badges */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-100 mb-2">{ticket.title}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {currentStage ? (
            <span
              className="text-xs px-2 py-0.5 rounded font-medium"
              style={{ backgroundColor: `${currentStage.color}30`, color: currentStage.color }}
            >
              {currentStage.name}
            </span>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${SUPPORT_STATUS_COLORS[ticket.status]}`}>
              {SUPPORT_STATUS_LABELS[ticket.status]}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${SUPPORT_TYPE_COLORS[ticket.ticket_type]}`}>
            {SUPPORT_TYPE_LABELS[ticket.ticket_type]}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${SUPPORT_CATEGORY_COLORS[ticket.category]}`}>
            {SUPPORT_CATEGORY_LABELS[ticket.category]}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${SUPPORT_PRIORITY_COLORS[ticket.priority]}`}>
            {SUPPORT_PRIORITY_LABELS[ticket.priority]}
          </span>
          {isOverdue && (
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-500/10 text-red-400">
              Vencido
            </span>
          )}
          {ticket.contact_name && (
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-purple-800/30 text-purple-300/50">
              {ticket.contact_name}
            </span>
          )}
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          <div className="mt-4">
            {activeTab === 'details' && (
              <div>
                {ticket.description ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div className="bg-[#160b2e] rounded-lg border border-purple-800/15 p-4">
                      <p className="text-sm text-neutral-300 whitespace-pre-wrap">{ticket.description}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-neutral-500">Sem descricao</p>
                  </div>
                )}

                {ticket.resolution_notes && (
                  <div className="mt-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-emerald-400 mb-1">Notas de Resolucao</h3>
                    <p className="text-sm text-neutral-300 whitespace-pre-wrap">{ticket.resolution_notes}</p>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'attachments' && (
              <SuporteAttachments ticketId={ticket.id} attachments={attachments} setAttachments={setAttachments} />
            )}
            {activeTab === 'comments' && (
              <SuporteComments ticketId={ticket.id} comments={comments} setComments={setComments} />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/20 p-4 h-fit">
          <SuporteDetailSidebar
            ticket={ticket}
            onUpdate={(updated) => setTicket((prev) => prev ? { ...prev, ...updated } : prev)}
            stages={stages}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Excluir chamado"
        message="Tem certeza que deseja excluir este chamado? Anexos e comentarios serao removidos."
        variant="danger"
        confirmLabel="Excluir"
        loading={deleting}
      />
    </div>
  );
}
