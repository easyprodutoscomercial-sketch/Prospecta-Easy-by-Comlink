'use client';

import { useEffect, useState, use, useRef } from 'react';
import Link from 'next/link';

interface LiveData {
  timestamp: string;
  event: { id: string; name: string; location: string | null; start_date: string; end_date: string };
  summary: {
    total: number;
    visited: number;
    pending: number;
    pct: number;
    total_visits: number;
    visits_last_1h: number;
    visits_last_2h: number;
  };
  ranking: Array<{ user_id: string; user_name: string; total: number; last_2h: number; last_active: string | null }>;
  active_now: Array<{ user_id: string; user_name: string; last_active: string }>;
  recent: Array<{ id: string; user_name: string; booth_id: string; visited_at: string; prospect_type: string; contact_name: string | null }>;
}

const REFRESH_MS = 10000;

export default function WarRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);

  const fetchLive = async () => {
    try {
      const res = await fetch(`/api/events/${id}/live`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erro');
    }
  };

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, REFRESH_MS);
    return () => clearInterval(interval);
  }, [id]);

  // Tick para relógio
  useEffect(() => {
    const i = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch {}
  };

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400 bg-[#0a0520]">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-emerald-400 bg-[#0a0520]">
        Carregando War Room...
      </div>
    );
  }

  const { event, summary, ranking, active_now, recent } = data;
  const topRanking = ranking.slice(0, 5);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  const timeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  // Medalhas
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-[#0a0520] via-[#120826] to-[#1a0a2e] text-white war-room"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-purple-800/30 bg-black/30">
        <div className="flex items-center gap-4">
          <Link
            href={`/eventos/${id}`}
            className="text-purple-300/60 hover:text-white text-xs flex items-center gap-1"
          >
            ← Voltar ao evento
          </Link>
          <div className="h-4 w-px bg-purple-700/40" />
          <div>
            <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">War Room · Live</div>
            <div className="text-sm font-bold">{event.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-purple-300/50 uppercase tracking-wider">{dateStr}</div>
            <div className="text-xl font-mono font-bold text-emerald-400 tabular-nums">{timeStr}</div>
          </div>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg text-xs font-bold text-emerald-300 transition-colors"
          >
            {fullscreen ? 'Sair Fullscreen' : '⛶ Fullscreen'}
          </button>
        </div>
      </div>

      {/* Grid principal */}
      <div className="p-6 grid grid-cols-12 gap-5">
        {/* COBERTURA — gigante */}
        <div className="col-span-12 lg:col-span-5 bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 border border-emerald-500/30 rounded-2xl p-8 flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-2">
              Cobertura do Evento
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-8xl font-black text-white tabular-nums leading-none">{summary.pct}</div>
              <div className="text-4xl font-bold text-emerald-400">%</div>
            </div>
            <div className="mt-2 text-lg text-emerald-200/80">
              <span className="font-bold text-white">{summary.visited}</span> de{' '}
              <span className="font-bold text-white">{summary.total}</span> stands
            </div>
          </div>
          <div>
            <div className="w-full h-4 bg-emerald-950/80 rounded-full overflow-hidden border border-emerald-500/30">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-1000 ease-out relative"
                style={{ width: `${summary.pct}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-emerald-300/70">
              <span>0%</span>
              <span>META 100%</span>
            </div>
          </div>
        </div>

        {/* KPIs secundários */}
        <div className="col-span-12 lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiBig label="Pendentes" value={summary.pending} color="amber" />
          <KpiBig label="Visitas totais" value={summary.total_visits} color="cyan" />
          <KpiBig label="Última hora" value={summary.visits_last_1h} color="purple" flash={summary.visits_last_1h > 0} />
          <KpiBig label="Últimas 2h" value={summary.visits_last_2h} color="emerald" />
          <KpiBig label="Ativos agora" value={active_now.length} color="red" flash={active_now.length > 0} />
          <KpiBig label="Equipe" value={ranking.length} color="cyan" />
          <KpiBig label="Top / hora" value={summary.visits_last_1h > 0 ? ranking[0]?.last_2h || 0 : 0} color="purple" />
          <KpiBig label="Ritmo" value={`${Math.round(summary.visits_last_1h)}/h`} color="emerald" />
        </div>

        {/* Ranking — grande */}
        <div className="col-span-12 lg:col-span-7 bg-[#1e0f35]/80 border border-purple-800/40 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🏆</span> Ranking da Equipe
            </h2>
            <span className="text-[10px] text-purple-300/50 uppercase tracking-widest">Tempo real</span>
          </div>
          {topRanking.length === 0 ? (
            <div className="text-center text-purple-300/40 py-12">Sem visitas ainda</div>
          ) : (
            <div className="space-y-3">
              {topRanking.map((u, i) => {
                const pct = ranking[0] ? (u.total / ranking[0].total) * 100 : 0;
                const isActive = active_now.some((a) => a.user_id === u.user_id);
                return (
                  <div key={u.user_id} className="relative">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="text-2xl w-8 text-center">{medals[i] || `${i + 1}º`}</div>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-white text-lg shrink-0 relative">
                        {(u.user_name || '?').charAt(0).toUpperCase()}
                        {isActive && (
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-[#1e0f35] animate-pulse" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white truncate">{u.user_name}</div>
                        <div className="text-[10px] text-purple-300/50">
                          {u.last_2h > 0 && <span className="text-emerald-400 font-bold">{u.last_2h} nas últimas 2h · </span>}
                          {u.last_active && <>último: {timeAgo(u.last_active)} atrás</>}
                        </div>
                      </div>
                      <div className="text-3xl font-black text-emerald-400 tabular-nums">{u.total}</div>
                    </div>
                    <div className="ml-11 h-2 bg-purple-950/80 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-1000"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Feed de visitas recentes */}
        <div className="col-span-12 lg:col-span-5 bg-[#1e0f35]/80 border border-purple-800/40 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              Live Feed
            </h2>
            <span className="text-[10px] text-purple-300/50 uppercase tracking-widest">
              {recent.length} recentes
            </span>
          </div>
          {recent.length === 0 ? (
            <div className="text-center text-purple-300/40 py-12">Aguardando visitas...</div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {recent.map((v) => (
                <div key={v.id} className="flex items-start gap-3 p-2.5 bg-[#2a1245]/50 rounded-lg border border-purple-800/20">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-white text-xs shrink-0">
                    {(v.user_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 text-xs">
                    <div>
                      <span className="font-bold text-white">{v.user_name}</span>
                      <span className="text-purple-300/60"> bateu check-in</span>
                    </div>
                    {v.contact_name && (
                      <div className="text-purple-200/70 truncate">→ {v.contact_name}</div>
                    )}
                    <div className="text-[9px] text-purple-300/40 mt-0.5">
                      {v.prospect_type && <span className="mr-2">{v.prospect_type}</span>}
                      {timeAgo(v.visited_at)} atrás
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="fixed bottom-0 left-0 right-0 px-6 py-2 bg-black/60 backdrop-blur-sm border-t border-purple-800/30 flex items-center justify-between text-[10px] text-purple-300/50">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Conectado
          </span>
          <span>Atualiza a cada {REFRESH_MS / 1000}s</span>
          <span>Última sync: {timeAgo(data.timestamp)} atrás</span>
        </div>
        <div>Controlei CRM · War Room</div>
      </div>

      <style jsx global>{`
        .war-room {
          font-feature-settings: 'tnum';
        }
      `}</style>
    </div>
  );
}

function KpiBig({ label, value, color, flash }: { label: string; value: number | string; color: 'emerald' | 'amber' | 'cyan' | 'purple' | 'red'; flash?: boolean }) {
  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-900/40 to-emerald-950/40 border-emerald-500/30 text-emerald-300',
    amber: 'from-amber-900/40 to-amber-950/40 border-amber-500/30 text-amber-300',
    cyan: 'from-cyan-900/40 to-cyan-950/40 border-cyan-500/30 text-cyan-300',
    purple: 'from-purple-900/40 to-purple-950/40 border-purple-500/30 text-purple-300',
    red: 'from-red-900/40 to-red-950/40 border-red-500/30 text-red-300',
  };
  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-4 ${flash ? 'animate-pulse' : ''}`}>
      <div className="text-[10px] uppercase tracking-wider font-bold opacity-60">{label}</div>
      <div className="text-4xl font-black text-white tabular-nums mt-1">{value}</div>
    </div>
  );
}
