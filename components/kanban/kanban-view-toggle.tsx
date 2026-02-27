'use client';

import type { KanbanViewMode } from '@/lib/types';

interface KanbanViewToggleProps {
  view: KanbanViewMode;
  onChange: (view: KanbanViewMode) => void;
}

export default function KanbanViewToggle({ view, onChange }: KanbanViewToggleProps) {
  return (
    <div className="flex items-center bg-[#160b2e] border border-purple-800/30 rounded-lg p-0.5">
      {/* Kanban */}
      <button
        onClick={() => onChange('kanban')}
        className={`min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center ${
          view === 'kanban' ? 'bg-emerald-500/15 text-emerald-400' : 'text-neutral-500 hover:text-neutral-300'
        }`}
        title="Kanban"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      </button>
      {/* List */}
      <button
        onClick={() => onChange('list')}
        className={`min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center ${
          view === 'list' ? 'bg-emerald-500/15 text-emerald-400' : 'text-neutral-500 hover:text-neutral-300'
        }`}
        title="Lista"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      </button>
      {/* Compact */}
      <button
        onClick={() => onChange('compact')}
        className={`min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center ${
          view === 'compact' ? 'bg-emerald-500/15 text-emerald-400' : 'text-neutral-500 hover:text-neutral-300'
        }`}
        title="Compacto"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      </button>
    </div>
  );
}
