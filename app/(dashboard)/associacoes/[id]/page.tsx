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
  last_interaction?: { type: string; at: string } | null;
};

type Stats = {
  total_contacts: number;
  by_temperatura: Record<string, number>;
  by_status: Record<string, number>;
  recent_7d: number;
  contatos_com_interacao?: number;
  contatos_sem_interacao?: number;
};

type Tab = 'dashboard' | 'contatos';
type ContactFilter = 'todos' | 'falei' | 'nunca';

const TEMP_COLORS: Record<string, string> = {
  QUENTE: 'bg-red-500/20 text-red-300',
  MORNO: 'bg-amber-500/20 text-amber-300',
  FRIO: 'bg-blue-500/20 text-blue-300',
};

const INTERACTION_LABELS: Record<string, string> = {
  LIGACAO: 'Ligação',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  REUNIAO: 'Reunião',
  PROPOSTA_ENVIADA: 'Proposta enviada',
  ANOTACAO: 'Anotação',
  OUTRO: 'Outro',
};

function InteractionIcon({ type }: { type: string }) {
  const common = 'w-3.5 h-3.5 shrink-0';
  switch (type) {
    case 'WHATSAPP':
      return (
        <svg className={common} fill="currentColor" viewBox="0 0 24 24"><path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.46 0 .12 5.34.12 11.92c0 2.1.55 4.15 1.6 5.96L0 24l6.28-1.65a11.9 11.9 0 0 0 5.76 1.47h.01c6.58 0 11.92-5.34 11.92-11.92 0-3.18-1.24-6.17-3.45-8.42zM12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.73.98 1-3.64-.24-.37a9.87 9.87 0 0 1-1.51-5.26c0-5.46 4.44-9.9 9.9-9.9 2.64 0 5.13 1.03 7 2.9a9.85 9.85 0 0 1 2.9 7c0 5.46-4.44 9.9-9.92 9.88z"/></svg>
      );
    case 'LIGACAO':
      return (
        <svg className={common} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.28a1 1 0 01.95.68l1.2 3.59a1 1 0 01-.5 1.2l-1.7.85a11 11 0 005.4 5.4l.85-1.7a1 1 0 011.2-.5l3.6 1.2a1 1 0 01.67.95V19a2 2 0 01-2 2A16 16 0 013 5z"/></svg>
      );
    case 'EMAIL':
      return (
        <svg className={common} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
      );
    case 'REUNIAO':
      return (
        <svg className={common} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6 .87a4 4 0 110-8 4 4 0 010 8zm6-4a3 3 0 100-6 3 3 0 000 6zM7 14a3 3 0 100-6 3 3 0 000 6z"/></svg>
      );
    case 'PROPOSTA_ENVIADA':
      return (
        <svg className={common} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/></svg>
      );
    case 'ANOTACAO':
      return (
        <svg className={common} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.6a2 2 0 112.8 2.8L12 15l-4 1 1-4 8.6-8.6z"/></svg>
      );
    default:
      return (
        <svg className={common} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      );
  }
}

function formatRelativeDays(at: string): string {
  const then = new Date(at).getTime();
  if (isNaN(then)) return '';
  const now = Date.now();
  const diffMs = now - then;
  const day = 86400000;
  const days = Math.floor(diffMs / day);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days}d`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'há 1 mês';
  if (months < 12) return `há ${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? 'há 1 ano' : `há ${years} anos`;
}

function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '');
}

