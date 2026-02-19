'use client';

import { useState } from 'react';
import type { WorkFrontSprint } from '@/lib/types';
import { useToast } from '@/lib/toast-context';

interface WorkFrontSprintFormProps {
  workFrontId: string;
  sprint?: WorkFrontSprint | null;
  onClose: () => void;
  onSaved: (sprint: WorkFrontSprint) => void;
}

export default function WorkFrontSprintForm({ workFrontId, sprint, onClose, onSaved }: WorkFrontSprintFormProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(sprint?.name || '');
  const [goal, setGoal] = useState(sprint?.goal || '');
  const [startsAt, setStartsAt] = useState(sprint?.starts_at?.split('T')[0] || '');
  const [endsAt, setEndsAt] = useState(sprint?.ends_at?.split('T')[0] || '');
  const [status, setStatus] = useState<string>(sprint?.status || 'PLANEJADA');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startsAt || !endsAt) return;
    setSaving(true);
    try {
      const url = sprint
        ? `/api/work-fronts/${workFrontId}/sprints/${sprint.id}`
        : `/api/work-fronts/${workFrontId}/sprints`;
      const method = sprint ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), goal: goal.trim() || null, starts_at: startsAt, ends_at: endsAt, status }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(sprint ? 'Sprint atualizada' : 'Sprint criada');
        onSaved(data);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erro ao salvar');
      }
    } catch {
      toast.error('Erro ao salvar');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1e0f35] rounded-xl border border-purple-700/30 w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-800/20">
          <h2 className="text-base font-semibold text-neutral-100">
            {sprint ? 'Editar Sprint' : 'Nova Sprint'}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Nome *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Sprint 1"
              className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/20"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Meta</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Objetivo da sprint..."
              rows={2}
              className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/20 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Inicio *</label>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Fim *</label>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
              />
            </div>
          </div>

          {sprint && (
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
              >
                <option value="PLANEJADA">Planejada</option>
                <option value="ATIVA">Ativa</option>
                <option value="CONCLUIDA">Concluida</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !startsAt || !endsAt}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : sprint ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
