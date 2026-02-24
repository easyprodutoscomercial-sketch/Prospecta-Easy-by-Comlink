'use client';

import { useEffect, useState } from 'react';

interface TourOverlayProps {
  targetSelector: string;
  active: boolean;
}

export function TourOverlay({ targetSelector, active }: TourOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!active) return;
    const el = document.querySelector(targetSelector);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect(r);
    }
    const handleResize = () => {
      const el = document.querySelector(targetSelector);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [targetSelector, active]);

  if (!active || !rect) return null;

  const padding = 8;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - padding}
              y={rect.top - padding}
              width={rect.width + padding * 2}
              height={rect.height + padding * 2}
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#tour-mask)"
          className="pointer-events-auto"
        />
      </svg>
      {/* Spotlight border */}
      <div
        className="absolute border-2 border-emerald-500/50 rounded-xl animate-pulse pointer-events-none"
        style={{
          left: rect.left - padding,
          top: rect.top - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        }}
      />
    </div>
  );
}
