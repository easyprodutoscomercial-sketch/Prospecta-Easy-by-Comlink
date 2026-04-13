'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { PROSPECT_TYPE_LABELS } from '@/lib/utils/labels';

// Ícones SVG inline (sem dependência externa)
const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
);
const ArrowLeft = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
);
const Printer = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
);
const Users = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const Building2 = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
);
const Camera = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
);
const TrendingUp = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
);
const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
const Clock = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

interface ReportData {
  generated_at: string;
  event: any;
  organization: { name: string; logo_url: string | null } | null;
  summary: {
    total_booths: number;
    visited_booths: number;
    pending_booths: number;
    progress_pct: number;
    total_visits: number;
    total_event_days: number;
    days_with_visits: number;
    avg_visits_per_day: number;
    total_photos: number;
    unique_companies_visited: number;
    by_type: Record<string, number>;
  };
  by_user: Array<{ user_id: string; user_name: string; visits: number; unique_booths: number; by_type: Record<string, number> }>;
  by_sector: Array<{ sector: string; total: number; visited: number; pending: number; coverage_pct: number }>;
  by_day: Array<{
    date: string;
    day_number: number;
    visits: number;
    unique_booths: number;
    by_user: Array<{ user_id: string; user_name: string; count: number }>;
    by_type: Record<string, number>;
    first_visit: string | null;
    last_visit: string | null;
    active_hours: number;
    avg_per_hour: number;
  }>;
  visited_companies: Array<{ id: string; company_name: string; booth_number: string | null; sector: string | null }>;
  pending_list: Array<{ id: string; company_name: string; booth_number: string | null; sector: string | null }>;
  visits: Array<any>;
  photos: Array<{ url: string; kind: string; company_name: string | null; booth_number: string | null; user_name: string; visited_at: string }>;
}

