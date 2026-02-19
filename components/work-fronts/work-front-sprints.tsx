'use client';

import { useState } from 'react';
import type { WorkFrontSprint } from '@/lib/types';
import { SPRINT_STATUS_LABELS, SPRINT_STATUS_COLORS } from '@/lib/utils/labels';
import { useToast } from '@/lib/toast-context';
import WorkFrontSprintForm from './work-front-sprint-form';
import ConfirmModal from '@/components/ui/confirm-modal';

interface WorkFrontSprintsProps {
  workFrontId: string;
  sprints: WorkFrontSprint[];
  setSprints: React.Dispatch<React.SetStateAction<WorkFrontSprint[]>>;
}

export default function WorkFrontSprints({ workFrontId, sprints, setSprints }: WorkFrontSprintsProps) {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editSprint, setEditSprint] = useState<WorkFrontSprint | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleSaved = (sprint: WorkFrontSprint) => {
    if (editSprint) {
      setSprints((prev) => prev.map((s) => (s.id === sprint.id ? sprint : s)));
    } else {
      setSprints((prev) => [sprint, ...prev]);
    }
    setShowForm(false);
    setEditSprint(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/work-fronts/${workFrontId}/sprints/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        setSprints((prev) => prev.filter((s) => s.id !== deleteId));
        toast.success('Sprint removida');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erro ao remover');
      }
    } catch {
      toast.error('Erro ao remover');
    }
    setDeleteId(null);
    setDeleteLoading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-300">Sprints</h3>
        <button
          onClick={() => { setEditSprint(null); setShowForm(true); }}
          className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
        >
          + Nova Sprint
        </button>
      </div>

      {sprints.length > 0 ? (
        <div className="space-y-2">
          {sprints.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 bg-[#160b2e] rounded-lg border border-purple-800/15">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-neutral-200 truncate">{s.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SPRINT_STATUS_COLORS[s.status] || ''}`}>
                    {SPRINT_STATUS_LABELS[s.status] || s.status}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {new Date(s.starts_at).toLocaleDateString('pt-BR')} - {new Date(s.ends_at).toLocaleDateString('pt-BR')}
                  {s.goal && ` · ${s.goal}`}
                </p>
              </div>
              <button
                onClick={() => { setEditSprint(s); setShowForm(true); }}
                className="p-1.5 text-neutral-500 hover:text-emerald-400 transition-colors"
                title="Editar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => setDeleteId(s.id)}
                className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                title="Excluir"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-neutral-500">Nenhuma sprint criada</p>
        </div>
      )}

      {showForm && (
        <WorkFrontSprintForm
          workFrontId={workFrontId}
          sprint={editSprint}
          onClose={() => { setShowForm(false); setEditSprint(null); }}
          onSaved={handleSaved}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir sprint"
        message="Tem certeza que deseja excluir esta sprint?"
        variant="danger"
        confirmLabel="Excluir"
        loading={deleteLoading}
      />
    </div>
  );
}
