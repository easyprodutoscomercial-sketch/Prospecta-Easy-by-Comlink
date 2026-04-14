'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

type Association = {
  id: string;
  sigla: string;
  nome_completo: string;
  presidente: string | null;
  telefone: string | null;
  email: string | null;
  website: string | null;
  cidade: string | null;
  estado: string | null;
  endereco: string | null;
  cep: string | null;
  grupo: string | null;
  notas: string | null;
};

export default function AssociacoesPage() {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('ALL');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/associations');
        if (res.ok) {
          const data = await res.json();
          setAssociations(data.associations || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const estados = useMemo(() => {
    const set = new Set<string>();
    associations.forEach((a) => { if (a.estado) set.add(a.estado); });
    return Array.from(set).sort();
  }, [associations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return associations.filter((a) => {
      if (estadoFilter !== 'ALL' && a.estado !== estadoFilter) return false;
      if (!q) return true;
      return (
        a.sigla.toLowerCase().includes(q) ||
        a.nome_completo.toLowerCase().includes(q) ||
        (a.cidade || '').toLowerCase().includes(q) ||
        (a.presidente || '').toLowerCase().includes(q)
      );
    });
  }, [associations, search, estadoFilter]);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Associações</h1>
        <p className="text-sm text-purple-200/60">
          {associations.length > 0
            ? `${associations.length} associações cadastradas — grupos de fornecedores de cana (ORPLANA)`
            : 'Nenhuma associação cadastrada ainda'}
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por sigla, nome, cidade ou presidente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[260px] px-4 py-2.5 bg-[#2a1245] border border-purple-800/30 rounded-lg text-white placeholder-purple-300/40 focus:outline-none focus:border-emerald-500/50 text-sm"
        />
        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          className="px-4 py-2.5 bg-[#2a1245] border border-purple-800/30 rounded-lg text-white focus:outline-none focus:border-emerald-500/50 text-sm"
        >
          <option value="ALL">Todos os estados ({associations.length})</option>
          {estados.map((uf) => {
            const count = associations.filter((a) => a.estado === uf).length;
            return <option key={uf} value={uf}>{uf} ({count})</option>;
          })}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16 text-purple-200/50">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-purple-200/50">Nenhuma associação encontrada.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <Link
              key={a.id}
              href={`/associacoes/${a.id}`}
              className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5 hover:border-emerald-500/40 transition-colors block"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-emerald-400 truncate">{a.sigla}</h3>
                  <p className="text-xs text-purple-200/60 line-clamp-2 mt-0.5">{a.nome_completo}</p>
                </div>
                {a.estado && (
                  <span className="shrink-0 ml-2 px-2 py-0.5 text-[10px] font-bold bg-purple-800/40 text-purple-200 rounded">
                    {a.estado}
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs">
                {a.presidente && (
                  <div className="flex items-start gap-2 text-purple-200/80">
                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="truncate">{a.presidente}</span>
                  </div>
                )}
                {a.cidade && (
                  <div className="flex items-start gap-2 text-purple-200/80">
                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{a.cidade}{a.estado ? ` / ${a.estado}` : ''}</span>
                  </div>
                )}
                {a.telefone && (
                  <div className="flex items-start gap-2 text-purple-200/80">
                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <a href={`tel:${a.telefone.replace(/\D/g, '')}`} className="truncate hover:text-emerald-400">
                      {a.telefone}
                    </a>
                  </div>
                )}
                {a.email && (
                  <div className="flex items-start gap-2 text-purple-200/80">
                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <a href={`mailto:${a.email}`} className="truncate hover:text-emerald-400">{a.email}</a>
                  </div>
                )}
                {a.website && (
                  <div className="flex items-start gap-2 text-purple-200/80">
                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <a href={a.website} target="_blank" rel="noopener" className="truncate hover:text-emerald-400">
                      {a.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
              </div>

              {a.grupo && (
                <div className="mt-3 pt-3 border-t border-purple-800/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400/60">
                    Grupo: {a.grupo}
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
