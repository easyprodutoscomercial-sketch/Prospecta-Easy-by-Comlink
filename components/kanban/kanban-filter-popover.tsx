'use client';

import { useState, useRef, useEffect } from 'react';
import type { ContactType } from '@/lib/types';
import type { UserInfo } from './kanban-card';
import { TEMPERATURA_LABELS, ORIGEM_LABELS, PROXIMA_ACAO_LABELS, ESTADOS_BRASIL } from '@/lib/utils/labels';

interface FilterState {
  tipoFilter: '' | ContactType;
  responsavelFilter: string;
  temperaturaFilter: string;
  origemFilter: string;
  classeFilter: string;
  estadoFilter: string;
  proximaAcaoFilter: string;
  advSearch: {
    cpf: string;
    cnpj: string;
    whatsapp: string;
    empresa: string;
    cidade: string;
    telefone: string;
    referencia: string;
    contato_nome: string;
    cargo: string;
    produtos_fornecidos: string;
  };
}

interface KanbanFilterPopoverProps {
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClearAll: () => void;
  activeFilterCount: number;
  userMap: Record<string, UserInfo>;
  isOpen: boolean;
  onClose: () => void;
}

const selectClass = "text-xs bg-[#1e0f35] border border-purple-700/20 rounded-lg px-2.5 py-2 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 w-full";
const inputClass = "text-xs bg-[#1e0f35] border border-purple-700/20 rounded-lg px-2.5 py-2 text-neutral-200 placeholder:text-purple-300/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 w-full";

export function KanbanFilterPopover({ filters, onFilterChange, onClearAll, activeFilterCount, userMap, isOpen, onClose }: KanbanFilterPopoverProps) {
  const [tab, setTab] = useState<'quick' | 'advanced'>('quick');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="fixed inset-x-3 top-auto bottom-0 sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:left-0 sm:right-auto sm:mt-2 z-50 sm:w-[480px] sm:max-w-[calc(100vw-2rem)] bg-[#1e0f35] border border-purple-800/30 rounded-t-xl sm:rounded-xl shadow-2xl shadow-purple-900/40 animate-fade-in max-h-[80vh] sm:max-h-none overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-800/20">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-sm font-semibold text-neutral-200">Filtros</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button onClick={onClearAll} className="text-[10px] text-red-400/70 hover:text-red-400 font-medium">
              Limpar tudo
            </button>
          )}
          <button onClick={onClose} className="text-purple-400/50 hover:text-purple-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-purple-800/20">
        <button
          onClick={() => setTab('quick')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            tab === 'quick' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-purple-300/50 hover:text-purple-200'
          }`}
        >
          Filtros Rapidos
        </button>
        <button
          onClick={() => setTab('advanced')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            tab === 'advanced' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-purple-300/50 hover:text-purple-200'
          }`}
        >
          Busca Avancada
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {tab === 'quick' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={filters.tipoFilter} onChange={(e) => onFilterChange('tipoFilter', e.target.value as '' | ContactType)} className={selectClass}>
              <option value="">Tipo</option>
              <option value="FORNECEDOR">Fornecedor</option>
              <option value="COMPRADOR">Comprador</option>
            </select>
            <select value={filters.responsavelFilter} onChange={(e) => onFilterChange('responsavelFilter', e.target.value)} className={selectClass}>
              <option value="">Responsavel</option>
              <option value="_none">Sem responsavel</option>
              {Object.entries(userMap).map(([userId, user]) => (
                <option key={userId} value={userId}>{user.name}</option>
              ))}
            </select>
            <select value={filters.temperaturaFilter} onChange={(e) => onFilterChange('temperaturaFilter', e.target.value)} className={selectClass}>
              <option value="">Temperatura</option>
              {Object.entries(TEMPERATURA_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select value={filters.origemFilter} onChange={(e) => onFilterChange('origemFilter', e.target.value)} className={selectClass}>
              <option value="">Origem</option>
              {Object.entries(ORIGEM_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select value={filters.classeFilter} onChange={(e) => onFilterChange('classeFilter', e.target.value)} className={selectClass}>
              <option value="">Classe</option>
              <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
            </select>
            <select value={filters.estadoFilter} onChange={(e) => onFilterChange('estadoFilter', e.target.value)} className={selectClass}>
              <option value="">Estado</option>
              {ESTADOS_BRASIL.map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
            </select>
            <select value={filters.proximaAcaoFilter} onChange={(e) => onFilterChange('proximaAcaoFilter', e.target.value)} className={selectClass + ' col-span-2'}>
              <option value="">Proxima Acao</option>
              {Object.entries(PROXIMA_ACAO_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" placeholder="CPF" value={filters.advSearch.cpf} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, cpf: e.target.value })} className={inputClass} />
            <input type="text" placeholder="CNPJ" value={filters.advSearch.cnpj} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, cnpj: e.target.value })} className={inputClass} />
            <input type="text" placeholder="Telefone" value={filters.advSearch.telefone} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, telefone: e.target.value })} className={inputClass} />
            <input type="text" placeholder="Empresa" value={filters.advSearch.empresa} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, empresa: e.target.value })} className={inputClass} />
            <input type="text" placeholder="Cidade" value={filters.advSearch.cidade} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, cidade: e.target.value })} className={inputClass} />
            <input type="text" placeholder="WhatsApp" value={filters.advSearch.whatsapp} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, whatsapp: e.target.value })} className={inputClass} />
            <input type="text" placeholder="Referencia" value={filters.advSearch.referencia} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, referencia: e.target.value })} className={inputClass} />
            <input type="text" placeholder="Contato" value={filters.advSearch.contato_nome} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, contato_nome: e.target.value })} className={inputClass} />
            <input type="text" placeholder="Cargo" value={filters.advSearch.cargo} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, cargo: e.target.value })} className={inputClass} />
            <input type="text" placeholder="Produtos" value={filters.advSearch.produtos_fornecidos} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, produtos_fornecidos: e.target.value })} className={inputClass} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Active filter chips that show inline in header */
