'use client';

import {
  TEMPERATURA_LABELS,
} from '@/lib/utils/labels';

interface FocusCallScriptProps {
  contactName: string;
  company: string | null;
  temperatura: string | null;
  script: string | null;
  loading: boolean;
  onGenerate: () => void;
}

export default function FocusCallScript({
  contactName,
  company,
  temperatura,
  script,
  loading,
  onGenerate,
}: FocusCallScriptProps) {
  return (
    <div className="bg-[#1e0f35] rounded-2xl border border-purple-800/30 p-5 space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h3 className="text-sm font-bold text-neutral-100">Script de Ligacao</h3>
        </div>
        {temperatura && (
          <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-purple-800/30 text-purple-300/50">
            {TEMPERATURA_LABELS[temperatura] || temperatura}
          </span>
        )}
      </div>

      {/* Context info */}
      <div className="text-xs text-purple-300/40 space-y-0.5">
        <p>
          <span className="font-medium text-purple-300/60">Contato:</span> {contactName}
        </p>
        {company && (
          <p>
            <span className="font-medium text-purple-300/60">Empresa:</span> {company}
          </p>
        )}
      </div>

      {/* Script content or generate button */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
            <p className="text-xs text-purple-300/40">Gerando script com IA...</p>
          </div>
        ) : script ? (
          <div className="overflow-y-auto max-h-[400px] scrollbar-hide">
            <div className="px-4 py-3 rounded-xl bg-purple-900/20 border border-purple-800/15">
              <p className="text-sm text-neutral-200 whitespace-pre-line leading-relaxed">
                {script}
              </p>
            </div>
            <button
              onClick={onGenerate}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-300/60 hover:text-emerald-400 rounded-lg border border-purple-800/20 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Gerar novo script
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg
                className="w-7 h-7 text-emerald-400/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <p className="text-xs text-purple-300/40 text-center max-w-[200px]">
              Gere um script personalizado para esta ligacao usando IA
            </p>
            <button
              onClick={onGenerate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all duration-200 hover:-translate-y-0.5"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Gerar Script
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
