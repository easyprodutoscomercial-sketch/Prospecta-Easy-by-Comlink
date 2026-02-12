'use client';

import { useState, useEffect } from 'react';
import { PipelineHealth } from '@/lib/ai/types';

interface PipelineHealthWidgetProps {
  userRole?: string;
}

export default function PipelineHealthWidget({ userRole }: PipelineHealthWidgetProps) {
  const [health, setHealth] = useState<PipelineHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<string | null>(null);
  const isAdmin = userRole === 'admin';

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/pipeline-health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { fetchHealth(); }, []);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const res = await fetch('/api/ai/analyze', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAnalyzeResult(`${data.created} notificacoes criadas de ${data.total_contacts_analyzed} contatos analisados`);
        // Refresh health metrics
        await fetchHealth();
      }
    } catch (e: any) {
      setAnalyzeResult('Erro ao analisar');
    }
    setAnalyzing(false);
  };

  if (loading) {
    return (
      <div className="mb-8 bg-[#1e0f35] rounded-xl border border-purple-800/30 p-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
          <span className="text-sm text-neutral-400">Carregando saude do pipeline...</span>
        </div>
      </div>
    );
  }

  if (!health) return null;

  const kpis = [
    { label: 'Em Risco', value: health.atRisk, color: 'text-red-400', bg: 'bg-red-500/10', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' },
    { label: 'Parados', value: health.stale, color: 'text-amber-400', bg: 'bg-amber-500/10', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Sem Dono', value: health.noOwner, color: 'text-purple-400', bg: 'bg-purple-500/10', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { label: 'Sem Acao', value: health.noNextAction, color: 'text-blue-400', bg: 'bg-blue-500/10', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  ];

  return (
    <div className="mb-8 bg-[#1e0f35] rounded-xl border border-purple-800/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-purple-800/20">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-sm font-semibold text-white">Saude do Pipeline</h3>
          <span className="text-[10px] text-neutral-500">
            {health.totalActive} contatos ativos | R$ {health.totalValue.toLocaleString('pt-BR')} | {health.conversionRate}% conversao
          </span>
        </div>
        {isAdmin && <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {analyzing ? (
            <>
              <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Analisar
            </>
          )}
        </button>}
      </div>

      <div className="p-5">
        {/* Analyze result */}
        {analyzeResult && (
          <div className="mb-4 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400">
            {analyzeResult}
          </div>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className={`${kpi.bg} rounded-lg p-3 text-center`}>
              <div className="flex items-center justify-center mb-1">
                <svg className={`w-4 h-4 ${kpi.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={kpi.icon} />
                </svg>
              </div>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-[10px] text-neutral-500">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Coaching Tips */}
        {health.coachingTips.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Dicas de Coaching IA
            </h4>
            <div className="space-y-1.5">
              {health.coachingTips.map((tip, idx) => (
                <div key={idx} className="flex items-start gap-2 px-3 py-2 bg-[#120826] rounded-lg border border-purple-800/15">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-xs text-neutral-300">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
