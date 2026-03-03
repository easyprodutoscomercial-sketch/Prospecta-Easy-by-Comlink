'use client';

import { useState, useEffect } from 'react';
import type { SupportTicket, Profile, SupportProject, PipelineStage } from '@/lib/types';
import {
  SUPPORT_STATUS_LABELS, SUPPORT_STATUS_COLORS,
  SUPPORT_TYPE_LABELS,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS, SUPPORT_PRIORITY_COLORS,
  SUPPORT_SEVERITY_LABELS,
} from '@/lib/utils/labels';
import { useToast } from '@/lib/toast-context';

interface SuporteDetailSidebarProps {
  ticket: SupportTicket;
  onUpdate: (updated: Partial<SupportTicket>) => void;
  stages?: PipelineStage[];
}

export default function SuporteDetailSidebar({ ticket, onUpdate, stages }: SuporteDetailSidebarProps) {
  const toast = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<SupportProject[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, projectsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/suporte/projects'),
        ]);
        if (usersRes.ok) { const d = await usersRes.json(); setUsers(d.users || []); }
        if (projectsRes.ok) { const d = await projectsRes.json(); setProjects(d.projects || []); }
      } catch { /* silent */ }
    };
    load();
  }, []);

  const handleChange = async (field: string, value: string | null) => {
    setSaving(true);
    try {
      const body: Record<string, any> = { [field]: value || null };
      // If changing stage via stage_id, also send it
      if (field === 'stage_id' && value) {
        body.stage_id = value;
      }
      const res = await fetch(`/api/suporte/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
        {stages && stages.length > 0 ? (
          <>
            <select
              value={ticket.stage_id || ''}
              onChange={(e) => handleChange('stage_id', e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="mt-1">
              {(() => {
                const currentStage = stages.find((s) => s.id === ticket.stage_id);
                if (currentStage) {
                  return (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: `${currentStage.color}30`, color: currentStage.color }}
                    >
                      {currentStage.name}
                    </span>
                  );
                }
                return (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_STATUS_COLORS[ticket.status]}`}>
                    {SUPPORT_STATUS_LABELS[ticket.status]}
                  </span>
                );
              })()}
            </div>
          </>
        ) : (
          <>
            <select
              value={ticket.status}
              onChange={(e) => handleChange('status', e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
            >
              {Object.entries(SUPPORT_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="mt-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SUPPORT_STATUS_COLORS[ticket.status]}`}>
                {SUPPORT_STATUS_LABELS[ticket.status]}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Type */}
      <div>
        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Tipo</label>
        <select
          value={ticket.ticket_type}
          onChange={(e) => handleChange('ticket_type', e.target.value)}
          disabled={saving}
          className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        >
          {Object.entries(SUPPORT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Severity - visible when type is BUG */}
      {ticket.ticket_type === 'BUG' && (
        <div>
          <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Severidade</label>
          <select
            value={ticket.severity || 'MEDIO'}
            onChange={(e) => handleChange('severity', e.target.value)}
            disabled={saving}
            className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
          >
            {Object.entries(SUPPORT_SEVERITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      )}

      {/* Category */}
      <div>
        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Categoria</label>
        <select
          value={ticket.category}
          onChange={(e) => handleChange('category', e.target.value)}
          disabled={saving}
          className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        >
          {Object.entries(SUPPORT_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Prioridade</label>
        <select
          value={ticket.priority}
          onChange={(e) => handleChange('priority', e.target.value)}
          disabled={saving}
          className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        >
          {Object.entries(SUPPORT_PRIORITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Assignee */}
      <div>
        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Responsavel</label>
        <select
          value={ticket.assigned_to || ''}
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

      {/* Project */}
      <div>
        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Projeto</label>
        <select
          value={ticket.project_id || ''}
          onChange={(e) => handleChange('project_id', e.target.value)}
          disabled={saving}
          className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        >
          <option value="">Nenhum</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Due Date */}
      <div>
        <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Data Limite</label>
        <input
          type="date"
          value={ticket.due_date || ''}
          onChange={(e) => handleChange('due_date', e.target.value)}
          disabled={saving}
          className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        />
      </div>

      {/* Info */}
      <div className="pt-3 border-t border-purple-800/20 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Reportado por</span>
          <span className="text-neutral-300">{ticket.reported_by_name || 'Desconhecido'}</span>
        </div>
        {ticket.contact_name && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500">Contato</span>
            <span className="text-neutral-300">{ticket.contact_name}</span>
          </div>
        )}
        {ticket.project_name && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500">Projeto</span>
            <span className="text-cyan-400">{ticket.project_name}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Criado em</span>
          <span className="text-neutral-300">{new Date(ticket.created_at).toLocaleDateString('pt-BR')}</span>
        </div>
        {ticket.resolved_at && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500">Resolvido em</span>
            <span className="text-emerald-400">{new Date(ticket.resolved_at).toLocaleDateString('pt-BR')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
