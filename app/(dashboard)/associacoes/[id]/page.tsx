'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
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

type Contact = {
  id: string;
  name: string;
  company: string | null;
  cargo: string | null;
  phone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  temperatura: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

type Stats = {
  total_contacts: number;
  by_temperatura: Record<string, number>;
  by_status: Record<string, number>;
  recent_7d: number;
};

type Tab = 'dashboard' | 'contatos';

const TEMP_COLORS: Record<string, string> = {
  QUENTE: 'bg-red-500/20 text-red-300',
  MORNO: 'bg-amber-500/20 text-amber-300',
  FRIO: 'bg-blue-500/20 text-blue-300',
};

export default function AssociacaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [association, setAssociation] = useState<Association | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/associations/${id}`);
        if (res.ok) {
          const data = await res.json();
          setAssociation(data.association);
          setContacts(data.contacts || []);
          setStats(data.stats);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [contacts, search]);

  if (loading) {
    return <div className="p-6 text-purple-200/50 text-center">Carregando...</div>;
  }

  if (!association) {
    return (
      <div className="p-6 text-center">
        <p className="text-purple-200/60 mb-4">Associação não encontrada.</p>
        <Link href="/associacoes" className="text-emerald-400 text-sm hover:underline">
          ← Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Voltar */}
      <Link href="/associacoes" className="inline-flex items-center gap-1 text-xs text-purple-300/60 hover:text-emerald-400 mb-4">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Todas as associações
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-emerald-400">{association.sigla}</h1>
            {association.estado && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-800/40 text-purple-200 rounded">
                {association.estado}
              </span>
            )}
            {association.grupo && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-800/30 text-emerald-300 rounded">
                {association.grupo}
              </span>
            )}
          </div>
          <p className="text-sm text-purple-200/70">{association.nome_completo}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#1e0f35] p-1 rounded-lg w-fit">
        {([
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'contatos', label: `Contatos${stats ? ` (${stats.total_contacts})` : ''}` },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t.key ? 'bg-emerald-500/20 text-emerald-400' : 'text-purple-300/60 hover:text-purple-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPIs */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300/50 mb-1">Total contatos</div>
                <div className="text-3xl font-bold text-white">{stats.total_contacts}</div>
              </div>
              <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300/50 mb-1">Ativos (7d)</div>
                <div className="text-3xl font-bold text-emerald-400">{stats.recent_7d}</div>
              </div>
              <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300/50 mb-1">Quentes</div>
                <div className="text-3xl font-bold text-red-400">{stats.by_temperatura.QUENTE || 0}</div>
              </div>
              <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300/50 mb-1">Mornos</div>
                <div className="text-3xl font-bold text-amber-400">{stats.by_temperatura.MORNO || 0}</div>
              </div>
            </div>
          )}

          {/* Dados da associação */}
          <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Dados da Associação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {association.presidente && <Field label="Presidente" value={association.presidente} />}
              {association.telefone && <Field label="Telefone" value={association.telefone} href={`tel:${association.telefone.replace(/\D/g, '')}`} />}
              {association.email && <Field label="Email" value={association.email} href={`mailto:${association.email}`} />}
              {association.website && <Field label="Website" value={association.website.replace(/^https?:\/\//, '')} href={association.website} external />}
              {association.cidade && <Field label="Cidade" value={`${association.cidade}${association.estado ? ' / ' + association.estado : ''}`} />}
              {association.cep && <Field label="CEP" value={association.cep} />}
              {association.endereco && <Field label="Endereço" value={association.endereco} full />}
            </div>
          </div>

          {/* Status distribution */}
          {stats && Object.keys(stats.by_status).length > 0 && (
            <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Contatos por status</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.by_status).map(([status, count]) => (
                  <div key={status} className="px-3 py-1.5 bg-[#2a1245] rounded-lg text-xs">
                    <span className="text-purple-300/60">{status}: </span>
                    <span className="text-emerald-400 font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'contatos' && (
        <div>
          <input
            type="text"
            placeholder="Buscar por nome, empresa, telefone ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 mb-4 bg-[#2a1245] border border-purple-800/30 rounded-lg text-white placeholder-purple-300/40 focus:outline-none focus:border-emerald-500/50 text-sm"
          />
          {filteredContacts.length === 0 ? (
            <div className="text-center py-16 text-purple-200/50">
              {contacts.length === 0 ? 'Nenhum contato ligado a essa associação ainda.' : 'Nenhum resultado.'}
            </div>
          ) : (
            <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl overflow-hidden">
              <div className="divide-y divide-purple-800/20">
                {filteredContacts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contacts/${c.id}`}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-purple-500/5 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-white font-semibold truncate">{c.name}</span>
                        {c.temperatura && (
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${TEMP_COLORS[c.temperatura] || 'bg-purple-500/20 text-purple-300'}`}>
                            {c.temperatura}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-purple-200/60 truncate">
                        {c.company || '—'}
                        {c.cargo ? ` • ${c.cargo}` : ''}
                        {c.cidade ? ` • ${c.cidade}${c.estado ? '/' + c.estado : ''}` : ''}
                      </div>
                    </div>
                    <div className="text-xs text-purple-300/50 shrink-0">
                      {c.phone || c.email || ''}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, href, external, full }: { label: string; value: string; href?: string; external?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300/50 mb-0.5">{label}</div>
      {href ? (
        <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined} className="text-white hover:text-emerald-400 break-words">
          {value}
        </a>
      ) : (
        <div className="text-white break-words">{value}</div>
      )}
    </div>
  );
}
