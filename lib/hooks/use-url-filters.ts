'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

type FilterFieldDef = {
  type: 'text' | 'select';
  default: string;
};

type FilterDefs = Record<string, FilterFieldDef>;

type FilterValues<T extends FilterDefs> = { [K in keyof T]: string };

const DEBOUNCE_MS = 400;

function getSessionKey(pathname: string) {
  return `filters:${pathname}`;
}

export function useUrlFilters<T extends FilterDefs>(defs: T) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Build initial values: URL params > sessionStorage > defaults
  const getInitialValues = useCallback((): FilterValues<T> => {
    // Check if URL has any filter params
    const hasUrlParams = Array.from(searchParams.keys()).some((k) => k in defs);

    // Try to restore from sessionStorage if no URL params
    let stored: Record<string, string> | null = null;
    if (!hasUrlParams) {
      try {
        const raw = sessionStorage.getItem(getSessionKey(pathname));
        if (raw) stored = JSON.parse(raw);
      } catch {}
    }

    const vals = {} as FilterValues<T>;
    for (const key in defs) {
      const fromUrl = searchParams.get(key);
      if (fromUrl !== null) {
        (vals as any)[key] = fromUrl;
      } else if (stored && key in stored) {
        (vals as any)[key] = stored[key];
      } else {
        (vals as any)[key] = defs[key].default;
      }
    }
    return vals;
  }, [defs, searchParams, pathname]);

  // "committed" values = debounced for text fields; used for fetching
  const [values, setValues] = useState<FilterValues<T>>(getInitialValues);
  // "input" values = live keystroke values for text inputs
  const [inputValues, setInputValues] = useState<FilterValues<T>>(getInitialValues);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isInitialMount = useRef(true);

  // Sync URL + sessionStorage when values change (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // On initial mount, still sync URL if we restored from sessionStorage
      const hasUrlParams = Array.from(searchParams.keys()).some((k) => k in defs);
      if (!hasUrlParams) {
        const params = new URLSearchParams();
        for (const key in defs) {
          const val = (values as any)[key];
          if (val !== defs[key].default) {
            params.set(key, val);
          }
        }
        const qs = params.toString();
        if (qs) {
          const newUrl = `${pathname}?${qs}`;
          router.replace(newUrl, { scroll: false });
        }
      }
      return;
    }
    const params = new URLSearchParams();
    const toStore: Record<string, string> = {};
    for (const key in defs) {
      const val = (values as any)[key];
      toStore[key] = val;
      if (val !== defs[key].default) {
        params.set(key, val);
      }
    }
    // Persist to sessionStorage
    try { sessionStorage.setItem(getSessionKey(pathname), JSON.stringify(toStore)); } catch {}
    const qs = params.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [values, defs, pathname, router]);

  const setFilter = useCallback((key: keyof T & string, value: string) => {
    const def = defs[key];
    if (!def) return;

    // Always update inputValues immediately
    setInputValues((prev) => ({ ...prev, [key]: value }));

    if (def.type === 'text') {
      // Debounce: update committed values after delay
      if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
      debounceTimers.current[key] = setTimeout(() => {
        setValues((prev) => {
          const next = { ...prev, [key]: value };
          // Reset page to 1 when a non-page filter changes
          if (key !== 'page' && 'page' in defs) {
            (next as any).page = defs.page.default;
          }
          return next;
        });
      }, DEBOUNCE_MS);
    } else {
      // Select: commit immediately
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        if (key !== 'page' && 'page' in defs) {
          (next as any).page = defs.page.default;
        }
        return next;
      });
      // Keep inputValues in sync for selects
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
    // Clear any pending debounce timers
    for (const key in debounceTimers.current) {
      clearTimeout(debounceTimers.current[key]);
    }
    setValues((prev) => ({ ...prev, ...newFilters }));
    setInputValues((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetAll = useCallback(() => {
    // Clear any pending debounce timers
    for (const key in debounceTimers.current) {
      clearTimeout(debounceTimers.current[key]);
    }
    const defaults = {} as FilterValues<T>;
    for (const key in defs) {
      (defaults as any)[key] = defs[key].default;
    }
    setValues(defaults);
    setInputValues(defaults);
    // Clear sessionStorage
    try { sessionStorage.removeItem(getSessionKey(pathname)); } catch {}
  }, [defs, pathname]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const key in debounceTimers.current) {
        clearTimeout(debounceTimers.current[key]);
      }
    };
  }, []);

  return { values, inputValues, setFilter, setFilters, resetAll };
}
