'use client';

import { useState, useEffect, useCallback } from 'react';
import { DateRangePicker } from './date-range-picker';
import { StageConversionChart } from './stage-conversion-chart';
import { LostDealsChart } from './lost-deals-chart';
import { RevenueForecast } from './revenue-forecast';
import { UserPerformanceTable } from './user-performance-table';
import { ActivityTimelineChart } from './activity-timeline-chart';
import { DistributionCharts } from './distribution-charts';

export function ReportsDashboard() {
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?from=${from}&to=${to}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = () => {
    window.open(`/api/reports/export?from=${from}&to=${to}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-6 h-6 border-2 border-purple-800/30 border-t-emerald-500 rounded-full" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-purple-300/40 py-8">Erro ao carregar relatorios.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <div className="flex items-center gap-3">
          <span className="text-xs text-purple-300/40">
            {data.total_contacts} contatos | {data.total_interactions} interacoes
          </span>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-800/20 text-purple-300/60 hover:bg-purple-800/30 hover:text-purple-300 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Revenue Forecast */}
      <RevenueForecast forecast={data.forecast} />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StageConversionChart data={data.stageConversion} />
        <ActivityTimelineChart data={data.activityTimeline} />
      </div>

      {/* Distribution charts */}
      <DistributionCharts temperatureData={data.temperatureDistribution} originData={data.originDistribution} />

      {/* Lost deals */}
      <LostDealsChart data={data.lostByStage} />

      {/* User performance */}
      <UserPerformanceTable data={data.userPerformance} />
    </div>
  );
}
