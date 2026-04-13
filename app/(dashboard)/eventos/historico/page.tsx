'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SnapshotSummary {
  id: string;
  event_id: string | null;
  event_name: string;
  event_location: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  event_exists: boolean;
  total_leads: number;
  total_stand_leads: number;
  total_walk_ins: number;
  visited_booths: number;
  total_booths: number;
  coverage_pct: number;
  total_value: number;
  sellers_count: number;
  created_at: string;
  created_by_name: string | null;
  trigger: string;
}

function formatDate(raw: string | null): string {
  if (!raw) return '';
  const d = new Date(raw + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(raw: string): string {
  const d = new Date(raw);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(val: number): string {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function HistoricoFeirasPage() {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/events/snapshots')
      .then((r) => r.json())
      .then((d) => setSnapshots(d.snapshots || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-purple-700/30 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-[#1e0f35] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/eventos" className="text-purple-300/50 hover:text-emerald-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Historico de Feiras</h1>
          </div>
          <p className="text-sm text-purple-300/60 ml-8">
            Resumo imut\u00e1vel de cada feira encerrada. Sobrevive mesmo se a feira for apagada depois.
          </p>
        </div>
      </div>

      {/* Lista */}
      {snapshots.length === 0 ? (
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-12 text-center">
          <svg className="w-12 h-12 text-purple-500/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-purple-300/50 mb-1">Nenhum snapshot ainda.</p>
          <p className="text-xs text-purple-300/30">
            Os snapshots s\u00e3o gerados automaticamente quando voc\u00ea encerra uma feira,
            ou manualmente antes de apag\u00e1-la.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {snapshots.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border p-4 sm:p-5 transition-colors ${
                s.event_exists
                  ? 'bg-[#1e0f35] border-purple-800/30 hover:border-emerald-500/30'
                  : 'bg-[#1e0f35]/60 border-purple-800/20'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-lg font-bold text-white truncate">{s.event_name}</h3>
                    {!s.event_exists && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">
                        APAGADA
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.trigger === 'auto_encerrado'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-cyan-500/15 text-cyan-400'
                      }`}
                    >
                      {s.trigger === 'auto_encerrado' ? 'Auto-encerrado' : 'Manual'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-purple-300/50 flex-wrap">
                    {s.event_location && <span>{s.event_location}</span>}
                    {(s.event_start_date || s.event_end_date) && (
                      <span>
                        {formatDate(s.event_start_date)} - {formatDate(s.event_end_date)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-purple-300/40 uppercase tracking-widest">Snapshot gerado</div>
                  <div className="text-xs text-purple-200/70">{formatDateTime(s.created_at)}</div>
                  {s.created_by_name && (
                    <div className="text-[10px] text-purple-300/50">por {s.created_by_name}</div>
                  )}
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-[#2a1245] rounded-lg p-3 border border-purple-800/20">
                  <div className="text-[10px] text-purple-300/50 uppercase font-semibold mb-0.5">Total leads</div>
                  <div className="text-lg font-bold text-emerald-400">{s.total_leads}</div>
                </div>
                <div className="bg-[#2a1245] rounded-lg p-3 border border-purple-800/20">
                  <div className="text-[10px] text-purple-300/50 uppercase font-semibold mb-0.5">Stand vs Avulso</div>
                  <div className="text-sm font-bold text-white">
                    <span className="text-purple-300">{s.total_stand_leads}</span>
                    <span className="text-purple-500/40"> / </span>
                    <span className="text-cyan-400">{s.total_walk_ins}</span>
                  </div>
                </div>
                <div className="bg-[#2a1245] rounded-lg p-3 border border-purple-800/20">
                  <div className="text-[10px] text-purple-300/50 uppercase font-semibold mb-0.5">Cobertura stands</div>
                  <div className="text-sm font-bold text-white">
                    {s.visited_booths}/{s.total_booths}
                    <span className="text-[10px] text-purple-300/50 ml-1">({s.coverage_pct}%)</span>
                  </div>
                </div>
                <div className="bg-[#2a1245] rounded-lg p-3 border border-purple-800/20">
                  <div className="text-[10px] text-purple-300/50 uppercase font-semibold mb-0.5">Valor em pipeline</div>
                  <div className="text-sm font-bold text-emerald-300">
                    R$ {formatCurrency(s.total_value)}
                  </div>
                </div>
              </div>

              {/* Link pro evento vivo, se ainda existe */}
              {s.event_exists && s.event_id && (
                <div className="mt-3 flex justify-end">
                  <Link
                    href={`/eventos/${s.event_id}`}
                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    Ver feira
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
