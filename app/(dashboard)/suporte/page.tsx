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
import type { SupportTicket, SupportStatus } from '@/lib/types';
import { useToast } from '@/lib/toast-context';
import SuporteStatsCards from '@/components/suporte/suporte-stats-cards';
import SuporteFilters from '@/components/suporte/suporte-filters';
import SuporteViewToggle from '@/components/suporte/suporte-view-toggle';
import SuporteList from '@/components/suporte/suporte-list';
import { SuporteKanbanBoard } from '@/components/suporte/suporte-kanban-board';

export default function SuportePage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    ticket_type: searchParams.get('ticket_type') || '',
    category: '',
    priority: '',
    assigned_to: '',
    project_id: searchParams.get('project_id') || '',
    search: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const loadTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.ticket_type) params.set('ticket_type', filters.ticket_type);
      if (filters.category) params.set('category', filters.category);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.assigned_to) params.set('assigned_to', filters.assigned_to);
      if (filters.project_id) params.set('project_id', filters.project_id);
      if (filters.search) params.set('search', filters.search);
      params.set('limit', '200');

      const res = await fetch(`/api/suporte?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [filters]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find((t) => t.id === event.active.id);
    setActiveTicket(ticket || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTicket(null);
    const { active, over } = event;
    if (!over) return;

    const ticketId = active.id as string;
    const newStatus = over.id as SupportStatus;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status === newStatus) return;

    // Optimistic update
    setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status: newStatus } : t));

    try {
      const res = await fetch(`/api/suporte/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        // Revert
        setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status: ticket.status } : t));
        toast.error('Erro ao mover chamado');
      }
    } catch {
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status: ticket.status } : t));
      toast.error('Erro ao mover chamado');
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-100">Suporte</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Gerencie chamados, tarefas e bugs</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/suporte/projects"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-300 border border-purple-800/30 hover:border-purple-600/40 hover:bg-purple-800/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Projetos
          </Link>
          <Link
            href="/suporte/new"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Chamado
          </Link>
        </div>
      </div>

      {/* Stats */}
      <SuporteStatsCards />

      {/* Filters + View Toggle */}
      <div className="flex items-center gap-3 mt-6 mb-4">
        <div className="flex-1">
          <SuporteFilters filters={filters} onChange={setFilters} />
        </div>
        <SuporteViewToggle view={view} onChange={setView} />
      </div>

      {/* Content */}
      {view === 'kanban' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SuporteKanbanBoard tickets={tickets} activeTicket={activeTicket} />
        </DndContext>
      ) : (
        <SuporteList tickets={tickets} loading={loading} />
      )}
    </div>
  );
}
