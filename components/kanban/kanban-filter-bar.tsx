'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Contact } from '@/lib/types';
import type { UserInfo } from './kanban-card';
import { TEMPERATURA_LABELS, TEMPERATURA_COLORS, ORIGEM_LABELS } from '@/lib/utils/labels';

type FilterMode = 'dim' | 'hide';

interface ActiveChipFilters {
  temperatura: Set<string>;
  responsavel: Set<string>;
  origem: Set<string>;
}

interface KanbanFilterBarProps {
  contacts: Contact[];
  userMap: Record<string, UserInfo>;
  onFiltersChange: (dimmedIds: Set<string>, hiddenIds: Set<string>, stuckIds: Set<string>) => void;
}

const TEMP_CHIP_COLORS: Record<string, { active: string; inactive: string }> = {
  FRIO: { active: 'bg-blue-500/20 text-blue-400 border-blue-500/40', inactive: 'bg-blue-500/5 text-blue-400/40 border-blue-500/15' },
  MORNO: { active: 'bg-amber-500/20 text-amber-400 border-amber-500/40', inactive: 'bg-amber-500/5 text-amber-400/40 border-amber-500/15' },
  QUENTE: { active: 'bg-red-500/20 text-red-400 border-red-500/40', inactive: 'bg-red-500/5 text-red-400/40 border-red-500/15' },
};

