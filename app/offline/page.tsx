'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#1a0a2e] flex items-center justify-center p-4">
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
        <p className="text-sm text-purple-300/60 mb-8 leading-relaxed">
          Voce esta offline. Verifique sua conexao com a internet e tente
          novamente.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 transition-colors active:scale-[0.98]"
        >
          Tentar novamente
        </button>

        <p className="text-[10px] text-purple-300/30 mt-8">Controlei</p>
      </div>
    </div>
  );
}
