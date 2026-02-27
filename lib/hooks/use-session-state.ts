'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const SESSION_PREFIX = 'kanban-filters:';

/**
 * Hook that works like useState but persists value in sessionStorage.
 * Survives page navigation and refresh; cleared only on tab close or explicit reset.
 */
export function useSessionState<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = sessionStorage.getItem(SESSION_PREFIX + key);
      if (stored !== null) return JSON.parse(stored);
    } catch { /* ignore */ }
    return defaultValue;
  });

  const defaultRef = useRef(defaultValue);

  // Persist to sessionStorage whenever value changes
  useEffect(() => {
    try {
      const serialized = JSON.stringify(value);
      const defaultSerialized = JSON.stringify(defaultRef.current);
      if (serialized === defaultSerialized) {
        sessionStorage.removeItem(SESSION_PREFIX + key);
      } else {
        sessionStorage.setItem(SESSION_PREFIX + key, serialized);
      }
    } catch { /* ignore */ }
  }, [key, value]);

  const setValueWrapped = useCallback((v: T | ((prev: T) => T)) => {
    setValue(v);
  }, []);

  return [value, setValueWrapped];
}
