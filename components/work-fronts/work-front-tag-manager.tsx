'use client';

import { useState, useEffect } from 'react';
import type { WorkFrontTag } from '@/lib/types';
import { useToast } from '@/lib/toast-context';
import ConfirmModal from '@/components/ui/confirm-modal';

const TAG_COLORS = ['#6366F1', '#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#EC4899', '#06B6D4', '#F97316'];

export default function WorkFrontTagManager() {
  const toast = useToast();
  const [tags, setTags] = useState<WorkFrontTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366F1');
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/work-front-tags');
        if (res.ok) {
          const data = await res.json();
          setTags(data.tags || []);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/work-front-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (res.ok) {
        const data = await res.json();
        setTags((prev) => [...prev, data]);
        setNewName('');
        toast.success('Tag criada');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erro ao criar tag');
      }
    } catch {
      toast.error('Erro ao criar tag');
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/work-front-tags/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        setTags((prev) => prev.filter((t) => t.id !== deleteId));
        toast.success('Tag removida');
      } else {
        toast.error('Erro ao remover');
      }
    } catch {
      toast.error('Erro ao remover');
    }
    setDeleteId(null);
    setDeleteLoading(false);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-300 mb-3">Tags</h3>

      {/* Create */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome da tag..."
          className="flex-1 px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50"
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <div className="flex gap-1 shrink-0">
          {TAG_COLORS.slice(0, 4).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setNewColor(c)}
              className={`w-6 h-6 rounded-md transition-all ${newColor === c ? 'ring-2 ring-white/50' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          className="px-3 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {creating ? '...' : '+'}
        </button>
      </div>

      {/* Tags list */}
      {loading ? (
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-20 bg-purple-800/20 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tags.length > 0 ? (
        <div className="flex gap-2 flex-wrap">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
              {tag.name}
              <button
                onClick={() => setDeleteId(tag.id)}
                className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-500">Nenhuma tag criada</p>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir tag"
        message="Tem certeza que deseja excluir esta tag?"
        variant="danger"
        confirmLabel="Excluir"
        loading={deleteLoading}
      />
    </div>
  );
}
