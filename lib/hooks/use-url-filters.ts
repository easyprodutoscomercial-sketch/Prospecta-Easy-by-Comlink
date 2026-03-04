'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';

type FilterFieldDef = {
  type: 'text' | 'select';
  default: string;
};

type FilterDefs = Record<string, FilterFieldDef>;

type FilterValues<T extends FilterDefs> = { [K in keyof T]: string };

const DEBOUNCE_MS = 400;
const STORAGE_PREFIX = 'filters:';

function saveToStorage(pathname: string, values: Record<string, string>) {
  try { localStorage.setItem(STORAGE_PREFIX + pathname, JSON.stringify(values)); } catch {}
}

function loadFromStorage(pathname: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + pathname);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearStorage(pathname: string) {
  try { localStorage.removeItem(STORAGE_PREFIX + pathname); } catch {}
}

// Migrate old sessionStorage to localStorage (one-time)
function migrateFromSession(pathname: string) {
  try {
    const key = STORAGE_PREFIX + pathname;
    const fromSession = sessionStorage.getItem(key);
    if (fromSession && !localStorage.getItem(key)) {
      localStorage.setItem(key, fromSession);
    }
    sessionStorage.removeItem(key);
  } catch {}
}

export function useUrlFilters<T extends FilterDefs>(defs: T) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // One-time migration from sessionStorage → localStorage
  const migratedRef = useRef(false);
  if (!migratedRef.current) {
    migratedRef.current = true;
    migrateFromSession(pathname);
  }

  // Restore initial values: URL params > localStorage > defaults
  // Done synchronously in initializer to avoid race conditions
  const getInitialValues = (): FilterValues<T> => {
    const hasUrlParams = Array.from(searchParams.keys()).some((k) => k in defs);

    // If URL has filter params, use them
    if (hasUrlParams) {
      const vals = {} as FilterValues<T>;
      for (const key in defs) {
        const fromUrl = searchParams.get(key);
        (vals as any)[key] = fromUrl !== null ? fromUrl : defs[key].default;
      }
      return vals;
    }

    // Otherwise, try localStorage
    const stored = loadFromStorage(pathname);
    if (stored) {
      let hasNonDefault = false;
      const restored = {} as FilterValues<T>;
      for (const key in defs) {
        const val = stored[key] ?? defs[key].default;
        (restored as any)[key] = val;
        if (val !== defs[key].default) hasNonDefault = true;
      }
      if (hasNonDefault) return restored;
    }

    // Fallback to defaults
    const vals = {} as FilterValues<T>;
    for (const key in defs) {
      (vals as any)[key] = defs[key].default;
    }
    return vals;
  };

  const [values, setValues] = useState<FilterValues<T>>(getInitialValues);
  const [inputValues, setInputValues] = useState<FilterValues<T>>(getInitialValues);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastUrlRef = useRef<string>('');

  // Sync localStorage + URL on every values change
  // Uses window.history.replaceState to avoid Next.js Suspense remounts
  useEffect(() => {
    const params = new URLSearchParams();
    const toStore: Record<string, string> = {};
    for (const key in defs) {
      const val = (values as any)[key];
      toStore[key] = val;
      if (val !== defs[key].default) {
        params.set(key, val);
      }
    }

    // Always persist to localStorage
    saveToStorage(pathname, toStore);

    // Update URL without triggering Next.js re-render/Suspense
    const qs = params.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    if (newUrl !== lastUrlRef.current) {
      lastUrlRef.current = newUrl;
      window.history.replaceState(null, '', newUrl);
    }
  }, [values, defs, pathname]);

  // Track current URL on mount
  useEffect(() => {
    const qs = searchParams.toString();
    lastUrlRef.current = qs ? `${pathname}?${qs}` : pathname;
  }, [searchParams, pathname]);

  const setFilter = useCallback((key: keyof T & string, value: string) => {
    const def = defs[key];
    if (!def) return;

    setInputValues((prev) => ({ ...prev, [key]: value }));

    if (def.type === 'text') {
      if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
      debounceTimers.current[key] = setTimeout(() => {
        setValues((prev) => {
          const next = { ...prev, [key]: value };
          if (key !== 'page' && 'page' in defs) {
            (next as any).page = defs.page.default;
          }
          return next;
        });
      }, DEBOUNCE_MS);
    } else {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        if (key !== 'page' && 'page' in defs) {
          (next as any).page = defs.page.default;
        }
        return next;
      });
      setInputValues((prev) => {
        const next = { ...prev, [key]: value };
        if (key !== 'page' && 'page' in defs) {
          (next as any).page = defs.page.default;
        }
        return next;
      });
    }
  }, [defs]);

  const setFilters = useCallback((newFilters: Partial<FilterValues<T>>) => {
    for (const key in debounceTimers.current) {
      clearTimeout(debounceTimers.current[key]);
    }
    setValues((prev) => ({ ...prev, ...newFilters }));
    setInputValues((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetAll = useCallback(() => {
    for (const key in debounceTimers.current) {
      clearTimeout(debounceTimers.current[key]);
    }
    const defaults = {} as FilterValues<T>;
    for (const key in defs) {
      (defaults as any)[key] = defs[key].default;
    }
    setValues(defaults);
    setInputValues(defaults);
    clearStorage(pathname);
  }, [defs, pathname]);

  useEffect(() => {
    return () => {
      for (const key in debounceTimers.current) {
        clearTimeout(debounceTimers.current[key]);
      }
    };
  }, []);

  return { values, inputValues, setFilter, setFilters, resetAll };
}
