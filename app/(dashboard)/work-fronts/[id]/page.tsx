'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { WorkFront, WorkFrontMember, WorkFrontSprint } from '@/lib/types';
import WorkFrontDetail from '@/components/work-fronts/work-front-detail';
import WorkFrontForm from '@/components/work-fronts/work-front-form';
import ConfirmModal from '@/components/ui/confirm-modal';
import { useToast } from '@/lib/toast-context';

export default function WorkFrontDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [workFront, setWorkFront] = useState<WorkFront | null>(null);
  const [members, setMembers] = useState<WorkFrontMember[]>([]);
  const [sprints, setSprints] = useState<WorkFrontSprint[]>([]);
  const [bugCount, setBugCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/work-fronts/${id}`);
        if (res.ok) {
          const data = await res.json();
          setWorkFront(data.work_front || data);
          setMembers(data.members || []);
          setSprints(data.sprints || []);
          setBugCount(data.bug_count || 0);
        } else {
          router.push('/work-fronts');
        }
      } catch {
        router.push('/work-fronts');
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/work-fronts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Frente removida');
        router.push('/work-fronts');
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
      <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-800/30" />
            <div className="flex-1">
              <div className="h-6 bg-purple-800/30 rounded w-1/3 mb-2" />
              <div className="h-4 bg-purple-800/20 rounded w-1/2" />
            </div>
          </div>
          <div className="h-10 bg-purple-800/20 rounded" />
          <div className="h-40 bg-purple-800/10 rounded" />
        </div>
      </div>
    );
  }

  if (!workFront) return null;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Back + actions */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push('/work-fronts')} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-emerald-400 border border-purple-800/30 hover:border-emerald-500/30 rounded-lg transition-colors"
          >
            Editar
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-red-400 border border-purple-800/30 hover:border-red-500/30 rounded-lg transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>

      <WorkFrontDetail
        workFront={workFront}
        members={members}
        sprints={sprints}
        bugCount={bugCount}
      />

      {showEdit && (
        <WorkFrontForm
          workFront={workFront}
          onClose={() => setShowEdit(false)}
          onSaved={(wf) => { setWorkFront(wf); setShowEdit(false); }}
        />
      )}

      <ConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Excluir frente"
        message="Tem certeza que deseja excluir esta frente de trabalho? Membros e sprints serao removidos."
        variant="danger"
        confirmLabel="Excluir"
        loading={deleting}
      />
    </div>
  );
}
