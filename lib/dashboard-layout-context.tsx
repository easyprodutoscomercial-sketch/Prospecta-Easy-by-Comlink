'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { DEFAULT_LAYOUT, WIDGET_REGISTRY, type WidgetLayout } from '@/components/dashboard/widget-registry';

interface DashboardLayoutContextValue {
  layout: WidgetLayout[];
  editMode: boolean;
  loading: boolean;
  setEditMode: (v: boolean) => void;
  addWidget: (widgetId: string) => void;
  removeWidget: (widgetId: string) => void;
  updateLayout: (layout: WidgetLayout[]) => void;
  resetLayout: () => void;
  saveLayout: () => Promise<void>;
}

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null);

export function useDashboardLayout() {
  const ctx = useContext(DashboardLayoutContext);
  if (!ctx) throw new Error('useDashboardLayout must be used within DashboardLayoutProvider');
  return ctx;
}

export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<WidgetLayout[]>(DEFAULT_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dashboard-layout');
        if (res.ok) {
          const data = await res.json();
          if (data?.layout && Array.isArray(data.layout)) {
            setLayout(data.layout);
          }
        }
      } catch { /* use default */ }
      setLoading(false);
    })();
  }, []);

  const addWidget = useCallback((widgetId: string) => {
    const def = WIDGET_REGISTRY.find(w => w.id === widgetId);
    if (!def) return;
    setLayout(prev => {
      if (prev.some(w => w.widgetId === widgetId)) return prev;
      const maxY = prev.reduce((max, w) => Math.max(max, w.y + w.h), 0);
      return [...prev, { widgetId, x: 0, y: maxY, w: def.defaultW, h: def.defaultH }];
    });
  }, []);

  const removeWidget = useCallback((widgetId: string) => {
    setLayout(prev => prev.filter(w => w.widgetId !== widgetId));
  }, []);

  const updateLayout = useCallback((newLayout: WidgetLayout[]) => {
    setLayout(newLayout);
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
  }, []);

  const saveLayout = useCallback(async () => {
    try {
      await fetch('/api/dashboard-layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      });
    } catch { /* ignore */ }
  }, [layout]);

  return (
    <DashboardLayoutContext.Provider value={{ layout, editMode, loading, setEditMode, addWidget, removeWidget, updateLayout, resetLayout, saveLayout }}>
      {children}
    </DashboardLayoutContext.Provider>
  );
}
