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
const SESSION_PREFIX = 'filters:';

function saveToSession(pathname: string, values: Record<string, string>) {
  try { sessionStorage.setItem(SESSION_PREFIX + pathname, JSON.stringify(values)); } catch {}
}

function loadFromSession(pathname: string): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + pathname);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearSession(pathname: string) {
  try { sessionStorage.removeItem(SESSION_PREFIX + pathname); } catch {}
}

export function useUrlFilters<T extends FilterDefs>(defs: T) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Safe initial values from URL params only (works during SSR)
  const getValuesFromUrl = (): FilterValues<T> => {
    const vals = {} as FilterValues<T>;
    for (const key in defs) {
      const fromUrl = searchParams.get(key);
      (vals as any)[key] = fromUrl !== null ? fromUrl : defs[key].default;
    }
    return vals;
  };

  const [values, setValues] = useState<FilterValues<T>>(getValuesFromUrl);
  const [inputValues, setInputValues] = useState<FilterValues<T>>(getValuesFromUrl);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastUrlRef = useRef<string>('');
  const restoredRef = useRef(false);

  // After mount on client: restore from sessionStorage if URL has no filter params
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const hasUrlParams = Array.from(searchParams.keys()).some((k) => k in defs);
    if (hasUrlParams) return; // URL already has filters, no need to restore

    const stored = loadFromSession(pathname);
    if (!stored) return;

    // Check if stored has any non-default values
    let hasNonDefault = false;
    const restored = {} as FilterValues<T>;
    for (const key in defs) {
      const val = stored[key] ?? defs[key].default;
      (restored as any)[key] = val;
      if (val !== defs[key].default) hasNonDefault = true;
    }

    if (hasNonDefault) {
      setValues(restored);
      setInputValues(restored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL + sessionStorage on every values change
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

    // Always persist to sessionStorage
    saveToSession(pathname, toStore);

    // Only update URL if it actually changed
    const qs = params.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    if (newUrl !== lastUrlRef.current) {
      lastUrlRef.current = newUrl;
      router.replace(newUrl, { scroll: false });
    }
  }, [values, defs, pathname, router]);

  // Track current URL to avoid unnecessary replaces
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
    clearSession(pathname);
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
