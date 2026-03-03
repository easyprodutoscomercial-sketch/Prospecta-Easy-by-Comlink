'use client';

import { useState, useEffect } from 'react';
import type { Profile, SupportProject } from '@/lib/types';
import {
  SUPPORT_STATUS_LABELS,
  SUPPORT_TYPE_LABELS,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
} from '@/lib/utils/labels';

interface SuporteFiltersProps {
  filters: {
    status: string;
    ticket_type: string;
    category: string;
    priority: string;
    assigned_to: string;
    project_id: string;
    search: string;
  };
  onChange: (filters: any) => void;
}

export default function SuporteFilters({ filters, onChange }: SuporteFiltersProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<SupportProject[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, projectsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/suporte/projects'),
        ]);
        if (usersRes.ok) {
          const d = await usersRes.json();
          setUsers(d.users || []);
        }
        if (projectsRes.ok) {
          const d = await projectsRes.json();
          setProjects(d.projects || []);
        }
      } catch { /* silent */ }
    };
    load();
  }, []);

  const update = (key: string, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          placeholder="Buscar chamados..."
          className="w-full pl-9 pr-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50"
        />
      </div>

      {/* Status */}
      <select
        value={filters.status}
        onChange={(e) => update('status', e.target.value)}
        className="px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
      >
        <option value="">Todos Status</option>
        {Object.entries(SUPPORT_STATUS_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {/* Type */}
      <select
        value={filters.ticket_type}
        onChange={(e) => update('ticket_type', e.target.value)}
        className="px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
      >
        <option value="">Todos Tipos</option>
        {Object.entries(SUPPORT_TYPE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {/* Category */}
      <select
        value={filters.category}
        onChange={(e) => update('category', e.target.value)}
        className="px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
      >
        <option value="">Todas Categorias</option>
        {Object.entries(SUPPORT_CATEGORY_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {/* Priority */}
      <select
        value={filters.priority}
        onChange={(e) => update('priority', e.target.value)}
        className="px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
      >
        <option value="">Prioridade</option>
        {Object.entries(SUPPORT_PRIORITY_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {/* Project */}
      {projects.length > 0 && (
        <select
          value={filters.project_id}
          onChange={(e) => update('project_id', e.target.value)}
          className="px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
        >
          <option value="">Projeto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      {/* Assigned to */}
      <select
        value={filters.assigned_to}
        onChange={(e) => update('assigned_to', e.target.value)}
        className="px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
      >
        <option value="">Responsavel</option>
        {users.map((u) => (
          <option key={u.user_id} value={u.user_id}>{u.name}</option>
        ))}
      </select>
    </div>
  );
}