export function FilterChips({ filters, onFilterChange, userMap }: { filters: FilterState; onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void; userMap: Record<string, UserInfo> }) {
  const chips: { label: string; onRemove: () => void }[] = [];

  if (filters.tipoFilter) chips.push({ label: `Tipo: ${filters.tipoFilter === 'FORNECEDOR' ? 'Fornecedor' : 'Comprador'}`, onRemove: () => onFilterChange('tipoFilter', '' as '' | ContactType) });
  if (filters.responsavelFilter) {
    const name = filters.responsavelFilter === '_none' ? 'Sem resp.' : (userMap[filters.responsavelFilter]?.name || 'Desconhecido');
    chips.push({ label: `Resp: ${name}`, onRemove: () => onFilterChange('responsavelFilter', '') });
  }
  if (filters.temperaturaFilter) chips.push({ label: `Temp: ${TEMPERATURA_LABELS[filters.temperaturaFilter as keyof typeof TEMPERATURA_LABELS] || filters.temperaturaFilter}`, onRemove: () => onFilterChange('temperaturaFilter', '') });
  if (filters.origemFilter) chips.push({ label: `Origem: ${ORIGEM_LABELS[filters.origemFilter as keyof typeof ORIGEM_LABELS] || filters.origemFilter}`, onRemove: () => onFilterChange('origemFilter', '') });
  if (filters.classeFilter) chips.push({ label: `Classe: ${filters.classeFilter}`, onRemove: () => onFilterChange('classeFilter', '') });
  if (filters.estadoFilter) chips.push({ label: `Estado: ${filters.estadoFilter}`, onRemove: () => onFilterChange('estadoFilter', '') });
  if (filters.proximaAcaoFilter) chips.push({ label: `Acao: ${PROXIMA_ACAO_LABELS[filters.proximaAcaoFilter as keyof typeof PROXIMA_ACAO_LABELS] || filters.proximaAcaoFilter}`, onRemove: () => onFilterChange('proximaAcaoFilter', '') });

  const advKeys = Object.entries(filters.advSearch).filter(([, v]) => v);
  for (const [key, value] of advKeys) {
    chips.push({
      label: `${key}: ${value}`,
      onRemove: () => onFilterChange('advSearch', { ...filters.advSearch, [key]: '' }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400"
        >
          {chip.label}
          <button onClick={chip.onRemove} className="text-emerald-400/50 hover:text-red-400 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
    </div>
  );
}
