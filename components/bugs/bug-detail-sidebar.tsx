'use client';

import { useState, useEffect } from 'react';
import type { BugReport, WorkFront, Profile } from '@/lib/types';
import { BUG_STATUS_LABELS, BUG_STATUS_COLORS, BUG_SEVERITY_LABELS, BUG_SEVERITY_COLORS, BUG_PRIORITY_LABELS, BUG_PRIORITY_COLORS } from '@/lib/utils/labels';
import { useToast } from '@/lib/toast-context';
import { getUserInitials } from '@/lib/utils/user-colors';

interface BugDetailSidebarProps {
  bug: BugReport;
  onUpdate: (updated: Partial<BugReport>) => void;
}

export default function BugDetailSidebar({ bug, onUpdate }: BugDetailSidebarProps) {
  const toast = useToast();
  const [workFronts, setWorkFronts] = useState<WorkFront[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [wfRes, usersRes] = await Promise.all([
          fetch('/api/work-fronts'),
          fetch('/api/users'),
        ]);
        if (wfRes.ok) { const d = await wfRes.json(); setWorkFronts(d.work_fronts || []); }
        if (usersRes.ok) { const d = await usersRes.json(); setUsers(d.users || []); }
      } catch { /* silent */ }
    };
    load();
  }, []);

  const handleChange = async (field: string, value: string | null) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/bugs/${bug.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        toast.success('Atualizado');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erro ao atualizar');
      }
    } catch {
      toast.error('Erro ao atualizar');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <div>
        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Status</label>
        <select
          value={bug.status}
          onChange={(e) => handleChange('status', e.target.value)}
          disabled={saving}
          className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        >
          {Object.entries(BUG_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div className="mt-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BUG_STATUS_COLORS[bug.status]}`}>
            {BUG_STATUS_LABELS[bug.status]}
          </span>
        </div>
      </div>

      {/* Severity */}
      <div>
        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Severidade</label>
        <select
          value={bug.severity}
          onChange={(e) => handleChange('severity', e.target.value)}
          disabled={saving}
          className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        >
          {Object.entries(BUG_SEVERITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Prioridade</label>
        <select
          value={bug.priority}
          onChange={(e) => handleChange('priority', e.target.value)}
          disabled={saving}
          className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        >
          {Object.entries(BUG_PRIORITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Assignee */}
      <div>
        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Responsavel</label>
        <select
          value={bug.assigned_to || ''}
          onChange={(e) => handleChange('assigned_to', e.target.value)}
          disabled={saving}
          className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        >
          <option value="">Nenhum</option>
          {users.map((u) => (
            <option key={u.user_id} value={u.user_id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Work Front */}
      <div>
        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Frente</label>
        <select
          value={bug.work_front_id || ''}
          onChange={(e) => handleChange('work_front_id', e.target.value)}
          disabled={saving}
          className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        >
          <option value="">Nenhuma</option>
          {workFronts.map((wf) => (
            <option key={wf.id} value={wf.id}>{wf.name}</option>
          ))}
        </select>
      </div>

      {/* Info */}
      <div className="pt-3 border-t border-purple-800/20 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Reportado por</span>
          <span className="text-neutral-300">{bug.reported_by_name || 'Desconhecido'}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Criado em</span>
          <span className="text-neutral-300">{new Date(bug.created_at).toLocaleDateString('pt-BR')}</span>
        </div>
        {bug.resolved_at && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500">Resolvido em</span>
            <span className="text-emerald-400">{new Date(bug.resolved_at).toLocaleDateString('pt-BR')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
