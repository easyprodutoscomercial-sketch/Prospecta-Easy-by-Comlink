'use client';

import { useEffect, useState, useRef } from 'react';

interface TourTooltipProps {
  targetSelector: string;
  title: string;
  description: string;
  step: number;
  totalSteps: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

export function TourTooltip({ targetSelector, title, description, step, totalSteps, position = 'bottom', onNext, onPrev, onSkip }: TourTooltipProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const compute = () => {
      const el = document.querySelector(targetSelector);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const tooltipW = 320;
      const tooltipH = 180;
      const gap = 16;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'bottom':
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2 - tooltipW / 2;
          break;
        case 'top':
          top = rect.top - tooltipH - gap;
          left = rect.left + rect.width / 2 - tooltipW / 2;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipH / 2;
          left = rect.right + gap;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipH / 2;
          left = rect.left - tooltipW - gap;
          break;
      }

      // Clamp to viewport
      left = Math.max(12, Math.min(left, window.innerWidth - tooltipW - 12));
      top = Math.max(12, Math.min(top, window.innerHeight - tooltipH - 12));

      setCoords({ top, left });
    };

    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [targetSelector, position]);

  if (!coords) return null;

  const isLast = step >= totalSteps - 1;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] w-80 bg-[#1e0f35] border border-emerald-500/30 rounded-xl shadow-2xl shadow-emerald-900/30 p-5 animate-fade-in"
      style={{ top: coords.top, left: coords.left }}
    >
      {/* Progress dots */}
      <div className="flex items-center gap-1 mb-3">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === step ? 'w-6 bg-emerald-500' : i < step ? 'w-3 bg-emerald-500/40' : 'w-3 bg-purple-700/40'
            }`}
          />
        ))}
        <span className="ml-auto text-[10px] text-purple-300/40">{step + 1}/{totalSteps}</span>
      </div>

      <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
      <p className="text-xs text-purple-300/70 leading-relaxed mb-4">{description}</p>

      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-[11px] text-purple-300/50 hover:text-purple-200 transition-colors"
        >
          Pular tour
        </button>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={onPrev}
              className="px-3 py-1.5 text-[11px] font-medium text-purple-300/60 border border-purple-700/30 rounded-lg hover:text-purple-200 transition-colors"
            >
              Voltar
            </button>
          )}
          <button
            onClick={onNext}
            className="px-4 py-1.5 text-[11px] font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-colors"
          >
            {isLast ? 'Concluir' : 'Proximo'}
          </button>
        </div>
      </div>
    </div>
  );
}