export default function RelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/events/${id}/report-data`);
        if (!res.ok) throw new Error('Falha ao carregar relatório');
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message || 'Erro');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    try {
      return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return d; }
  };
  const formatDateTime = (d: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };
  const formatTime = (d: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-slate-700">
        Carregando relatório...
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-red-600">
        {error || 'Erro ao carregar'}
      </div>
    );
  }

  const { event, organization, summary, by_user, by_sector, by_day, visited_companies, pending_list, photos } = data;

  return (
    <div className="report-root bg-white text-slate-900 min-h-screen">
      {/* Toolbar (oculta no print) */}
      <div className="no-print sticky top-0 z-10 bg-slate-900 text-white px-6 py-3 flex items-center justify-between shadow">
        <Link
          href={`/eventos/${id}`}
          className="flex items-center gap-2 text-white/80 hover:text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="text-sm text-white/60">Relatório Executivo — {event.name}</div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
        </button>
      </div>

      <div className="report-page max-w-[860px] mx-auto px-10 py-10">
        {/* Cabeçalho */}
        <header className="flex items-start justify-between pb-6 mb-8 border-b-2 border-slate-900">
          <div>
            {organization?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={organization.logo_url} alt="logo" className="h-10 mb-3" />
            )}
            <div className="text-xs uppercase tracking-widest text-slate-500">Relatório Executivo</div>
            <h1 className="text-3xl font-bold mt-1">{event.name}</h1>
            <div className="text-slate-600 text-sm mt-2">
              {event.location && <>{event.location} · </>}
              {formatDate(event.start_date)} — {formatDate(event.end_date)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Gerado em</div>
            <div className="text-sm text-slate-700">{formatDateTime(data.generated_at)}</div>
            {organization?.name && <div className="text-xs text-slate-500 mt-1">{organization.name}</div>}
          </div>
        </header>

        {/* Sumário Executivo — cards */}
        <section className="mb-8 avoid-break">
          <h2 className="section-title"><TrendingUp className="w-5 h-5" /> Sumário Executivo</h2>
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Total de Stands" value={summary.total_booths} color="slate" />
            <KpiCard label="Visitados" value={summary.visited_booths} sub={`${summary.progress_pct}% do mapa`} color="emerald" />
            <KpiCard label="Pendentes" value={summary.pending_booths} color="amber" />
            <KpiCard label="Visitas (total)" value={summary.total_visits} sub={`${summary.avg_visits_per_day}/dia`} color="blue" />
            <KpiCard label="Dias de Evento" value={summary.total_event_days} sub={`${summary.days_with_visits} com atividade`} color="slate" />
            <KpiCard label="Empresas Únicas" value={summary.unique_companies_visited} color="emerald" />
            <KpiCard label="Fotos Capturadas" value={summary.total_photos} color="blue" />
            <KpiCard label="Cobertura" value={`${summary.progress_pct}%`} color={summary.progress_pct >= 80 ? 'emerald' : summary.progress_pct >= 50 ? 'amber' : 'red'} />
          </div>

          {/* Barra de progresso */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Cobertura do evento</span>
              <span className="font-semibold">{summary.visited_booths}/{summary.total_booths}</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${summary.progress_pct}%` }}
              />
            </div>
          </div>

          {/* Distribuição por tipo de prospect */}
          {Object.keys(summary.by_type).length > 0 && (
            <div className="mt-4 flex items-center gap-4 text-sm">
              <span className="text-slate-500">Distribuição:</span>
              {Object.entries(summary.by_type).map(([t, n]) => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    t === 'COMPRADOR' ? 'bg-cyan-500' : t === 'FORNECEDOR' ? 'bg-purple-500' : 'bg-emerald-500'
                  }`} />
                  <strong>{n}</strong> {PROSPECT_TYPE_LABELS[t] || t}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Ranking da equipe */}
        {by_user.length > 0 && (
          <section className="mb-8 avoid-break">
            <h2 className="section-title"><Users className="w-5 h-5" /> Ranking da Equipe</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-left">
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Vendedor</th>
                  <th className="py-2 px-3 text-right">Visitas</th>
                  <th className="py-2 px-3 text-right">Stands únicos</th>
                  <th className="py-2 px-3 text-right">Compradores</th>
                  <th className="py-2 px-3 text-right">Fornecedores</th>
                </tr>
              </thead>
              <tbody>
                {by_user.map((u, i) => (
                  <tr key={u.user_id} className="border-b border-slate-200">
                    <td className="py-2 px-3">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td className="py-2 px-3 font-medium">{u.user_name}</td>
                    <td className="py-2 px-3 text-right font-semibold">{u.visits}</td>
                    <td className="py-2 px-3 text-right">{u.unique_booths}</td>
                    <td className="py-2 px-3 text-right">{u.by_type.COMPRADOR || 0}</td>
                    <td className="py-2 px-3 text-right">{u.by_type.FORNECEDOR || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Cobertura por setor */}
        {by_sector.length > 0 && (
          <section className="mb-8 avoid-break">
            <h2 className="section-title"><Building2 className="w-5 h-5" /> Cobertura por Setor</h2>
            <div className="space-y-2">
              {by_sector.map((s) => (
                <div key={s.sector}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{s.sector}</span>
                    <span className="text-slate-600">
                      {s.visited}/{s.total} <span className="text-slate-400">({s.coverage_pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        s.coverage_pct >= 80 ? 'bg-emerald-500' :
                        s.coverage_pct >= 50 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${s.coverage_pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Detalhamento por dia */}
        {by_day.length > 0 && (
          <section className="mb-8 page-break">
            <h2 className="section-title"><Clock className="w-5 h-5" /> Detalhamento por Dia</h2>
            <div className="space-y-5">
              {by_day.map((d) => (
                <div key={d.date} className="border border-slate-200 rounded-lg p-4 avoid-break">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs text-slate-500 uppercase">Dia {d.day_number}</div>
                      <div className="font-bold text-lg">{formatDate(d.date)}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div><strong>{d.visits}</strong> visitas · {d.unique_booths} stands únicos</div>
                      {d.first_visit && (
                        <div className="text-slate-500">
                          {formatTime(d.first_visit)} – {formatTime(d.last_visit)} · {d.active_hours}h ativas
                        </div>
                      )}
                      {d.avg_per_hour > 0 && (
                        <div className="text-slate-500">Ritmo: {d.avg_per_hour}/hora</div>
                      )}
                    </div>
                  </div>
                  {d.by_user.length > 0 && (
                    <div className="text-sm">
                      <div className="text-slate-500 text-xs mb-1">Por vendedor:</div>
                      <div className="flex flex-wrap gap-2">
                        {d.by_user.map((u) => (
                          <span key={u.user_id} className="bg-slate-100 px-2 py-1 rounded text-xs">
                            {u.user_name}: <strong>{u.count}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empresas visitadas */}
        {visited_companies.length > 0 && (
          <section className="mb-8 page-break">
            <h2 className="section-title"><CheckCircle2 className="w-5 h-5" /> Empresas Visitadas ({visited_companies.length})</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {visited_companies.map((c) => (
                <div key={c.id} className="flex items-start gap-2 py-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.company_name}</div>
                    {(c.booth_number || c.sector) && (
                      <div className="text-xs text-slate-500 truncate">
                        {c.booth_number && `#${c.booth_number}`}
                        {c.booth_number && c.sector && ' · '}
                        {c.sector}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pendentes (follow-up) */}
        {pending_list.length > 0 && (
          <section className="mb-8 page-break">
            <h2 className="section-title">
              <Clock className="w-5 h-5" /> Stands Pendentes ({pending_list.length})
            </h2>
            <div className="text-xs text-slate-500 mb-3">
              Para follow-up em futuras edições ou contato remoto.
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {pending_list.map((c) => (
                <div key={c.id} className="flex items-start gap-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{c.company_name}</div>
                    {(c.booth_number || c.sector) && (
                      <div className="text-xs text-slate-400 truncate">
                        {c.booth_number && `#${c.booth_number}`}
                        {c.booth_number && c.sector && ' · '}
                        {c.sector}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Galeria de fotos */}
        {photos.length > 0 && (
          <section className="mb-8 page-break">
            <h2 className="section-title"><Camera className="w-5 h-5" /> Galeria ({photos.length} fotos)</h2>
            <div className="grid grid-cols-3 gap-3">
              {photos.slice(0, 30).map((p, i) => (
                <div key={i} className="border border-slate-200 rounded overflow-hidden avoid-break">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.company_name || 'foto'} className="w-full h-32 object-cover" />
                  <div className="p-2 text-xs">
                    <div className="font-medium truncate">{p.company_name || '—'}</div>
                    <div className="text-slate-500 truncate">
                      {p.booth_number && `#${p.booth_number} · `}{p.user_name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {photos.length > 30 && (
              <div className="text-xs text-slate-500 mt-3 text-center">
                + {photos.length - 30} fotos não exibidas
              </div>
            )}
          </section>
        )}

        {/* Rodapé */}
        <footer className="mt-10 pt-4 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
          <div>{organization?.name || 'Controlei CRM'}</div>
          <div>Gerado em {formatDateTime(data.generated_at)}</div>
        </footer>
      </div>

      <style jsx global>{`
        .report-root .section-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.125rem;
          font-weight: 700;
          color: #0f172a;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 0.5rem;
          margin-bottom: 1rem;
        }
        @media print {
          .no-print { display: none !important; }
          /* esconde sidebar e banners do layout do dashboard */
          aside, nav[aria-label="Sidebar"], [data-sidebar], .command-palette { display: none !important; }
          html, body { background: white !important; color: #0f172a !important; }
          /* reseta main wrapper do dashboard layout */
          #main-content { padding: 0 !important; }
          #main-content > div { padding: 0 !important; max-width: none !important; }
          .report-root { background: white !important; min-height: auto !important; }
          .report-page { max-width: none !important; padding: 0 !important; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
          @page { margin: 1.2cm; size: A4; }
        }
      `}</style>
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: 'slate' | 'emerald' | 'amber' | 'blue' | 'red' }) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };
  return (
    <div className={`border rounded-lg p-3 ${colorMap[color]}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}
