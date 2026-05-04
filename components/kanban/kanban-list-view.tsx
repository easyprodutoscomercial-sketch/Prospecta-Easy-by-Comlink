'use client';

import { useState, useMemo } from 'react';
import type { Contact, PipelineStage } from '@/lib/types';
import type { UserInfo } from './kanban-card';
import { TEMPERATURA_LABELS, TEMPERATURA_COLORS } from '@/lib/utils/labels';
import { getUserInitials } from '@/lib/utils/user-colors';

interface KanbanListViewProps {
  contacts: Contact[];
  stages: PipelineStage[];
  userMap: Record<string, UserInfo>;
  onCardClick?: (contactId: string) => void;
  lastInteractionMap?: Record<string, string>;
  stageMap: Record<string, PipelineStage>;
}

type SortKey = 'name' | 'company' | 'valor_estimado' | 'temperatura' | 'responsavel' | 'stage' | 'days_in_stage' | 'last_interaction';
type SortDir = 'asc' | 'desc';

function daysInStage(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
}

export function KanbanListView({ contacts, stages, userMap, onCardClick, lastInteractionMap, stageMap }: KanbanListViewProps) {
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    const list = [...contacts];
    const dir = sortDir === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'company':
          return dir * (a.company || '').localeCompare(b.company || '');
        case 'valor_estimado':
          return dir * ((a.valor_estimado || 0) - (b.valor_estimado || 0));
        case 'temperatura': {
          const order = { QUENTE: 3, MORNO: 2, FRIO: 1 };
          return dir * ((order[a.temperatura as keyof typeof order] || 0) - (order[b.temperatura as keyof typeof order] || 0));
        }
        case 'responsavel': {
          const nameA = userMap[a.assigned_to_user_id || '']?.name || '';
          const nameB = userMap[b.assigned_to_user_id || '']?.name || '';
          return dir * nameA.localeCompare(nameB);
        }
        case 'stage': {
          const posA = stageMap[a.stage_id || '']?.position ?? 0;
          const posB = stageMap[b.stage_id || '']?.position ?? 0;
          return dir * (posA - posB);
        }
        case 'days_in_stage':
          return dir * (daysInStage(a.updated_at) - daysInStage(b.updated_at));
        case 'last_interaction': {
          const dateA = lastInteractionMap?.[a.id] || '';
          const dateB = lastInteractionMap?.[b.id] || '';
          return dir * dateA.localeCompare(dateB);
        }
        default:
          return 0;
      }
    });

    return list;
  }, [contacts, sortBy, sortDir, userMap, stageMap, lastInteractionMap]);

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
    <th
      className="text-left px-3 py-2 text-[10px] text-purple-300/50 uppercase tracking-wider font-semibold cursor-pointer hover:text-purple-200 transition-colors select-none whitespace-nowrap"
      onClick={() => toggleSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === sortKey && (
          <svg className={`w-3 h-3 transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        )}
      </div>
    </th>
  );

  return (
    <div className="overflow-auto h-full rounded-xl border border-purple-800/15">
      {/* === MOBILE: Card list === */}
      <div className="sm:hidden">
        {/* Sort selector for mobile */}
        <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-[#160b2e] border-b border-purple-800/20">
          <span className="text-[10px] text-purple-300/40 uppercase tracking-wider shrink-0">Ordenar:</span>
          <select
            value={sortBy}
            onChange={(e) => toggleSort(e.target.value as SortKey)}
            className="text-[11px] bg-[#1e0f35] border border-purple-700/20 rounded-lg px-2 py-1 text-neutral-200 focus:outline-none flex-1"
          >
            <option value="name">Nome</option>
            <option value="company">Empresa</option>
            <option value="valor_estimado">Valor</option>
            <option value="temperatura">Temperatura</option>
            <option value="responsavel">Responsavel</option>
            <option value="stage">Stage</option>
            <option value="days_in_stage">Dias</option>
            <option value="last_interaction">Ultima int.</option>
          </select>
          <button
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="p-1 text-purple-300/50 hover:text-purple-200 transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>

        {/* Card list */}
        <div className="divide-y divide-purple-800/10">
          {sorted.map((contact) => {
            const owner = userMap[contact.assigned_to_user_id || contact.created_by_user_id || ''];
            const stage = stageMap[contact.stage_id || ''];
            const days = daysInStage(contact.updated_at);

            return (
              <div
                key={contact.id}
                onClick={() => onCardClick?.(contact.id)}
                className="px-3 py-2.5 bg-[#1e0f35] hover:bg-[#241540] cursor-pointer transition-colors active:bg-[#2a1845]"
              >
                <div className="flex items-center gap-2">
                  {/* Owner avatar */}
                  <div className="shrink-0">
                    {owner?.avatar_url ? (
                      <img src={owner.avatar_url} alt={owner.name} className="w-7 h-7 object-cover rounded-full" />
                    ) : owner ? (
                      <div
                        className="w-7 h-7 flex items-center justify-center text-[9px] font-bold rounded-full"
                        style={{ backgroundColor: owner.color.bg, color: owner.color.text }}
                      >{getUserInitials(owner.name)}</div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-purple-800/20 flex items-center justify-center">
                        <span className="text-[9px] text-purple-300/30">?</span>
                      </div>
                    )}
                  </div>

                  {/* Name + company */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-neutral-100 truncate">{contact.name}</p>
                    {contact.company && (
                      <p className="text-[10px] text-purple-300/40 truncate">{contact.company}</p>
                    )}
                  </div>

                  {/* Value */}
                  {contact.valor_estimado != null && contact.valor_estimado > 0 && (
                    <span className="text-[11px] font-bold text-emerald-400 shrink-0">
                      {contact.valor_estimado >= 1000
                        ? `${(contact.valor_estimado / 1000).toFixed(0)}k`
                        : contact.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>

                {/* Bottom row: stage + temperature + days */}
                <div className="flex items-center gap-1.5 mt-1.5 ml-9">
                  {stage && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${stage.color}20`, color: stage.color }}>
                      {stage.name}
                    </span>
                  )}
                  {contact.temperatura && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${TEMPERATURA_COLORS[contact.temperatura] || ''}`}>
                      {TEMPERATURA_LABELS[contact.temperatura] || contact.temperatura}
                    </span>
                  )}
                  <span className={`text-[9px] ${days > 7 ? 'text-amber-400 font-bold' : 'text-purple-300/30'}`}>
                    {days}d
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* === DESKTOP: Table === */}
      <table className="w-full border-collapse hidden sm:table">
        <thead className="bg-[#160b2e] sticky top-0 z-10">
          <tr className="border-b border-purple-800/20">
            <SortHeader label="Nome" sortKey="name" />
            <SortHeader label="Empresa" sortKey="company" />
            <SortHeader label="Valor" sortKey="valor_estimado" />
            <SortHeader label="Temp." sortKey="temperatura" />
            <SortHeader label="Responsavel" sortKey="responsavel" />
            <SortHeader label="Stage" sortKey="stage" />
            <SortHeader label="Dias" sortKey="days_in_stage" />
            <SortHeader label="Ultima int." sortKey="last_interaction" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((contact) => {
            const owner = userMap[contact.assigned_to_user_id || contact.created_by_user_id || ''];
            const stage = stageMap[contact.stage_id || ''];
            const days = daysInStage(contact.updated_at);
            const lastInt = lastInteractionMap?.[contact.id];

            return (
              <tr
                key={contact.id}
                onClick={() => onCardClick?.(contact.id)}
                className="border-b border-purple-800/10 bg-[#1e0f35] hover:bg-[#241540] cursor-pointer transition-colors"
                style={{ contentVisibility: 'auto' }}
              >
                <td className="px-3 py-2.5">
                  <span className="text-sm font-medium text-neutral-100">{contact.name}</span>
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell">
                  <span className="text-xs text-purple-300/50 truncate max-w-[120px] block">{contact.company || '-'}</span>
                </td>
                <td className="px-3 py-2.5">
                  {contact.valor_estimado != null && contact.valor_estimado > 0 ? (
                    <span className="text-xs font-bold text-emerald-400">
                      {contact.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                    </span>
                  ) : (
                    <span className="text-xs text-purple-300/25">-</span>
                  )}
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell">
                  {contact.temperatura ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TEMPERATURA_COLORS[contact.temperatura] || ''}`}>
                      {TEMPERATURA_LABELS[contact.temperatura] || contact.temperatura}
                    </span>
                  ) : (
                    <span className="text-xs text-purple-300/25">-</span>
                  )}
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell">
                  {owner ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                        {owner.avatar_url ? (
                          <img src={owner.avatar_url} alt={owner.name} className="w-5 h-5 object-cover rounded-full" />
                        ) : (
                          <div
                            className="w-5 h-5 flex items-center justify-center text-[7px] font-bold rounded-full"
                            style={{ backgroundColor: owner.color.bg, color: owner.color.text }}
                          >{getUserInitials(owner.name)}</div>
                        )}
                      </div>
                      <span className="text-xs text-neutral-300 truncate max-w-[80px]">{owner.name.split(' ')[0]}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-purple-300/25">-</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {stage ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${stage.color}20`, color: stage.color }}>
                      {stage.name}
                    </span>
                  ) : (
                    <span className="text-xs text-purple-300/25">-</span>
                  )}
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell">
                  <span className={`text-xs ${days > 7 ? 'text-amber-400 font-bold' : 'text-purple-300/40'}`}>
                    {days}d
                  </span>
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell">
                  {lastInt ? (
                    <span className="text-xs text-purple-300/40">
                      {new Date(lastInt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  ) : (
                    <span className="text-xs text-purple-300/25">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-purple-300/30">Nenhum contato encontrado</p>
        </div>
      )}
    </div>
  );
}
