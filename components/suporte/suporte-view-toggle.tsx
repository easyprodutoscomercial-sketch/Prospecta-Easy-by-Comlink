'use client';

interface SuporteViewToggleProps {
  view: 'list' | 'kanban';
  onChange: (view: 'list' | 'kanban') => void;
}

export default function SuporteViewToggle({ view, onChange }: SuporteViewToggleProps) {
  return (
    <div className="flex items-center bg-[#160b2e] border border-purple-800/30 rounded-lg p-0.5">
      <button
        onClick={() => onChange('list')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          view === 'list' ? 'bg-emerald-500/15 text-emerald-400' : 'text-neutral-500 hover:text-neutral-300'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      </button>
      <button
        onClick={() => onChange('kanban')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          view === 'kanban' ? 'bg-emerald-500/15 text-emerald-400' : 'text-neutral-500 hover:text-neutral-300'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      </button>
    </div>
  );
}
