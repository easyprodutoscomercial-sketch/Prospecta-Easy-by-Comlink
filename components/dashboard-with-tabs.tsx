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
  teamComparison: { name: string; avatar_url: string | null; contacts: number; interactions: number; meetings: number; conversions: number }[];
  conversionRanking: { name: string; avatar_url: string | null; conversions: number; total_interactions: number; conversion_rate: number }[];
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

  // Build race data from team comparison (sorted by total score)
  const raceData = [...data.teamComparison]
    .map((m) => ({ ...m, score: Math.round(((m.contacts / 10) * 0.5 + m.interactions * 1.5 + m.meetings * 2 + m.conversions * 4) * 10) / 10 }))
    .sort((a, b) => b.score - a.score);

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-[#1e0f35] border border-purple-800/30 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? tab.key === 'fornecedor'
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                  : tab.key === 'comprador'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                : 'text-purple-200/60 hover:text-emerald-300 border border-transparent'
            }`}
          >
            {tab.label}
            <span className={`ml-2 text-xs ${
              activeTab === tab.key ? 'text-current/50' : 'text-purple-300/40'
            }`}>
              {segments[tab.key].totalContacts}
            </span>
          </button>
        ))}
      </div>

      {/* Corrida de avatares — quem lidera este mês */}
      {raceData.length > 0 && (
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5 mb-8">
          <div className="flex items-start justify-between mb-4 gap-4">
            <h3 className="text-sm font-medium text-emerald-400">Corrida do Mês</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] text-purple-300/40 font-medium">Pontuação:</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-bold">10 Contatos = 0.5 pt</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold">Interação = 1.5 pt</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-bold">Reunião = 2 pts</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">Conversão = 4 pts</span>
            </div>
          </div>
          <div className="space-y-3">
            {raceData.map((member, idx) => {
              const isFirst = idx === 0;
              const maxScore = raceData[0].score || 1;
              const barPct = Math.max((member.score / maxScore) * 100, 3);
              const initials = member.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

              return (
                <div key={member.name} className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`shrink-0 ${isFirst ? 'avatar-winner' : idx >= 3 ? 'avatar-sad' : ''}`}>
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className={isFirst ? 'w-12 h-12 object-cover' : 'w-9 h-9 object-cover'}
                        style={{ borderRadius: '50% / 45%' }}
                      />
                    ) : (
                      <div
                        className={`flex items-center justify-center font-bold text-white ${
                          isFirst
                            ? 'w-12 h-12 text-base bg-gradient-to-br from-emerald-400 to-purple-500'
                            : 'w-9 h-9 text-xs bg-purple-800/50'
                        }`}
                        style={{ borderRadius: '50% / 45%' }}
                      >
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Name + race bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-xs font-semibold truncate ${isFirst ? 'text-emerald-400' : 'text-neutral-300'}`}>
                        {member.name}
                        {isFirst && ' 👑'}
                      </span>
                      <span className={`text-[10px] font-bold ml-2 ${isFirst ? 'text-emerald-400' : 'text-purple-300/40'}`}>
                        {member.score} pts
                      </span>
                    </div>
                    <div className="h-3 bg-purple-900/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                          isFirst
                            ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-yellow-400'
                            : idx === 1
                            ? 'bg-gradient-to-r from-purple-500 to-purple-400'
                            : idx === 2
                            ? 'bg-gradient-to-r from-orange-500 to-orange-400'
                            : 'bg-purple-700/40'
                        }`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5 border-l-4 border-l-neutral-400">
          <p className="text-xs text-purple-300/60 uppercase tracking-wide">Total de Contatos</p>
          <p className="text-2xl font-semibold text-neutral-100 mt-1">{data.totalContacts}</p>
        </div>
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5 border-l-4 border-l-amber-400">
          <p className="text-xs text-purple-300/60 uppercase tracking-wide">Em Prospecção</p>
          <p className="text-2xl font-semibold text-neutral-100 mt-1">{data.emProspeccao}</p>
        </div>
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5 border-l-4 border-l-green-400">
          <p className="text-xs text-purple-300/60 uppercase tracking-wide">Reuniões Marcadas</p>
          <p className="text-2xl font-semibold text-neutral-100 mt-1">{data.reunioesMarcadas}</p>
        </div>
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5 border-l-4 border-l-emerald-400">
          <p className="text-xs text-purple-300/60 uppercase tracking-wide">Convertidos</p>
          <p className="text-2xl font-semibold text-neutral-100 mt-1">{data.convertidos}</p>
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

        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg">
          <div className="px-5 py-4 flex justify-between items-center">
            <h2 className="text-sm font-medium text-emerald-400">Contatos Recentes</h2>
            <Link href="/contacts" className="text-xs text-purple-300/50 hover:text-emerald-400">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-purple-800/20">
            {data.recentContacts && data.recentContacts.length > 0 ? (
              data.recentContacts.map((contact: any) => (
                <Link
                  key={contact.id}
                  href={`/contacts/${contact.id}`}
                  className="px-5 py-3 hover:bg-purple-800/20 flex justify-between items-center transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-100">{contact.name}</p>
                    <p className="text-xs text-purple-300/60 mt-0.5">
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
                <p className="text-sm text-purple-300/40">Nenhum contato cadastrado ainda.</p>
                <Link href="/contacts/new" className="text-sm text-emerald-400 hover:underline font-medium mt-1 inline-block">
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
