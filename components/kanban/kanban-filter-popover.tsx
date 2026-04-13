'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  feiraFilter: string;
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

export interface EventOption {
  id: string;
  name: string;
  cover_image_url?: string | null;
}

interface KanbanFilterPopoverProps {
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClearAll: () => void;
  activeFilterCount: number;
  userMap: Record<string, UserInfo>;
  events?: EventOption[];
  isOpen: boolean;
  onClose: () => void;
}

const selectClass = "text-xs bg-[#120826] border border-purple-700/30 rounded-lg px-2.5 py-2.5 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 w-full appearance-none";
const inputClass = "text-xs bg-[#120826] border border-purple-700/30 rounded-lg px-2.5 py-2.5 text-neutral-200 placeholder:text-purple-300/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 w-full";

export function KanbanFilterPopover({ filters, onFilterChange, onClearAll, activeFilterCount, userMap, events, isOpen, onClose }: KanbanFilterPopoverProps) {
  const [tab, setTab] = useState<'quick' | 'advanced'>('quick');
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const modal = (
    <div className="fixed inset-0" style={{ zIndex: 1000 }}>
      {/* Backdrop — fully opaque dark overlay */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Panel container — centered on desktop, bottom sheet on mobile */}
      <div className="absolute inset-0 flex items-end sm:items-center sm:justify-center pointer-events-none">
        <div
          ref={panelRef}
          className="pointer-events-auto w-full sm:w-[500px] sm:max-w-[calc(100vw-2rem)] max-h-[85vh] sm:max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
          style={{ backgroundColor: '#0a0418', boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(139,92,246,0.15)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-purple-800/25" style={{ backgroundColor: '#0e0620' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold text-neutral-100">Filtros</span>
                {activeFilterCount > 0 && (
                  <span className="ml-2 inline-flex w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {activeFilterCount > 0 && (
                <button onClick={onClearAll} className="text-[11px] text-red-400/80 hover:text-red-400 font-semibold transition-colors">
                  Limpar tudo
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 flex items-center justify-center text-purple-300/60 hover:text-purple-200 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-purple-800/25" style={{ backgroundColor: '#0e0620' }}>
            <button
              onClick={() => setTab('quick')}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${
                tab === 'quick' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-purple-300/50 hover:text-purple-200'
              }`}
            >
              Filtros Rapidos
            </button>
            <button
              onClick={() => setTab('advanced')}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${
                tab === 'advanced' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-purple-300/50 hover:text-purple-200'
              }`}
            >
              Busca Avancada
            </button>
          </div>

          {/* Content — scrollable */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5" style={{ backgroundColor: '#0a0418' }}>
            {tab === 'quick' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Tipo</label>
                  <select value={filters.tipoFilter} onChange={(e) => onFilterChange('tipoFilter', e.target.value as '' | ContactType)} className={selectClass}>
                    <option value="">Todos</option>
                    <option value="FORNECEDOR">Fornecedor</option>
                    <option value="COMPRADOR">Comprador</option>
                    <option value="AMBOS">Ambos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Responsavel</label>
                  <select value={filters.responsavelFilter} onChange={(e) => onFilterChange('responsavelFilter', e.target.value)} className={selectClass}>
                    <option value="">Todos</option>
                    <option value="_none">Sem responsavel</option>
                    {Object.entries(userMap).map(([userId, user]) => (
                      <option key={userId} value={userId}>{user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Temperatura</label>
                  <select value={filters.temperaturaFilter} onChange={(e) => onFilterChange('temperaturaFilter', e.target.value)} className={selectClass}>
                    <option value="">Todas</option>
                    {Object.entries(TEMPERATURA_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Origem</label>
                  <select value={filters.origemFilter} onChange={(e) => onFilterChange('origemFilter', e.target.value)} className={selectClass}>
                    <option value="">Todas</option>
                    {Object.entries(ORIGEM_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Classe</label>
                  <select value={filters.classeFilter} onChange={(e) => onFilterChange('classeFilter', e.target.value)} className={selectClass}>
                    <option value="">Todas</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Estado</label>
                  <select value={filters.estadoFilter} onChange={(e) => onFilterChange('estadoFilter', e.target.value)} className={selectClass}>
                    <option value="">Todos</option>
                    {ESTADOS_BRASIL.map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Proxima Acao</label>
                  <select value={filters.proximaAcaoFilter} onChange={(e) => onFilterChange('proximaAcaoFilter', e.target.value)} className={selectClass}>
                    <option value="">Todas</option>
                    {Object.entries(PROXIMA_ACAO_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
                  </select>
                </div>
                {events && events.length > 0 && (
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Feira / Evento</label>
                    <select value={filters.feiraFilter} onChange={(e) => onFilterChange('feiraFilter', e.target.value)} className={selectClass}>
                      <option value="">Todas</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">CPF</label>
                  <input type="text" placeholder="Buscar por CPF..." value={filters.advSearch.cpf} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, cpf: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">CNPJ</label>
                  <input type="text" placeholder="Buscar por CNPJ..." value={filters.advSearch.cnpj} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, cnpj: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Telefone</label>
                  <input type="text" placeholder="Buscar por telefone..." value={filters.advSearch.telefone} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, telefone: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Empresa</label>
                  <input type="text" placeholder="Buscar por empresa..." value={filters.advSearch.empresa} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, empresa: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Cidade</label>
                  <input type="text" placeholder="Buscar por cidade..." value={filters.advSearch.cidade} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, cidade: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">WhatsApp</label>
                  <input type="text" placeholder="Buscar por WhatsApp..." value={filters.advSearch.whatsapp} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, whatsapp: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Referencia</label>
                  <input type="text" placeholder="Buscar por referencia..." value={filters.advSearch.referencia} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, referencia: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Contato</label>
                  <input type="text" placeholder="Buscar por contato..." value={filters.advSearch.contato_nome} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, contato_nome: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Cargo</label>
                  <input type="text" placeholder="Buscar por cargo..." value={filters.advSearch.cargo} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, cargo: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-300/50 uppercase tracking-wider mb-1.5">Produtos</label>
                  <input type="text" placeholder="Buscar por produtos..." value={filters.advSearch.produtos_fornecidos} onChange={(e) => onFilterChange('advSearch', { ...filters.advSearch, produtos_fornecidos: e.target.value })} className={inputClass} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

/** Active filter chips that show inline in header */
export function FilterChips({ filters, onFilterChange, userMap, events }: { filters: FilterState; onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void; userMap: Record<string, UserInfo>; events?: EventOption[] }) {
  const chips: { label: string; onRemove: () => void }[] = [];

  if (filters.tipoFilter) chips.push({ label: `Tipo: ${filters.tipoFilter === 'FORNECEDOR' ? 'Fornecedor' : filters.tipoFilter === 'COMPRADOR' ? 'Comprador' : 'Ambos'}`, onRemove: () => onFilterChange('tipoFilter', '' as '' | ContactType) });
  if (filters.responsavelFilter) {
    const name = filters.responsavelFilter === '_none' ? 'Sem resp.' : (userMap[filters.responsavelFilter]?.name || 'Desconhecido');
    chips.push({ label: `Resp: ${name}`, onRemove: () => onFilterChange('responsavelFilter', '') });
  }
  if (filters.temperaturaFilter) chips.push({ label: `Temp: ${TEMPERATURA_LABELS[filters.temperaturaFilter as keyof typeof TEMPERATURA_LABELS] || filters.temperaturaFilter}`, onRemove: () => onFilterChange('temperaturaFilter', '') });
  if (filters.origemFilter) chips.push({ label: `Origem: ${ORIGEM_LABELS[filters.origemFilter as keyof typeof ORIGEM_LABELS] || filters.origemFilter}`, onRemove: () => onFilterChange('origemFilter', '') });
  if (filters.classeFilter) chips.push({ label: `Classe: ${filters.classeFilter}`, onRemove: () => onFilterChange('classeFilter', '') });
  if (filters.estadoFilter) chips.push({ label: `Estado: ${filters.estadoFilter}`, onRemove: () => onFilterChange('estadoFilter', '') });
  if (filters.proximaAcaoFilter) chips.push({ label: `Acao: ${PROXIMA_ACAO_LABELS[filters.proximaAcaoFilter as keyof typeof PROXIMA_ACAO_LABELS] || filters.proximaAcaoFilter}`, onRemove: () => onFilterChange('proximaAcaoFilter', '') });
  if (filters.feiraFilter) {
    const ev = (events || []).find((e) => e.id === filters.feiraFilter);
    chips.push({ label: `Feira: ${ev?.name || 'Desconhecida'}`, onRemove: () => onFilterChange('feiraFilter', '') });
  }

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
