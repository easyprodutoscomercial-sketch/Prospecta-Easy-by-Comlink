'use client';

import { useState, useEffect } from 'react';
import { PcStats } from '@/lib/types';

interface AiAnalysisResult {
  resumo: string;
  insights: string[];
  alertas: string[];
  recomendacoes: string[];
  score: number;
}

interface PcAiAnalysisProps {
  stats: PcStats | null;
}

const CACHE_KEY = 'pc_ai_analysis_cache';

function getScoreColor(score: number) {
  if (score >= 75) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
  if (score >= 50) return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
  return 'text-red-400 bg-red-500/15 border-red-500/30';
}

function getScoreLabel(score: number) {
  if (score >= 75) return 'Saudavel';
  if (score >= 50) return 'Atencao';
  return 'Critico';
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function PcAiAnalysis({ stats }: PcAiAnalysisProps) {
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) setResult(JSON.parse(cached));
    } catch { /* ignore */ }
  }, []);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!stats) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/pedidos-cotacoes/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro na analise');
      }

      const data = await res.json();
      setResult(data);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch { /* ignore storage errors */ }
    } catch (err: any) {
      setError(err.message || 'Erro ao analisar dados');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[#1e0f35] border border-purple-800/20 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-neutral-300">Analise com IA</h3>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading || !stats}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <SparklesIcon className="w-3.5 h-3.5" />
              {result ? 'Reanalisar' : 'Analisar com IA'}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4">
          {error}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="flex items-center justify-center py-8 text-neutral-500 text-sm">
          Clique em &quot;Analisar com IA&quot; para gerar insights sobre seus dados
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
          <p className="text-xs text-purple-300 animate-pulse">Analisando seus dados...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {/* Score badge */}
          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold ${getScoreColor(result.score)}`}>
              {result.score}/100
            </div>
            <span className={`text-xs font-medium ${getScoreColor(result.score).split(' ')[0]}`}>
              {getScoreLabel(result.score)}
            </span>
          </div>

          {/* Resumo */}
          <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
            <p className="text-sm text-neutral-300 leading-relaxed">{result.resumo}</p>
          </div>

          {/* Insights */}
          {result.insights.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                </svg>
                <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Insights</span>
              </div>
              <ul className="space-y-1.5">
                {result.insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-neutral-300">
                    <span className="text-amber-400 mt-0.5">&#8226;</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Alertas */}
          {result.alertas.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Alertas</span>
              </div>
              <ul className="space-y-1.5">
                {result.alertas.map((alerta, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-red-300">
                    <span className="text-red-400 mt-0.5">&#8226;</span>
                    {alerta}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recomendacoes */}
          {result.recomendacoes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Recomendacoes</span>
              </div>
              <ul className="space-y-1.5">
                {result.recomendacoes.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-emerald-300">
                    <span className="text-emerald-400 mt-0.5">&#8226;</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
