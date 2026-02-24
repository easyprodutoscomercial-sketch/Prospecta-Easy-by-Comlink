'use client';

import type { ReactNode } from 'react';

interface WidgetWrapperProps {
  title: string;
  editMode?: boolean;
  onRemove?: () => void;
  children: ReactNode;
  className?: string;
}

export function WidgetWrapper({ title, editMode, onRemove, children, className = '' }: WidgetWrapperProps) {
  return (
    <div className={`bg-[#1e0f35] border border-purple-800/30 rounded-xl overflow-hidden flex flex-col ${editMode ? 'ring-1 ring-amber-500/30' : ''} ${className}`}>
      <div className="px-4 py-2.5 border-b border-purple-800/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {editMode && (
            <svg className="w-4 h-4 text-amber-400/50 cursor-grab" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          )}
          <h3 className="text-xs font-bold text-purple-300/70 uppercase tracking-wider">{title}</h3>
        </div>
        {editMode && onRemove && (
          <button onClick={onRemove} className="text-red-400/40 hover:text-red-400 transition-colors p-0.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}
