'use client';

import { useState, useEffect } from 'react';
import type { WorkFront } from '@/lib/types';
import { BUG_STATUS_LABELS, BUG_SEVERITY_LABELS, BUG_PRIORITY_LABELS } from '@/lib/utils/labels';

interface BugFiltersProps {
  filters: {
    status: string;
    severity: string;
    priority: string;
    work_front_id: string;
    search: string;
  };
  onChange: (filters: any) => void;
}

export default function BugFilters({ filters, onChange }: BugFiltersProps) {
  const [workFronts, setWorkFronts] = useState<WorkFront[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/work-fronts');
        if (res.ok) {
          const data = await res.json();
          setWorkFronts(data.work_fronts || []);
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
          placeholder="Buscar bugs..."
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
        {Object.entries(BUG_STATUS_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {/* Severity */}
      <select
        value={filters.severity}
        onChange={(e) => update('severity', e.target.value)}
        className="px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
      >
        <option value="">Severidade</option>
        {Object.entries(BUG_SEVERITY_LABELS).map(([k, v]) => (
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
        {Object.entries(BUG_PRIORITY_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {/* Work Front */}
      <select
        value={filters.work_front_id}
        onChange={(e) => update('work_front_id', e.target.value)}
        className="px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
      >
        <option value="">Todas Frentes</option>
        {workFronts.map((wf) => (
          <option key={wf.id} value={wf.id}>{wf.name}</option>
        ))}
      </select>
    </div>
  );
}
