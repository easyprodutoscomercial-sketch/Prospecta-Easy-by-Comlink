'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { BugReport, BugStatus } from '@/lib/types';
import { useToast } from '@/lib/toast-context';
import BugStatsCards from '@/components/bugs/bug-stats-cards';
import BugFilters from '@/components/bugs/bug-filters';
import BugViewToggle from '@/components/bugs/bug-view-toggle';
import BugList from '@/components/bugs/bug-list';
import { BugKanbanBoard } from '@/components/bugs/bug-kanban-board';

export default function BugsPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [activeBug, setActiveBug] = useState<BugReport | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    priority: '',
    work_front_id: searchParams.get('work_front_id') || '',
    search: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const loadBugs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.work_front_id) params.set('work_front_id', filters.work_front_id);
      if (filters.search) params.set('search', filters.search);
      params.set('limit', '200');

      const res = await fetch(`/api/bugs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBugs(data.bugs || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [filters]);

  useEffect(() => { loadBugs(); }, [loadBugs]);

  const handleDragStart = (event: DragStartEvent) => {
    const bug = bugs.find((b) => b.id === event.active.id);
    setActiveBug(bug || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveBug(null);
    const { active, over } = event;
    if (!over) return;

    const bugId = active.id as string;
    const newStatus = over.id as BugStatus;
    const bug = bugs.find((b) => b.id === bugId);
    if (!bug || bug.status === newStatus) return;

    // Optimistic update
    setBugs((prev) => prev.map((b) => b.id === bugId ? { ...b, status: newStatus } : b));

    try {
      const res = await fetch(`/api/bugs/${bugId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        // Revert
        setBugs((prev) => prev.map((b) => b.id === bugId ? { ...b, status: bug.status } : b));
        toast.error('Erro ao mover bug');
      }
    } catch {
      setBugs((prev) => prev.map((b) => b.id === bugId ? { ...b, status: bug.status } : b));
      toast.error('Erro ao mover bug');
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-100">Apontamento de Erros</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Gerencie bugs e problemas reportados</p>
        </div>
        <Link
          href="/bugs/new"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Bug
        </Link>
      </div>

      {/* Stats */}
      <BugStatsCards />

      {/* Filters + View Toggle */}
      <div className="flex items-center gap-3 mt-6 mb-4">
        <div className="flex-1">
          <BugFilters filters={filters} onChange={setFilters} />
        </div>
        <BugViewToggle view={view} onChange={setView} />
      </div>

      {/* Content */}
      {view === 'kanban' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <BugKanbanBoard bugs={bugs} activeBug={activeBug} />
        </DndContext>
      ) : (
        <BugList bugs={bugs} loading={loading} />
      )}
    </div>
  );
}
