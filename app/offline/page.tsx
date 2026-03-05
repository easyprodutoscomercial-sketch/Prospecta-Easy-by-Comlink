'use client';

import { useState, useEffect } from 'react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [cachedContacts, setCachedContacts] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    // Check cached contacts count
    if ('caches' in window) {
      caches.open('contacts-cache').then(async (cache) => {
        const keys = await cache.keys();
        if (keys.length > 0) setCachedContacts(keys.length);
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-reload when back online
  useEffect(() => {
    if (isOnline) {
      const timer = setTimeout(() => window.location.replace('/dashboard'), 1500);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (isOnline) {
    return (
      <div className="min-h-screen bg-[#120826] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-100 mb-3">Conexao restaurada!</h1>
          <p className="text-sm text-emerald-400/70">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#120826] flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-purple-500/15 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-purple-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M1 1l22 22"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-neutral-100 mb-3">
          Sem conexao
        </h1>
        <p className="text-sm text-purple-300/60 mb-6 leading-relaxed">
          Voce esta offline. Verifique sua conexao com a internet e tente
          novamente.
        </p>

        {cachedContacts !== null && (
          <div className="mb-6 bg-[#1e0f35] border border-purple-500/20 rounded-lg p-3">
            <p className="text-xs text-purple-300/60">
              <span className="text-emerald-400 font-medium">{cachedContacts}</span>{' '}
              {cachedContacts === 1 ? 'pagina em cache disponivel' : 'paginas em cache disponiveis'}
            </p>
            <p className="text-[10px] text-purple-300/40 mt-1">
              Dados podem estar desatualizados
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 transition-colors active:scale-[0.98]"
          >
            Tentar novamente
          </button>

          {cachedContacts !== null && (
            <button
              onClick={() => window.history.back()}
              className="px-6 py-2.5 text-sm text-purple-300/60 hover:text-purple-300/80 transition-colors"
            >
              Ver dados em cache
            </button>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <p className="text-[10px] text-purple-300/30">Aguardando conexao...</p>
        </div>

        <p className="text-[10px] text-purple-300/30 mt-4">Controlei CRM</p>
      </div>
    </div>
  );
}
