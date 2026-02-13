'use client';

import { useState, useMemo } from 'react';
import DashboardCharts from './dashboard-charts';
import TeamComparisonChart from './team-comparison-chart';
import InteractionsByTypeChart from './interactions-by-type-chart';
import ResponseRateCard from './response-rate-card';
import ConversionRanking from './conversion-ranking';
import Link from 'next/link';
import { formatStatus, getStatusColor, STATUS_CHART_COLORS, STATUS_LABELS, INTERACTION_TYPE_LABELS, TEMPERATURA_LABELS, ORIGEM_LABELS, PROXIMA_ACAO_LABELS, ESTADOS_BRASIL } from '@/lib/utils/labels';

export interface SegmentData {
  statusCounts: { name: string; value: number; color: string }[];
  totalContacts: number;
  emProspeccao: number;
  reunioesMarcadas: number;
  convertidos: number;
  totalPipelineValue: number;
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
  allContacts: any[];
  recentContacts: any[];
  allInteractions: any[];
  allProfiles: any[];
  monthContacts: any[];
  monthInteractions: any[];
  monthRanges: { start: string; end: string; label: string }[];
}

const TABS = [
  { key: 'geral', label: 'Geral' },
  { key: 'fornecedor', label: 'Fornecedores' },
  { key: 'comprador', label: 'Compradores' },
] as const;

const STATUS_CONFIG = Object.entries(STATUS_LABELS).map(([key, label]) => ({
  key,
  label,
  color: STATUS_CHART_COLORS[key] || '#a3a3a3',
}));

function computeSegment(
  contacts: any[],
  interactions: any[],
  recentContacts: any[],
  allProfiles: any[],
  monthContacts: any[],
  monthInteractions: any[],
  monthRanges: { start: string; end: string; label: string }[]
): SegmentData {
  const statusMap: Record<string, number> = {};
  for (const c of contacts) {
    statusMap[c.status] = (statusMap[c.status] || 0) + 1;
  }
  const statusCounts = STATUS_CONFIG.map((s) => ({
    name: s.label,
    value: statusMap[s.key] || 0,
    color: s.color,
  }));

  const totalContacts = contacts.length;
  const emProspeccao = statusMap['EM_PROSPECCAO'] || 0;
  const reunioesMarcadas = statusMap['REUNIAO_MARCADA'] || 0;
  const convertidos = statusMap['CONVERTIDO'] || 0;

  const monthlyData = monthRanges.map((range) => {
    const count = contacts.filter(
      (c) => c.created_at >= range.start && c.created_at < range.end
    ).length;
    return { month: range.label, count };
  });

  const typeCountMap: Record<string, number> = {};
  for (const i of interactions) {
    typeCountMap[i.type] = (typeCountMap[i.type] || 0) + 1;
  }
  const interactionsByType = Object.entries(INTERACTION_TYPE_LABELS).map(([key, label]) => ({
    name: label,
    count: typeCountMap[key] || 0,
  }));

  const responded = interactions.filter((i) => i.outcome !== 'SEM_RESPOSTA').length;
  const noResponse = interactions.filter((i) => i.outcome === 'SEM_RESPOSTA').length;
  const totalInteractions = interactions.length;

  const teamComparison = allProfiles.map((p) => {
    const userContacts = monthContacts.filter((c) => c.created_by_user_id === p.user_id).length;
    const userInteractions = monthInteractions.filter((i) => i.created_by_user_id === p.user_id);
    const intCount = userInteractions.length;
    const meetings = userInteractions.filter((i) => i.type === 'REUNIAO' || i.type === 'VISITA').length;
    const conversions = userInteractions.filter((i) =>
      i.outcome === 'CONVERTIDO' || i.outcome === 'PROPOSTA_ACEITA' || i.outcome === 'FECHADO_PARCIAL'
    ).length;
    return {
      name: p.name.split(' ').slice(0, 2).join(' '),
      avatar_url: p.avatar_url || null,
      contacts: userContacts,
      interactions: intCount,
      meetings,
      conversions,
    };
  });

  const conversionRanking = allProfiles.map((p) => {
    const userInteractions = interactions.filter((i) => i.created_by_user_id === p.user_id);
    const total = userInteractions.length;
    const conversions = userInteractions.filter((i) =>
      i.outcome === 'CONVERTIDO' || i.outcome === 'PROPOSTA_ACEITA' || i.outcome === 'FECHADO_PARCIAL'
    ).length;
    const rate = total > 0 ? Math.round((conversions / total) * 100) : 0;
    return {
      name: p.name,
      avatar_url: p.avatar_url || null,
      conversions,
      total_interactions: total,
      conversion_rate: rate,
    };
  });

  const totalPipelineValue = contacts
    .filter((c) => c.status !== 'CONVERTIDO' && c.status !== 'PERDIDO')
    .reduce((sum, c) => sum + (c.valor_estimado || 0), 0);

  return {
    statusCounts,
    totalContacts,
    emProspeccao,
    reunioesMarcadas,
    convertidos,
    totalPipelineValue,
    monthlyData,
    interactionsByType,
    responded,
    noResponse,
    totalInteractions,
    teamComparison,
    conversionRanking,
    recentContacts: recentContacts.slice(0, 5),
  };
}

