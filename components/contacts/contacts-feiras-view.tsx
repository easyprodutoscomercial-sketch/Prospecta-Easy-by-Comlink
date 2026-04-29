'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { FairEvent, EventBooth } from '@/lib/types';

interface FeiraContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cargo: string | null;
  contato_nome: string | null;
  status: string;
  inexistente: boolean | null;
  company: string | null;
  event_id: string | null;
  created_at: string;
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

function extractCorredor(boothNumber: string | null): string {
  if (!boothNumber) return 'Sem corredor';
  const m = boothNumber.match(/^([A-Za-z]+)/);
  return m ? m[1].toUpperCase() : boothNumber;
}

export default function ContactsFeirasView() {
  const [events, setEvents] = useState<FairEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [booths, setBooths] = useState<EventBooth[]>([]);
  const [contacts, setContacts] = useState<FeiraContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBoothId, setExpandedBoothId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'visitado' | 'pendente' | 'captavel' | 'descartado'>('all');

  // Fetch eventos
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/events');
        if (res.ok) {
          const data = await res.json();
          const raw = Array.isArray(data) ? data : (data.events || []);
          // Ativos primeiro
          const sorted = [...raw].sort((a: any, b: any) => {
            if (a.status === 'ATIVO' && b.status !== 'ATIVO') return -1;
            if (b.status === 'ATIVO' && a.status !== 'ATIVO') return 1;
            return 0;
          });
          setEvents(sorted);
          const firstActive = sorted.find((e: any) => e.status === 'ATIVO') || sorted[0];
          if (firstActive) setSelectedEventId(firstActive.id);
        }
      } catch {
        // silent
      }
    })();
  }, []);

  // Fetch booths + contatos do evento selecionado
  const loadData = useCallback(async () => {
    if (!selectedEventId) return;
    setLoading(true);
    try {
      const [bRes, cRes] = await Promise.all([
        fetch(`/api/events/${selectedEventId}/booths`),
        // descartados=all: a view de Feiras tem filtro proprio (Captavel/Descartado)
        // entao precisa ver tudo pra ja exibir os descartados quando o user clica.
        fetch(`/api/contacts?event_id=${selectedEventId}&limit=500&descartados=all`),
      ]);
      if (bRes.ok) {
        const bData = await bRes.json();
        setBooths(bData.booths || []);
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setContacts(cData.contacts || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Indexar contatos por company_name (match com stand) OU por event_id (fallback).
  // Filtra contatos "shell" (placeholders sem dados reais) criados pelo botao
  // "criar contatos dos stands" — se nao tem phone, email, nem contato_nome, e
  // apenas um placeholder vinculado ao stand, nao aparece como contato separado.
  const contactsByBooth = useMemo(() => {
    const map: Record<string, FeiraContact[]> = {};
    const byCompany: Record<string, FeiraContact[]> = {};
    const realContacts = contacts.filter((c) => {
      return !!(c.phone?.trim() || c.email?.trim() || c.contato_nome?.trim());
    });
    for (const c of realContacts) {
      const key = (c.company || c.name || '').toLowerCase().trim();
      if (!byCompany[key]) byCompany[key] = [];
      byCompany[key].push(c);
    }
    for (const b of booths) {
      const key = (b.company_name || '').toLowerCase().trim();
      map[b.id] = byCompany[key] || [];
    }
    return map;
  }, [booths, contacts]);

  // Aplicar filtros ao nivel do stand (busca + status)
  const filteredBooths = useMemo(() => {
    const norm = search.trim().toLowerCase();
    return booths.filter((b) => {
      if (statusFilter === 'visitado' && b.status !== 'VISITADO') return false;
      if (statusFilter === 'pendente' && b.status === 'VISITADO') return false;
      if (statusFilter === 'captavel') {
        const list = contactsByBooth[b.id] || [];
        if (!list.some((c) => c.inexistente === false)) return false;
      }
      if (statusFilter === 'descartado') {
        const list = contactsByBooth[b.id] || [];
        if (!list.some((c) => c.inexistente === true)) return false;
      }
      if (norm) {
        const hay = `${b.company_name || ''} ${b.booth_number || ''} ${b.sector || ''}`.toLowerCase();
        if (!hay.includes(norm)) return false;
      }
      return true;
    });
  }, [booths, statusFilter, search, contactsByBooth]);

  // Agrupar por corredor
  const byCorredor = useMemo(() => {
    const map: Record<string, EventBooth[]> = {};
    for (const b of filteredBooths) {
      const k = extractCorredor(b.booth_number);
      if (!map[k]) map[k] = [];
      map[k].push(b);
    }
    Object.values(map).forEach((list) =>
      list.sort((a, b) => naturalCompare(a.booth_number || '', b.booth_number || ''))
    );
    return map;
  }, [filteredBooths]);

  const corredorKeys = Object.keys(byCorredor).sort((a, b) => naturalCompare(a, b));

  // Stats
  const totalStands = booths.length;
  const totalVisited = booths.filter((b) => b.status === 'VISITADO').length;
  const totalContatos = contacts.length;
  const totalCaptaveis = contacts.filter((c) => c.inexistente === false).length;
  const totalDescartados = contacts.filter((c) => c.inexistente === true).length;

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  if (events.length === 0) {
    return (
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-8 text-center">
        <p className="text-sm text-purple-300/60">Nenhum evento/feira cadastrado ainda.</p>
        <Link href="/eventos" className="mt-3 inline-block text-xs text-emerald-400 hover:underline">Criar evento em /eventos</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Event selector */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {events.slice(0, 10).map((e) => {
            const isActive = e.id === selectedEventId;
            const isCurrent = e.status === 'ATIVO';
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedEventId(e.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[#2a1245] text-purple-200 hover:bg-[#34165a]'
                }`}
              >
                {isCurrent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />}
                {e.name}
              </button>
            );
          })}
        </div>

        {selectedEvent && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-purple-800/30">
            <Stat label="Stands" value={totalStands} color="text-white" />
            <Stat label="Visitados" value={totalVisited} color="text-emerald-400" />
            <Stat label="Contatos" value={totalContatos} color="text-cyan-400" />
            <Stat label="Captáveis" value={totalCaptaveis} color="text-emerald-400" />
            <Stat label="Descartados" value={totalDescartados} color="text-red-400" />
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por empresa, stand ou setor..."
          className="flex-1 px-3 py-2 bg-[#2a1245] text-white text-sm rounded-lg border border-purple-700/40 focus:outline-none focus:border-emerald-500/60"
        />
        <div className="flex gap-1 bg-[#160b2e] rounded-lg p-0.5">
          {([
            { key: 'all', label: 'Todos' },
            { key: 'visitado', label: 'Visitados' },
            { key: 'pendente', label: 'Pendentes' },
            { key: 'captavel', label: 'Captáveis' },
            { key: 'descartado', label: 'Descartados' },
          ] as const).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                statusFilter === f.key
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista por corredor */}
      {loading ? (
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-8 text-center text-xs text-purple-300/60">
          Carregando stands...
        </div>
      ) : filteredBooths.length === 0 ? (
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-8 text-center text-xs text-purple-300/60">
          Nenhum stand encontrado com esses filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {corredorKeys.map((corredor) => {
            const list = byCorredor[corredor];
            return (
              <div key={corredor} className="border border-purple-800/30 rounded-lg bg-[#160a29] overflow-hidden">
                <div className="px-3 py-2 bg-[#2a1245]/40 border-b border-purple-800/30">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {corredor === 'Sem corredor' ? 'Sem numero' : `Corredor ${corredor}`}
                  </span>
                  <span className="ml-2 text-[10px] text-purple-300/60">{list.length} stands</span>
                </div>
                <div className="divide-y divide-purple-800/20">
                  {list.map((b) => {
                    const standContacts = contactsByBooth[b.id] || [];
                    const captaveis = standContacts.filter((c) => c.inexistente === false).length;
                    const descartados = standContacts.filter((c) => c.inexistente === true).length;
                    const expanded = expandedBoothId === b.id;
                    return (
                      <div key={b.id}>
                        <button
                          type="button"
                          onClick={() => setExpandedBoothId(expanded ? null : b.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#2a1245]/30 transition-colors text-left"
                        >
                          {/* Logo */}
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                            {b.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={b.logo_url} alt={b.company_name} className="max-w-full max-h-full object-contain" loading="lazy" />
                            ) : (
                              <span className="text-[9px] font-bold text-neutral-500 text-center px-1 leading-tight line-clamp-2">
                                {b.company_name.slice(0, 12)}
                              </span>
                            )}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white truncate">{b.company_name}</span>
                              {b.booth_number && (
                                <span className="text-[10px] font-mono bg-[#2a1245] text-purple-300 px-1.5 py-0.5 rounded">
                                  {b.booth_number}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                b.status === 'VISITADO'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-purple-500/20 text-purple-300'
                              }`}>
                                {b.status === 'VISITADO' ? 'VISITADO' : 'PENDENTE'}
                              </span>
                            </div>
                            <div className="text-[10px] text-purple-300/60 mt-0.5 flex items-center gap-3 flex-wrap">
                              {b.sector && <span>{b.sector}</span>}
                              <span>
                                <strong className="text-white">{standContacts.length}</strong> contato{standContacts.length !== 1 ? 's' : ''}
                              </span>
                              {captaveis > 0 && <span className="text-emerald-400">{captaveis} captável{captaveis !== 1 ? 'eis' : ''}</span>}
                              {descartados > 0 && <span className="text-red-400">{descartados} descartado{descartados !== 1 ? 's' : ''}</span>}
                            </div>
                          </div>
                          {/* Expand icon */}
                          <svg className={`w-4 h-4 text-purple-400/60 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {expanded && (
                          <div className="px-3 pb-3 bg-[#120826]">
                            {standContacts.length === 0 ? (
                              <div className="text-[11px] text-purple-300/50 italic py-2">
                                Nenhum contato capturado neste stand ainda.
                              </div>
                            ) : (
                              <div className="space-y-1.5 pt-2">
                                {standContacts.map((c) => (
                                  <Link
                                    key={c.id}
                                    href={`/contacts/${c.id}`}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
                                      c.inexistente === true
                                        ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                                        : c.inexistente === false
                                        ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                                        : 'bg-[#1e0f35] border-purple-800/30 hover:bg-[#2a1245]'
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`font-semibold ${c.inexistente === true ? 'line-through text-red-300/70' : 'text-white'}`}>
                                          {c.contato_nome || c.name}
                                        </span>
                                        {c.inexistente === true && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">DESCARTADO</span>
                                        )}
                                        {c.inexistente === false && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">CAPTÁVEL</span>
                                        )}
                                        {c.inexistente === null && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">NÃO AVALIADO</span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-purple-300/60 flex items-center gap-2 flex-wrap">
                                        {c.phone && <span>{c.phone}</span>}
                                        {c.email && <span className="truncate max-w-[200px]">{c.email}</span>}
                                        {c.cargo && <span>· {c.cargo}</span>}
                                      </div>
                                    </div>
                                    <svg className="w-3 h-3 text-purple-400/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </Link>
                                ))}
                              </div>
                            )}
                            <div className="mt-2 pt-2 border-t border-purple-800/20 flex gap-2">
                              <Link
                                href={`/eventos/${selectedEventId}?stand=${b.id}`}
                                className="text-[10px] text-emerald-400 hover:underline"
                              >
                                Abrir stand no evento →
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-purple-300/50 font-bold">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
