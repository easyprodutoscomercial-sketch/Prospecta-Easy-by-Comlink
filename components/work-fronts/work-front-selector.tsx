'use client';

import { useState, useEffect, useRef } from 'react';
import type { WorkFront } from '@/lib/types';

export default function WorkFrontSelector() {
  const [workFronts, setWorkFronts] = useState<WorkFront[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [wfRes, activeRes] = await Promise.all([
          fetch('/api/work-fronts'),
          fetch('/api/work-fronts/active'),
        ]);
        if (wfRes.ok) {
          const data = await wfRes.json();
          setWorkFronts(data.work_fronts || []);
        }
        if (activeRes.ok) {
          const data = await activeRes.json();
          setActiveId(data.work_front_id || null);
        }
      } catch { /* silent */ }
    };
    load();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeFront = workFronts.find((wf) => wf.id === activeId);

  const handleSelect = async (id: string) => {
    setActiveId(id);
    setOpen(false);
    try {
      await fetch('/api/work-fronts/active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_front_id: id }),
      });
    } catch { /* silent */ }
  };

  if (workFronts.length === 0) return null;

  return (
    <div ref={ref} className="relative px-3 py-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-800/20 hover:bg-purple-800/30 border border-purple-700/20 transition-colors"
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: activeFront?.color || '#525252' }}
        />
        <span className="text-xs font-medium text-neutral-300 truncate flex-1 text-left">
          {activeFront?.name || 'Selecionar frente'}
        </span>
        <svg className={`w-3.5 h-3.5 text-purple-400/50 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-3 right-3 bottom-full mb-1 bg-[#1e0f35] border border-purple-700/30 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
          {workFronts.filter((wf) => wf.is_active).map((wf) => (
            <button
              key={wf.id}
              onClick={() => handleSelect(wf.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-purple-800/20 transition-colors ${
                wf.id === activeId ? 'bg-emerald-500/10 text-emerald-400' : 'text-neutral-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: wf.color }} />
              <span className="truncate">{wf.name}</span>
              {wf.id === activeId && (
                <svg className="w-3 h-3 ml-auto text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
