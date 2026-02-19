'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { BugReport, BugAttachment, BugComment } from '@/lib/types';
import Tabs from '@/components/ui/tabs';
import BugDetailSidebar from '@/components/bugs/bug-detail-sidebar';
import BugAttachments from '@/components/bugs/bug-attachments';
import BugComments from '@/components/bugs/bug-comments';
import { BUG_SEVERITY_COLORS, BUG_SEVERITY_LABELS, BUG_PRIORITY_COLORS, BUG_PRIORITY_LABELS, BUG_STATUS_COLORS, BUG_STATUS_LABELS } from '@/lib/utils/labels';
import ConfirmModal from '@/components/ui/confirm-modal';
import { useToast } from '@/lib/toast-context';

export default function BugDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [bug, setBug] = useState<BugReport | null>(null);
  const [attachments, setAttachments] = useState<BugAttachment[]>([]);
  const [comments, setComments] = useState<BugComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/bugs/${id}`);
        if (res.ok) {
          const data = await res.json();
          setBug(data.bug || data);
          setAttachments(data.attachments || []);
          setComments(data.comments || []);
        } else {
          router.push('/bugs');
        }
      } catch {
        router.push('/bugs');
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/bugs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Bug removido');
        router.push('/bugs');
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

  if (!bug) return null;

  const tabs = [
    { key: 'details', label: 'Detalhes' },
    { key: 'attachments', label: 'Anexos', count: attachments.length },
    { key: 'comments', label: 'Comentarios', count: comments.length },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Back + actions */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push('/bugs')} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
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
        <h1 className="text-xl font-bold text-neutral-100 mb-2">{bug.title}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${BUG_STATUS_COLORS[bug.status]}`}>
            {BUG_STATUS_LABELS[bug.status]}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${BUG_SEVERITY_COLORS[bug.severity]}`}>
            {BUG_SEVERITY_LABELS[bug.severity]}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${BUG_PRIORITY_COLORS[bug.priority]}`}>
            {BUG_PRIORITY_LABELS[bug.priority]}
          </span>
          {bug.tags?.map((tag) => (
            <span key={tag.id} className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>
              {tag.name}
            </span>
          ))}
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
                {bug.description ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div className="bg-[#160b2e] rounded-lg border border-purple-800/15 p-4">
                      <p className="text-sm text-neutral-300 whitespace-pre-wrap">{bug.description}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-neutral-500">Sem descricao</p>
                  </div>
                )}

                {bug.resolution_notes && (
                  <div className="mt-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-emerald-400 mb-1">Notas de Resolucao</h3>
                    <p className="text-sm text-neutral-300 whitespace-pre-wrap">{bug.resolution_notes}</p>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'attachments' && (
              <BugAttachments bugId={bug.id} attachments={attachments} setAttachments={setAttachments} />
            )}
            {activeTab === 'comments' && (
              <BugComments bugId={bug.id} comments={comments} setComments={setComments} />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/20 p-4 h-fit">
          <BugDetailSidebar
            bug={bug}
            onUpdate={(updated) => setBug((prev) => prev ? { ...prev, ...updated } : prev)}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Excluir bug"
        message="Tem certeza que deseja excluir este bug? Anexos e comentarios serao removidos."
        variant="danger"
        confirmLabel="Excluir"
        loading={deleting}
      />
    </div>
  );
}
