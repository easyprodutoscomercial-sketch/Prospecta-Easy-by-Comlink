'use client';

import { useEffect, useRef, useState } from 'react';
import { useOnlineStatus, useQueueCount, useInstallQueueAutoFlush, processQueue } from '@/lib/offline/hooks';

/**
 * Indicador global de status offline + fila pendente.
 * Mostra badge flutuante no canto inferior quando:
 *  - Está offline (chip vermelho)
 *  - Tem itens na fila (chip âmbar) com botão para sincronizar agora
 *
 * Montar uma vez no layout do dashboard.
 */
export default function OfflineIndicator() {
  const online = useOnlineStatus();
  const count = useQueueCount();
  useInstallQueueAutoFlush();

  const [syncing, setSyncing] = useState(false);
  const [justBackOnline, setJustBackOnline] = useState(false);

  useEffect(() => {
    if (online && count === 0) return;
  }, [online, count]);

  // Toast rápido quando volta online e a fila zera
  const prevCount = usePrevious(count);
  const prevOnline = usePrevious(online);
  useEffect(() => {
    if (prevOnline === false && online) {
      setJustBackOnline(true);
      const t = setTimeout(() => setJustBackOnline(false), 4000);
      return () => clearTimeout(t);
    }
  }, [online, prevOnline]);
  useEffect(() => {
    if (prevCount && prevCount > 0 && count === 0 && online) {
      setJustBackOnline(true);
      const t = setTimeout(() => setJustBackOnline(false), 4000);
      return () => clearTimeout(t);
    }
  }, [count, prevCount, online]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await processQueue();
    } finally {
      setSyncing(false);
    }
  };

  // Nada para mostrar
  if (online && count === 0 && !justBackOnline) return null;

  return (
    <div className="no-print fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2 pointer-events-none">
      {/* Toast volta online */}
      {justBackOnline && count === 0 && (
        <div className="pointer-events-auto bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-900/40 flex items-center gap-2 animate-in slide-in-from-bottom-4 fade-in">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          De volta online — tudo sincronizado
        </div>
      )}

      {/* Offline */}
      {!online && (
        <div className="pointer-events-auto bg-red-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-red-900/40 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          Offline — salvando local
          {count > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{count} na fila</span>}
        </div>
      )}

      {/* Fila com online */}
      {online && count > 0 && (
        <div className="pointer-events-auto bg-amber-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-amber-900/40 flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={syncing ? 'animate-spin' : ''}>
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {count} ação pendente{count > 1 ? 's' : ''}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-white/20 hover:bg-white/30 disabled:opacity-50 px-2 py-1 rounded-md text-xs font-bold transition"
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      )}
    </div>
  );
}

// Hook utilitário: valor anterior
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