export default function DashboardWithTabs({
  allContacts,
  recentContacts,
  allInteractions,
  allProfiles,
  monthContacts,
  monthInteractions,
  monthRanges,
}: DashboardWithTabsProps) {
  const [activeTab, setActiveTab] = useState<string>('geral');
  const [temperaturaFilter, setTemperaturaFilter] = useState('all');
  const [origemFilter, setOrigemFilter] = useState('all');
  const [classeFilter, setClasseFilter] = useState('all');
  const [responsavelFilter, setResponsavelFilter] = useState('all');
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [proximaAcaoFilter, setProximaAcaoFilter] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advSearch, setAdvSearch] = useState({ cpf: '', cnpj: '', telefone: '', whatsapp: '', empresa: '', cidade: '', referencia: '', contato_nome: '', cargo: '', produtos_fornecidos: '' });

  const selectCls = 'px-2 py-1.5 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  // Build contact ID set and type map
  const contactIdMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of allContacts) map.set(c.id, c);
    for (const c of monthContacts) {
      if (!map.has(c.id)) map.set(c.id, c);
    }
    return map;
  }, [allContacts, monthContacts]);

  // Apply global filters to contacts
  const applyContactFilters = (contacts: any[]) => {
    let result = contacts;
    if (temperaturaFilter !== 'all') result = result.filter((c) => c.temperatura === temperaturaFilter);
    if (origemFilter !== 'all') result = result.filter((c) => c.origem === origemFilter);
    if (classeFilter !== 'all') result = result.filter((c) => c.classe === classeFilter);
    if (responsavelFilter !== 'all') result = result.filter((c) => c.assigned_to_user_id === responsavelFilter);
    if (estadoFilter !== 'all') result = result.filter((c) => c.estado === estadoFilter);
    if (proximaAcaoFilter !== 'all') result = result.filter((c) => c.proxima_acao_tipo === proximaAcaoFilter);
    const ilike = (val: string | null | undefined, q: string) => val ? val.toLowerCase().includes(q.toLowerCase()) : false;
    if (advSearch.cpf) result = result.filter((c) => ilike(c.cpf, advSearch.cpf));
    if (advSearch.cnpj) result = result.filter((c) => ilike(c.cnpj, advSearch.cnpj));
    if (advSearch.telefone) result = result.filter((c) => ilike(c.phone, advSearch.telefone));
    if (advSearch.whatsapp) result = result.filter((c) => ilike(c.whatsapp, advSearch.whatsapp));
    if (advSearch.empresa) result = result.filter((c) => ilike(c.company, advSearch.empresa));
    if (advSearch.cidade) result = result.filter((c) => ilike(c.cidade, advSearch.cidade));
    if (advSearch.referencia) result = result.filter((c) => ilike(c.referencia, advSearch.referencia));
    if (advSearch.contato_nome) result = result.filter((c) => ilike(c.contato_nome, advSearch.contato_nome));
    if (advSearch.cargo) result = result.filter((c) => ilike(c.cargo, advSearch.cargo));
    if (advSearch.produtos_fornecidos) result = result.filter((c) => ilike(c.produtos_fornecidos, advSearch.produtos_fornecidos));
    return result;
  };

  // Filter interactions based on filtered contact IDs
  const applyInteractionFilters = (interactions: any[], filteredContactIds: Set<string>) => {
    return interactions.filter((i) => filteredContactIds.has(i.contact_id));
  };

  // Compute segments with filters applied
  const segments = useMemo(() => {
    const filteredContacts = applyContactFilters(allContacts);
    const filteredContactIds = new Set(filteredContacts.map((c) => c.id));
    const filteredInteractions = applyInteractionFilters(allInteractions, filteredContactIds);
    const filteredRecent = applyContactFilters(recentContacts);
    const filteredMonthContacts = applyContactFilters(monthContacts);
    const filteredMonthInteractions = applyInteractionFilters(monthInteractions, filteredContactIds);

    // Filter by tipo helpers
    const filterByTipo = (items: any[], tipo: string) =>
      items.filter((c) => (c.tipo || []).includes(tipo));

    const filterInteractionsByTipo = (interactions: any[], tipo: string) =>
      interactions.filter((i) => {
        const contact = contactIdMap.get(i.contact_id);
        return contact && (contact.tipo || []).includes(tipo);
      });

    const geral = computeSegment(
      filteredContacts, filteredInteractions, filteredRecent,
      allProfiles, filteredMonthContacts, filteredMonthInteractions, monthRanges
    );

    const fornecedor = computeSegment(
      filterByTipo(filteredContacts, 'FORNECEDOR'),
      filterInteractionsByTipo(filteredInteractions, 'FORNECEDOR'),
      filteredRecent.filter((c) => (c.tipo || []).includes('FORNECEDOR')),
      allProfiles,
      filterByTipo(filteredMonthContacts, 'FORNECEDOR'),
      filterInteractionsByTipo(filteredMonthInteractions, 'FORNECEDOR'),
      monthRanges
    );

    const comprador = computeSegment(
      filterByTipo(filteredContacts, 'COMPRADOR'),
      filterInteractionsByTipo(filteredInteractions, 'COMPRADOR'),
      filteredRecent.filter((c) => (c.tipo || []).includes('COMPRADOR')),
      allProfiles,
      filterByTipo(filteredMonthContacts, 'COMPRADOR'),
      filterInteractionsByTipo(filteredMonthInteractions, 'COMPRADOR'),
      monthRanges
    );

    return { geral, fornecedor, comprador };
  }, [allContacts, allInteractions, recentContacts, allProfiles, monthContacts, monthInteractions, monthRanges, temperaturaFilter, origemFilter, classeFilter, responsavelFilter, estadoFilter, proximaAcaoFilter, advSearch, contactIdMap]);

  const data = segments[activeTab as keyof typeof segments];

  // Build race data from team comparison (sorted by total score)
  const raceData = [...data.teamComparison]
    .map((m) => ({ ...m, score: Math.round(((m.contacts / 10) * 0.5 + m.interactions * 1.5 + m.meetings * 2 + m.conversions * 4) * 10) / 10 }))
    .sort((a, b) => b.score - a.score);

  const hasActiveFilters = temperaturaFilter !== 'all' || origemFilter !== 'all' || classeFilter !== 'all' || responsavelFilter !== 'all' || estadoFilter !== 'all' || proximaAcaoFilter !== 'all' || Object.values(advSearch).some((v) => v !== '');

  return (
    <div>
      {/* Filters */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-3 sm:p-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-purple-300/60 font-medium">Filtros:</span>
          <select value={temperaturaFilter} onChange={(e) => setTemperaturaFilter(e.target.value)} className={selectCls}>
            <option value="all">Temperatura</option>
            {Object.entries(TEMPERATURA_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select value={origemFilter} onChange={(e) => setOrigemFilter(e.target.value)} className={selectCls}>
            <option value="all">Origem</option>
            {Object.entries(ORIGEM_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select value={classeFilter} onChange={(e) => setClasseFilter(e.target.value)} className={selectCls}>
            <option value="all">Classe</option>
            <option value="A">Classe A</option>
            <option value="B">Classe B</option>
            <option value="C">Classe C</option>
            <option value="D">Classe D</option>
          </select>
          <select value={responsavelFilter} onChange={(e) => setResponsavelFilter(e.target.value)} className={selectCls}>
            <option value="all">Responsavel</option>
            {allProfiles.map((p) => (
              <option key={p.user_id} value={p.user_id}>{p.name}</option>
            ))}
          </select>
          <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className={selectCls}>
            <option value="all">Estado</option>
            {ESTADOS_BRASIL.map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
          </select>
          <select value={proximaAcaoFilter} onChange={(e) => setProximaAcaoFilter(e.target.value)} className={selectCls}>
            <option value="all">Proxima Acao</option>
            {Object.entries(PROXIMA_ACAO_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
          </select>
          <button onClick={() => setShowAdvanced((p) => !p)} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
            {showAdvanced ? 'Menos' : 'Mais filtros'}
          </button>
          {hasActiveFilters && (
            <button
              onClick={() => { setTemperaturaFilter('all'); setOrigemFilter('all'); setClasseFilter('all'); setResponsavelFilter('all'); setEstadoFilter('all'); setProximaAcaoFilter('all'); setAdvSearch({ cpf: '', cnpj: '', telefone: '', whatsapp: '', empresa: '', cidade: '', referencia: '', contato_nome: '', cargo: '', produtos_fornecidos: '' }); }}
              className="px-2 py-1.5 text-xs font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>
        {showAdvanced && (
          <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-purple-800/20">
            <input type="text" placeholder="CPF..." value={advSearch.cpf} onChange={(e) => setAdvSearch((p) => ({ ...p, cpf: e.target.value }))} className={`${selectCls} w-28 placeholder:text-purple-300/40`} />
            <input type="text" placeholder="CNPJ..." value={advSearch.cnpj} onChange={(e) => setAdvSearch((p) => ({ ...p, cnpj: e.target.value }))} className={`${selectCls} w-32 placeholder:text-purple-300/40`} />
            <input type="text" placeholder="Telefone..." value={advSearch.telefone} onChange={(e) => setAdvSearch((p) => ({ ...p, telefone: e.target.value }))} className={`${selectCls} w-28 placeholder:text-purple-300/40`} />
            <input type="text" placeholder="WhatsApp..." value={advSearch.whatsapp} onChange={(e) => setAdvSearch((p) => ({ ...p, whatsapp: e.target.value }))} className={`${selectCls} w-28 placeholder:text-purple-300/40`} />
            <input type="text" placeholder="Empresa..." value={advSearch.empresa} onChange={(e) => setAdvSearch((p) => ({ ...p, empresa: e.target.value }))} className={`${selectCls} w-28 placeholder:text-purple-300/40`} />
            <input type="text" placeholder="Cidade..." value={advSearch.cidade} onChange={(e) => setAdvSearch((p) => ({ ...p, cidade: e.target.value }))} className={`${selectCls} w-28 placeholder:text-purple-300/40`} />
            <input type="text" placeholder="Referencia..." value={advSearch.referencia} onChange={(e) => setAdvSearch((p) => ({ ...p, referencia: e.target.value }))} className={`${selectCls} w-28 placeholder:text-purple-300/40`} />
            <input type="text" placeholder="Nome Contato..." value={advSearch.contato_nome} onChange={(e) => setAdvSearch((p) => ({ ...p, contato_nome: e.target.value }))} className={`${selectCls} w-32 placeholder:text-purple-300/40`} />
            <input type="text" placeholder="Cargo..." value={advSearch.cargo} onChange={(e) => setAdvSearch((p) => ({ ...p, cargo: e.target.value }))} className={`${selectCls} w-28 placeholder:text-purple-300/40`} />
            <input type="text" placeholder="Produtos..." value={advSearch.produtos_fornecidos} onChange={(e) => setAdvSearch((p) => ({ ...p, produtos_fornecidos: e.target.value }))} className={`${selectCls} w-28 placeholder:text-purple-300/40`} />
          </div>
        )}
      </div>

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
              {segments[tab.key as keyof typeof segments].totalContacts}
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
                  <div className={`shrink-0 rounded-full overflow-hidden ${isFirst ? 'avatar-winner w-12 h-12' : idx >= 3 ? 'avatar-sad w-9 h-9' : 'w-9 h-9'}`}>
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className={isFirst ? 'w-12 h-12 object-cover rounded-full' : 'w-9 h-9 object-cover rounded-full'}
                      />
                    ) : (
                      <div
                        className={`flex items-center justify-center font-bold text-white rounded-full ${
                          isFirst
                            ? 'w-12 h-12 text-base bg-gradient-to-br from-emerald-400 to-purple-500'
                            : 'w-9 h-9 text-xs bg-purple-800/50'
                        }`}
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="kpi-card bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5 border-l-4 border-l-neutral-400">
          <p className="text-[10px] text-purple-300/60 uppercase tracking-widest font-semibold">Total de Contatos</p>
          <p className="text-3xl font-bold text-neutral-100 mt-2 number-animate">{data.totalContacts}</p>
        </div>
        <div className="kpi-card bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5 border-l-4 border-l-amber-400">
          <p className="text-[10px] text-purple-300/60 uppercase tracking-widest font-semibold">Em Prospecção</p>
          <p className="text-3xl font-bold text-amber-400 mt-2 number-animate">{data.emProspeccao}</p>
        </div>
        <div className="kpi-card bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5 border-l-4 border-l-green-400">
          <p className="text-[10px] text-purple-300/60 uppercase tracking-widest font-semibold">Reuniões Marcadas</p>
          <p className="text-3xl font-bold text-green-400 mt-2 number-animate">{data.reunioesMarcadas}</p>
        </div>
        <div className="kpi-card bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5 border-l-4 border-l-emerald-400">
          <p className="text-[10px] text-purple-300/60 uppercase tracking-widest font-semibold">Convertidos</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2 number-animate">{data.convertidos}</p>
        </div>
        <div className="kpi-card bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5 border-l-4 border-l-emerald-500 col-span-2 md:col-span-1">
          <p className="text-[10px] text-purple-300/60 uppercase tracking-widest font-semibold">Valor no Pipeline</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2 number-animate">
            {data.totalPipelineValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
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
