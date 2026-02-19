'use client';

import { useRef, useState, useEffect } from 'react';
import { usePipeline } from '@/lib/pipeline-context';

export default function PipelineSelectorGlobal() {
  const { pipelines, selectedPipelineId, setSelectedPipelineId, loading } = usePipeline();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = pipelines.find((p) => p.id === selectedPipelineId);

  if (loading || pipelines.length === 0) return null;

  return (
    <div ref={ref} className="relative px-3 py-2">
      <p className="text-[9px] font-bold text-purple-300/30 uppercase tracking-widest px-3 mb-1">Visao</p>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 transition-colors"
      >
        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2m0 10V7" />
        </svg>
        <span className="text-xs font-semibold text-emerald-400 truncate flex-1 text-left">
          {current?.name || 'Selecionar'}
        </span>
        <svg className={`w-3.5 h-3.5 text-emerald-400/50 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-3 right-3 bottom-full mb-1 bg-[#1e0f35] border border-purple-700/30 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
          {pipelines.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedPipelineId(p.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-purple-800/20 transition-colors ${
                p.id === selectedPipelineId ? 'bg-emerald-500/10 text-emerald-400' : 'text-neutral-300'
              }`}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2m0 10V7" />
              </svg>
              <div className="flex-1 min-w-0 text-left">
                <span className="truncate block">{p.name}</span>
                {p.description && (
                  <span className="text-[10px] text-purple-300/30 truncate block">{p.description}</span>
                )}
              </div>
              {p.is_default && (
                <span className="text-[8px] font-bold px-1 py-0.5 bg-emerald-500/15 text-emerald-400/70 rounded uppercase shrink-0">
                  Padrao
                </span>
              )}
              {p.id === selectedPipelineId && (
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
