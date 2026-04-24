'use client';

import { useState, useEffect, useCallback } from 'react';

export type DensityMode = 'compact' | 'normal' | 'expanded';
export type ContactView = 'list' | 'map' | 'import' | 'feiras';

interface ContactPreferences {
  density: number;
  densityMode: DensityMode;
  hiddenContactIds: Set<string>;
  activeView: ContactView;
  setDensity: (v: number) => void;
  hideContact: (id: string) => void;
  revealAll: () => void;
  setActiveView: (v: ContactView) => void;
}

function getDensityMode(density: number): DensityMode {
  if (density <= 33) return 'compact';
  if (density <= 66) return 'normal';
  return 'expanded';
}

export function useContactPreferences(): ContactPreferences {
  const [density, setDensityState] = useState(50);
  const [hiddenContactIds, setHiddenContactIds] = useState<Set<string>>(new Set());
  const [activeView, setActiveViewState] = useState<ContactView>('list');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const savedDensity = localStorage.getItem('crm_card_density');
      if (savedDensity) setDensityState(Number(savedDensity));

      const savedHidden = localStorage.getItem('crm_hidden_contacts');
      if (savedHidden) {
        const arr = JSON.parse(savedHidden);
        if (Array.isArray(arr)) setHiddenContactIds(new Set(arr));
      }

      const savedView = localStorage.getItem('crm_contacts_view');
      if (savedView === 'list' || savedView === 'map' || savedView === 'import') setActiveViewState(savedView);
    } catch { /* silent */ }
    setHydrated(true);
  }, []);

  const setDensity = useCallback((v: number) => {
    setDensityState(v);
    try { localStorage.setItem('crm_card_density', String(v)); } catch { /* silent */ }
  }, []);

  const hideContact = useCallback((id: string) => {
    setHiddenContactIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem('crm_hidden_contacts', JSON.stringify([...next])); } catch { /* silent */ }
      return next;
    });
  }, []);

  const revealAll = useCallback(() => {
    setHiddenContactIds(new Set());
    try { localStorage.removeItem('crm_hidden_contacts'); } catch { /* silent */ }
  }, []);

  const setActiveView = useCallback((v: ContactView) => {
    setActiveViewState(v);
    try { localStorage.setItem('crm_contacts_view', v); } catch { /* silent */ }
  }, []);

  return {
    density,
    densityMode: getDensityMode(density),
    hiddenContactIds,
    activeView,
    setDensity,
    hideContact,
    revealAll,
    setActiveView,
  };
}
