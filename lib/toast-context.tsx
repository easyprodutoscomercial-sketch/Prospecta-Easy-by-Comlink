'use client';

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'undo';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  undoAction?: () => void;
}

interface ToastContextValue {
  toasts: Toast[];
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  undo: (message: string, undoAction: () => void, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const addToast = useCallback((message: string, type: ToastType, undoAction?: () => void, duration = 3000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type, undoAction }]);
    timersRef.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete timersRef.current[id];
    }, duration);
    return id;
  }, []);

  const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
  const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);
  const info = useCallback((message: string) => addToast(message, 'info'), [addToast]);
  const undo = useCallback((message: string, undoAction: () => void, duration = 5000) => {
    addToast(message, 'undo', undoAction, duration);
  }, [addToast]);
  const dismiss = useCallback((id: string) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, success, error, info, undo, dismiss }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'border-l-4 border-emerald-500 bg-[#1e0f35] shadow-emerald-500/10',
  error: 'border-l-4 border-red-500 bg-[#1e0f35] shadow-red-500/10',
  info: 'border-l-4 border-blue-500 bg-[#1e0f35] shadow-blue-500/10',
  undo: 'border-l-4 border-amber-500 bg-[#1e0f35] shadow-amber-500/10',
};

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  undo: '↩',
};

const TOAST_ICON_COLORS: Record<ToastType, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-blue-400',
  undo: 'text-amber-400',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const handleUndo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toast.undoAction) toast.undoAction();
    onDismiss(toast.id);
  };

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border border-purple-700/30 animate-slide-in-right min-w-[280px] max-w-[400px] backdrop-blur-sm ${TOAST_STYLES[toast.type]}`}
      onClick={() => onDismiss(toast.id)}
      role="alert"
      aria-live="assertive"
    >
      <span className={`text-sm font-bold ${TOAST_ICON_COLORS[toast.type]}`}>
        {TOAST_ICONS[toast.type]}
      </span>
      <p className="text-sm text-neutral-200 flex-1">{toast.message}</p>
      {toast.type === 'undo' && toast.undoAction && (
        <button
          onClick={handleUndo}
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
        >
          Desfazer
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}
        className="text-purple-300/40 hover:text-purple-200 text-xs ml-1"
        aria-label="Fechar notificacao"
      >
        ✕
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
