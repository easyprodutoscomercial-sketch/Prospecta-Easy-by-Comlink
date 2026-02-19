'use client';

import { useState, useEffect } from 'react';

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

interface SavedViewsProps {
  storageKey: string;
  currentFilters: Record<string, string>;
  onApply: (filters: Record<string, string>) => void;
}

export default function SavedViews({ storageKey, currentFilters, onApply }: SavedViewsProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [viewName, setViewName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setViews(JSON.parse(stored));
    } catch { /* silent */ }
  }, [storageKey]);

  const hasActiveFilters = Object.values(currentFilters).some(v => v && v !== 'all');

  const saveView = () => {
    if (!viewName.trim()) return;
    const newView: SavedView = {
      id: Date.now().toString(),
      name: viewName.trim(),
      filters: { ...currentFilters },
      createdAt: new Date().toISOString(),
    };
    const updated = [...views, newView];
    setViews(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setViewName('');
    setShowSave(false);
  };

  const deleteView = (id: string) => {
    const updated = views.filter(v => v.id !== id);
    setViews(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      {/* Saved views dropdown */}
      {views.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-300/60 bg-[#2a1245] border border-purple-700/30 rounded-lg hover:bg-purple-800/30 hover:text-purple-200 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Views ({views.length})
            <svg className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDropdown && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 w-56 bg-[#1e0f35] border border-purple-800/30 rounded-lg shadow-xl z-40 py-1">
                {views.map((view) => (
                  <div key={view.id} className="flex items-center gap-1 px-3 py-2 hover:bg-purple-800/20 transition-colors group">
                    <button
                      onClick={() => { onApply(view.filters); setShowDropdown(false); }}
                      className="flex-1 text-left text-xs text-neutral-200 truncate"
                    >
                      {view.name}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteView(view.id); }}
                      className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Save current filters button */}
      {hasActiveFilters && !showSave && (
        <button
          onClick={() => setShowSave(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-400/70 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-400 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Salvar view
        </button>
      )}

      {/* Save dialog */}
      {showSave && (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveView(); if (e.key === 'Escape') setShowSave(false); }}
            placeholder="Nome da view..."
            className="px-2 py-1.5 text-xs bg-[#2a1245] border border-purple-700/30 rounded-lg text-neutral-200 placeholder:text-purple-300/40 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36"
            autoFocus
          />
          <button onClick={saveView} className="px-2 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors">
            Salvar
          </button>
          <button onClick={() => setShowSave(false)} className="px-1.5 py-1.5 text-xs text-purple-300/40 hover:text-purple-300 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