export function KanbanFilterBar({ contacts, userMap, onFiltersChange }: KanbanFilterBarProps) {
  const [mode, setMode] = useState<FilterMode>('dim');
  const [chipFilters, setChipFilters] = useState<ActiveChipFilters>({
    temperatura: new Set(),
    responsavel: new Set(),
    origem: new Set(),
  });
  const [stuckEnabled, setStuckEnabled] = useState(false);
  const [stuckDays, setStuckDays] = useState(7);

  // Count contacts by temperatura
  const tempCounts = useMemo(() => {
    const counts: Record<string, number> = { FRIO: 0, MORNO: 0, QUENTE: 0 };
    for (const c of contacts) {
      if (c.temperatura && counts[c.temperatura] !== undefined) {
        counts[c.temperatura]++;
      }
    }
    return counts;
  }, [contacts]);

  // Count contacts by responsavel
  const responsavelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of contacts) {
      const uid = c.assigned_to_user_id || '_none';
      counts[uid] = (counts[uid] || 0) + 1;
    }
    return counts;
  }, [contacts]);

  // Count contacts by origem
  const origemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of contacts) {
      if (c.origem) {
        counts[c.origem] = (counts[c.origem] || 0) + 1;
      }
    }
    return counts;
  }, [contacts]);

  const hasActiveFilters = chipFilters.temperatura.size > 0 || chipFilters.responsavel.size > 0 || chipFilters.origem.size > 0;

  // Notify parent via useEffect (avoids setState-during-render)
  const onFiltersChangeRef = useRef(onFiltersChange);
  onFiltersChangeRef.current = onFiltersChange;

  useEffect(() => {
    const dimmedIds = new Set<string>();
    const hiddenIds = new Set<string>();
    const stuckIds = new Set<string>();

    const hasAnyChipFilter = chipFilters.temperatura.size > 0 || chipFilters.responsavel.size > 0 || chipFilters.origem.size > 0;

    for (const c of contacts) {
      let matches = true;

      if (chipFilters.temperatura.size > 0) {
        if (!c.temperatura || !chipFilters.temperatura.has(c.temperatura)) {
          matches = false;
        }
      }

      if (chipFilters.responsavel.size > 0) {
        const uid = c.assigned_to_user_id || '_none';
        if (!chipFilters.responsavel.has(uid)) {
          matches = false;
        }
      }

      if (chipFilters.origem.size > 0) {
        if (!c.origem || !chipFilters.origem.has(c.origem)) {
          matches = false;
        }
      }

      if (hasAnyChipFilter && !matches) {
        if (mode === 'hide') {
          hiddenIds.add(c.id);
        } else {
          dimmedIds.add(c.id);
        }
      }

      if (stuckEnabled) {
        const daysSinceUpdate = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceUpdate > stuckDays) {
          stuckIds.add(c.id);
        }
      }
    }

    onFiltersChangeRef.current(dimmedIds, hiddenIds, stuckIds);
  }, [contacts, chipFilters, mode, stuckEnabled, stuckDays]);

  const toggleChip = (category: keyof ActiveChipFilters, value: string) => {
    setChipFilters(prev => {
      const next = { ...prev, [category]: new Set(prev[category]) };
      if (next[category].has(value)) {
        next[category].delete(value);
      } else {
        next[category].add(value);
      }
      return next;
    });
  };

  const toggleMode = () => {
    setMode(prev => prev === 'dim' ? 'hide' : 'dim');
  };

  const toggleStuck = () => {
    setStuckEnabled(prev => !prev);
  };

  const updateStuckDays = (days: number) => {
    setStuckDays(days);
  };

  const clearAll = () => {
    setChipFilters({ temperatura: new Set(), responsavel: new Set(), origem: new Set() });
    setStuckEnabled(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap" data-tour="kanban-filters">
      {/* Temperatura chips */}
      {(['FRIO', 'MORNO', 'QUENTE'] as const).map(temp => {
        const isActive = chipFilters.temperatura.has(temp);
        const colors = TEMP_CHIP_COLORS[temp] || TEMP_CHIP_COLORS.FRIO;
        return (
          <button
            key={temp}
            onClick={() => toggleChip('temperatura', temp)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
              isActive ? colors.active : colors.inactive
            } hover:opacity-80`}
          >
            {TEMPERATURA_LABELS[temp] || temp}
            <span className="text-[10px] opacity-70">({tempCounts[temp] || 0})</span>
          </button>
        );
      })}

      <div className="w-px h-5 bg-purple-800/30" />

      {/* Responsavel chips */}
      {Object.entries(responsavelCounts).slice(0, 6).map(([uid, count]) => {
        const isActive = chipFilters.responsavel.has(uid);
        const name = uid === '_none' ? 'Sem resp.' : (userMap[uid]?.name?.split(' ')[0] || 'Desconhecido');
        return (
          <button
            key={uid}
            onClick={() => toggleChip('responsavel', uid)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
              isActive
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-purple-500/5 text-purple-300/40 border-purple-500/15'
            } hover:opacity-80`}
          >
            {name}
            <span className="text-[10px] opacity-70">({count})</span>
          </button>
        );
      })}

      {Object.keys(origemCounts).length > 0 && (
        <>
          <div className="w-px h-5 bg-purple-800/30" />
          {/* Origem chips — show only non-zero */}
          {Object.entries(origemCounts).slice(0, 5).map(([key, count]) => {
            const isActive = chipFilters.origem.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleChip('origem', key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                    : 'bg-cyan-500/5 text-cyan-400/40 border-cyan-500/15'
                } hover:opacity-80`}
              >
                {ORIGEM_LABELS[key as keyof typeof ORIGEM_LABELS] || key}
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </>
      )}

      <div className="w-px h-5 bg-purple-800/30" />

      {/* Mode toggle */}
      {hasActiveFilters && (
        <button
          onClick={toggleMode}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border border-purple-700/20 text-purple-300/60 hover:text-purple-200 transition-colors"
        >
          {mode === 'dim' ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              Esmaecer
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              Ocultar
            </>
          )}
        </button>
      )}

      {/* Stuck toggle */}
      <button
        onClick={toggleStuck}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-all ${
          stuckEnabled
            ? 'bg-red-500/15 text-red-400 border-red-500/30'
            : 'border-purple-700/20 text-purple-300/60 hover:text-purple-200'
        }`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Parados &gt;
        <input
          type="number"
          min={1}
          max={90}
          value={stuckDays}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateStuckDays(Math.max(1, parseInt(e.target.value) || 7))}
          className="w-8 text-center bg-transparent border-b border-current/30 focus:outline-none text-[10px]"
        />
        d
      </button>

      {/* Clear all */}
      {(hasActiveFilters || stuckEnabled) && (
        <button
          onClick={clearAll}
          className="text-[10px] text-red-400/70 hover:text-red-400 font-medium ml-1"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
