'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkFront, WorkFrontSprint, WorkFrontTag, Profile } from '@/lib/types';
import { useToast } from '@/lib/toast-context';

interface BugFormProps {
  defaultWorkFrontId?: string;
}

export default function BugForm({ defaultWorkFrontId }: BugFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [workFronts, setWorkFronts] = useState<WorkFront[]>([]);
  const [sprints, setSprints] = useState<WorkFrontSprint[]>([]);
  const [tags, setTags] = useState<WorkFrontTag[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('MEDIO');
  const [priority, setPriority] = useState('NORMAL');
  const [workFrontId, setWorkFrontId] = useState(defaultWorkFrontId || '');
  const [sprintId, setSprintId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [wfRes, tagsRes, usersRes] = await Promise.all([
          fetch('/api/work-fronts'),
          fetch('/api/work-front-tags'),
          fetch('/api/users'),
        ]);
        if (wfRes.ok) { const d = await wfRes.json(); setWorkFronts(d.work_fronts || []); }
        if (tagsRes.ok) { const d = await tagsRes.json(); setTags(d.tags || []); }
        if (usersRes.ok) { const d = await usersRes.json(); setUsers(d.users || []); }
      } catch { /* silent */ }
    };
    load();
  }, []);

  useEffect(() => {
    if (!workFrontId) { setSprints([]); return; }
    const load = async () => {
      try {
        const res = await fetch(`/api/work-fronts/${workFrontId}/sprints`);
        if (res.ok) { const d = await res.json(); setSprints(d.sprints || []); }
      } catch { /* silent */ }
    };
    load();
  }, [workFrontId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          severity,
          priority,
          work_front_id: workFrontId || null,
          sprint_id: sprintId || null,
          assigned_to: assignedTo || null,
          tag_ids: selectedTagIds,
        }),
      });
      if (res.ok) {
        const bug = await res.json();
        toast.success('Bug criado com sucesso');
        router.push(`/bugs/${bug.id}`);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erro ao criar bug');
      }
    } catch {
      toast.error('Erro ao criar bug');
    }
    setSaving(false);
  };

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Titulo *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Descreva o bug brevemente..."
          className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/20"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Descricao</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Passos para reproduzir, comportamento esperado vs real..."
          rows={5}
          className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/20 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Severidade</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
          >
            <option value="CRITICO">Critico</option>
            <option value="ALTO">Alto</option>
            <option value="MEDIO">Medio</option>
            <option value="BAIXO">Baixo</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Prioridade</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
          >
            <option value="URGENTE">Urgente</option>
            <option value="ALTA">Alta</option>
            <option value="NORMAL">Normal</option>
            <option value="BAIXA">Baixa</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Frente de Trabalho</label>
          <select
            value={workFrontId}
            onChange={(e) => { setWorkFrontId(e.target.value); setSprintId(''); }}
            className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
          >
            <option value="">Nenhuma</option>
            {workFronts.map((wf) => (
              <option key={wf.id} value={wf.id}>{wf.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Sprint</label>
          <select
            value={sprintId}
            onChange={(e) => setSprintId(e.target.value)}
            disabled={!workFrontId}
            className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50 disabled:opacity-50"
          >
            <option value="">Nenhuma</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Responsavel</label>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        >
          <option value="">Nenhum</option>
          {users.map((u) => (
            <option key={u.user_id} value={u.user_id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedTagIds.includes(tag.id)
                    ? 'ring-2 ring-white/30 scale-105'
                    : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-purple-800/20">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-6 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Criando...' : 'Criar Bug'}
        </button>
      </div>
    </form>
  );
}
