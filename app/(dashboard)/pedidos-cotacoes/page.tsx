'use client';

import { useState } from 'react';
import Tabs from '@/components/ui/tabs';
import PcOverview from '@/components/pedidos-cotacoes/pc-overview';
import PcClientsTab from '@/components/pedidos-cotacoes/pc-clients-tab';
import PcCotacoesTab from '@/components/pedidos-cotacoes/pc-cotacoes-tab';
import PcPedidosTab from '@/components/pedidos-cotacoes/pc-pedidos-tab';

const tabs = [
  { key: 'overview', label: 'Visao Geral' },
  { key: 'clients', label: 'Clientes' },
  { key: 'cotacoes', label: 'Cotacoes' },
  { key: 'pedidos', label: 'Pedidos' },
];

export default function PedidosCotacoesPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-100">Pedidos & Cotacoes</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Gerencie clientes, cotacoes e pedidos</p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && <PcOverview />}
        {activeTab === 'clients' && <PcClientsTab />}
        {activeTab === 'cotacoes' && <PcCotacoesTab />}
        {activeTab === 'pedidos' && <PcPedidosTab />}
      </div>
    </div>
  );
}
