'use client';

import { useState } from 'react';
import type { WorkFront } from '@/lib/types';
import { useToast } from '@/lib/toast-context';

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#EC4899', '#06B6D4', '#F97316'];

interface WorkFrontFormProps {
  workFront?: WorkFront | null;
  onClose: () => void;
  onSaved: (wf: WorkFront) => void;
}

export default function WorkFrontForm({ workFront, onClose, onSaved }: WorkFrontFormProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(workFront?.name || '');
  const [description, setDescription] = useState(workFront?.description || '');
  const [color, setColor] = useState(workFront?.color || '#8B5CF6');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const url = workFront ? `/api/work-fronts/${workFront.id}` : '/api/work-fronts';
      const method = workFront ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, color }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(workFront ? 'Frente atualizada' : 'Frente criada');
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
            {workFront ? 'Editar Frente' : 'Nova Frente de Trabalho'}
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
              placeholder="Ex: Squad Frontend"
              className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/20"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Descricao</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descricao da frente de trabalho..."
              rows={3}
              className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/20 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Cor</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-all ${color === c ? 'ring-2 ring-white/50 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : workFront ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
