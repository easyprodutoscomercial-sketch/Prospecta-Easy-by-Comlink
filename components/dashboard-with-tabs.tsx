'use client';

import { useState } from 'react';
import DashboardCharts from './dashboard-charts';
import TeamComparisonChart from './team-comparison-chart';
import InteractionsByTypeChart from './interactions-by-type-chart';
import ResponseRateCard from './response-rate-card';
import ConversionRanking from './conversion-ranking';
import Link from 'next/link';
import { formatStatus, getStatusColor } from '@/lib/utils/labels';

export interface SegmentData {
  statusCounts: { name: string; value: number; color: string }[];
  totalContacts: number;
  emProspeccao: number;
  reunioesMarcadas: number;
  convertidos: number;
  monthlyData: { month: string; count: number }[];
  interactionsByType: { name: string; count: number }[];
  responded: number;
  noResponse: number;
  totalInteractions: number;
  teamComparison: { name: string; contacts: number; interactions: number; meetings: number; conversions: number }[];
  conversionRanking: { name: string; conversions: number; total_interactions: number; conversion_rate: number }[];
  recentContacts: any[];
}

interface DashboardWithTabsProps {
  geral: SegmentData;
  fornecedor: SegmentData;
  comprador: SegmentData;
}

const TABS = [
  { key: 'geral', label: 'Geral' },
  { key: 'fornecedor', label: 'Fornecedores' },
  { key: 'comprador', label: 'Compradores' },
] as const;

export default function DashboardWithTabs({ geral, fornecedor, comprador }: DashboardWithTabsProps) {
  const [activeTab, setActiveTab] = useState<string>('geral');

  const segments: Record<string, SegmentData> = { geral, fornecedor, comprador };
  const data = segments[activeTab];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-white rounded-lg p-1 shadow-sm w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? tab.key === 'fornecedor'
                  ? 'bg-purple-600 text-white'
                  : tab.key === 'comprador'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-neutral-900 text-white'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
            }`}
          >
            {tab.label}
            <span className={`ml-2 text-xs ${
              activeTab === tab.key ? 'text-white/70' : 'text-neutral-400'
            }`}>
              {segments[tab.key].totalContacts}
            </span>
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-neutral-400">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Total de Contatos</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{data.totalContacts}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-amber-400">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Em Prospecção</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{data.emProspeccao}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-green-400">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Reuniões Marcadas</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{data.reunioesMarcadas}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-emerald-400">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Convertidos</p>
          <p className="text-2xl font-semibold text-neutral-900 mt-1">{data.convertidos}</p>
        </div>
      </div>

      {/* Team comparison chart */}
      <div className="mb-8">
        <TeamComparisonChart data={data.teamComparison} />
      </div>

      {/* Charts row: Status + Monthly */}
      <DashboardCharts statusData={data.statusCounts} monthlyData={data.monthlyData} />

      {/* Interactions by type + Response rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <InteractionsByTypeChart data={data.interactionsByType} />
        <ResponseRateCard responded={data.responded} noResponse={data.noResponse} total={data.totalInteractions} />
      </div>

      {/* Conversion ranking + Recent contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversionRanking data={data.conversionRanking} />

        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-5 py-4 flex justify-between items-center">
            <h2 className="text-sm font-medium text-neutral-900">Contatos Recentes</h2>
            <Link href="/contacts" className="text-xs text-neutral-500 hover:text-neutral-900">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-neutral-100">
            {data.recentContacts && data.recentContacts.length > 0 ? (
              data.recentContacts.map((contact: any) => (
                <Link
                  key={contact.id}
                  href={`/contacts/${contact.id}`}
                  className="px-5 py-3 hover:bg-neutral-50 flex justify-between items-center block transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{contact.name}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {contact.email || contact.phone || contact.company || '-'}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(contact.status)}`}>
                    {formatStatus(contact.status)}
                  </span>
                </Link>
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-neutral-500">Nenhum contato cadastrado ainda.</p>
                <Link href="/contacts/new" className="text-sm text-neutral-900 hover:underline font-medium mt-1 inline-block">
                  Criar primeiro contato
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
