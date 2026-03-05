'use client';

import { useState, useEffect } from 'react';
import { PcStats } from '@/lib/types';
import PcStatsCards from './pc-stats-cards';
import PcResponseChart from './pc-response-chart';
import PcClientsStatusChart from './pc-clients-status-chart';
import PcPedidosChart from './pc-pedidos-chart';
import PcTopFornecedoresChart from './pc-top-fornecedores-chart';
import PcAiAnalysis from './pc-ai-analysis';
import PcAlertsPanel from './pc-alerts-panel';

export default function PcOverview() {
  const [stats, setStats] = useState<PcStats | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/pedidos-cotacoes/stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error('Error fetching PC stats:', err);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <PcAlertsPanel alerts={stats?.alerts ?? []} />
      <PcStatsCards stats={stats} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PcResponseChart
          responderam={stats?.cotacoes_responderam ?? 0}
          naoResponderam={stats?.cotacoes_nao_responderam ?? 0}
        />
        <PcClientsStatusChart
          clientsByStatus={stats?.clients_by_status ?? {}}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PcPedidosChart
          pedidosBySituacao={stats?.pedidos_by_situacao ?? {}}
        />
        <PcTopFornecedoresChart
          data={stats?.top_fornecedores ?? []}
        />
      </div>

      <PcAiAnalysis stats={stats} />
    </div>
  );
}