export default function AssociacaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [association, setAssociation] = useState<Association | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [search, setSearch] = useState('');
  const [contactFilter, setContactFilter] = useState<ContactFilter>('todos');

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

  const sortedContacts = useMemo(() => {
    const withInt: Contact[] = [];
    const withoutInt: Contact[] = [];
    for (const c of contacts) {
      if (c.last_interaction && c.last_interaction.at) withInt.push(c);
      else withoutInt.push(c);
    }
    withInt.sort((a, b) => new Date(b.last_interaction!.at).getTime() - new Date(a.last_interaction!.at).getTime());
    withoutInt.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return [...withInt, ...withoutInt];
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    let list = sortedContacts;
    if (contactFilter === 'falei') list = list.filter((c) => c.last_interaction && c.last_interaction.at);
    else if (contactFilter === 'nunca') list = list.filter((c) => !c.last_interaction || !c.last_interaction.at);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [sortedContacts, contactFilter, search]);

  const countFalei = useMemo(() => contacts.filter((c) => c.last_interaction && c.last_interaction.at).length, [contacts]);
  const countNunca = contacts.length - countFalei;

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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300/50 mb-1">Total contatos</div>
                <div className="text-3xl font-bold text-white">{stats.total_contacts}</div>
              </div>
              <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300/50 mb-1">Ativos (7d)</div>
                <div className="text-3xl font-bold text-emerald-400">{stats.recent_7d}</div>
              </div>
              <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300/50 mb-1">Já contatei</div>
                <div className="text-3xl font-bold text-green-400">{stats.contatos_com_interacao ?? countFalei}</div>
              </div>
              <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300/50 mb-1">Nunca falei</div>
                <div className="text-3xl font-bold text-amber-400">{stats.contatos_sem_interacao ?? countNunca}</div>
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
            className="w-full px-4 py-2.5 mb-3 bg-[#2a1245] border border-purple-800/30 rounded-lg text-white placeholder-purple-300/40 focus:outline-none focus:border-emerald-500/50 text-sm"
          />

          {/* Filter toggle */}
          <div className="flex gap-1 mb-4 bg-[#1e0f35] p-1 rounded-lg w-full sm:w-fit">
            {([
              { key: 'todos', label: `Todos (${contacts.length})` },
              { key: 'falei', label: `Já falei (${countFalei})` },
              { key: 'nunca', label: `Nunca falei (${countNunca})` },
            ] as { key: ContactFilter; label: string }[]).map((f) => (
              <button
                key={f.key}
                onClick={() => setContactFilter(f.key)}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-md text-xs font-medium transition-all ${
                  contactFilter === f.key ? 'bg-emerald-500/20 text-emerald-400' : 'text-purple-300/60 hover:text-purple-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredContacts.length === 0 ? (
            <div className="text-center py-16 text-purple-200/50">
              {contacts.length === 0 ? 'Nenhum contato ligado a essa associação ainda.' : 'Nenhum resultado.'}
            </div>
          ) : (
            <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl overflow-hidden">
              <div className="divide-y divide-purple-800/20">
                {filteredContacts.map((c) => {
                  const phoneDigits = onlyDigits(c.phone);
                  const hasPhone = phoneDigits.length >= 8;
                  const waNumber = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
                  const li = c.last_interaction;
                  const intLabel = li ? INTERACTION_LABELS[li.type] || 'Interação' : null;
                  return (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 hover:bg-purple-500/5 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
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
                        <div className="mt-1 flex items-center gap-1.5 text-xs">
                          {li ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-300/90">
                              <InteractionIcon type={li.type} />
                              <span>{intLabel} {formatRelativeDays(li.at)}</span>
                            </span>
                          ) : (
                            <span className="text-amber-400/90">Nunca contatado</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {hasPhone && (
                          <a
                            href={`https://wa.me/${waNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center min-w-[40px] h-10 px-3 rounded-lg bg-green-500/15 text-green-300 hover:bg-green-500/25 border border-green-500/30"
                            title="Abrir WhatsApp"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.46 0 .12 5.34.12 11.92c0 2.1.55 4.15 1.6 5.96L0 24l6.28-1.65a11.9 11.9 0 0 0 5.76 1.47h.01c6.58 0 11.92-5.34 11.92-11.92 0-3.18-1.24-6.17-3.45-8.42zM12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.73.98 1-3.64-.24-.37a9.87 9.87 0 0 1-1.51-5.26c0-5.46 4.44-9.9 9.9-9.9 2.64 0 5.13 1.03 7 2.9a9.85 9.85 0 0 1 2.9 7c0 5.46-4.44 9.9-9.92 9.88z"/></svg>
                          </a>
                        )}
                        {hasPhone && (
                          <a
                            href={`tel:${phoneDigits}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center min-w-[40px] h-10 px-3 rounded-lg bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/30"
                            title="Ligar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.28a1 1 0 01.95.68l1.2 3.59a1 1 0 01-.5 1.2l-1.7.85a11 11 0 005.4 5.4l.85-1.7a1 1 0 011.2-.5l3.6 1.2a1 1 0 01.67.95V19a2 2 0 01-2 2A16 16 0 013 5z"/></svg>
                          </a>
                        )}
                        <Link
                          href={`/contacts/${c.id}`}
                          className="inline-flex items-center justify-center min-w-[40px] h-10 px-3 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold"
                          title="Abrir contato"
                        >
                          Abrir
                        </Link>
                      </div>
                    </div>
                  );
                })}
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
