'use client';

import type { ContactView } from '@/lib/hooks/use-contact-preferences';

interface ContactsToolbarProps {
  activeView: ContactView;
  onViewChange: (view: ContactView) => void;
  density: number;
  onDensityChange: (v: number) => void;
  hiddenCount: number;
  onRevealAll: () => void;
  isMapView: boolean;
}

export default function ContactsToolbar({
  activeView,
  onViewChange,
  density,
  onDensityChange,
  hiddenCount,
  onRevealAll,
  isMapView,
}: ContactsToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap bg-[#1e0f35] rounded-xl border border-purple-800/30 px-3 py-2.5">
      {/* Left: View toggle */}
      <div className="flex items-center bg-[#160b2e] rounded-lg p-0.5 shrink-0">
        <button
          onClick={() => onViewChange('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            activeView === 'list'
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Lista
        </button>
        <button
          onClick={() => onViewChange('map')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            activeView === 'map'
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Mapa
        </button>
        <button
          onClick={() => onViewChange('import')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            activeView === 'import'
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Importar
        </button>
      </div>

      {/* Center: Density slider (only for list view) */}
      {activeView === 'list' && (
        <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
          <span className="text-[10px] text-neutral-500 whitespace-nowrap hidden sm:inline">Compacto</span>
          <input
            type="range"
            min="0"
            max="100"
            value={density}
            onChange={(e) => onDensityChange(Number(e.target.value))}
            className="density-slider w-24 sm:w-32 h-1.5 rounded-full appearance-none cursor-pointer"
            title={`Densidade: ${density}%`}
          />
          <span className="text-[10px] text-neutral-500 whitespace-nowrap hidden sm:inline">Expandido</span>
        </div>
      )}

      {/* Right: Hidden counter (only for list view) */}
      {activeView === 'list' && hiddenCount > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-neutral-500">
            {hiddenCount} oculto{hiddenCount !== 1 ? 's' : ''}
          </span>
          <button
            onClick={onRevealAll}
            className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Revelar todos
          </button>
        </div>
      )}
    </div>
  );
}
