'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/lib/toast-context';

interface DuplicateContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  company: string | null;
  status: string;
  created_at: string;
  assigned_to_user_id: string | null;
}

interface DuplicateGroup {
  key: string;
  field: string;
  label: string;
  contacts: DuplicateContact[];
}

export default function DuplicatesPage() {
  const router = useRouter();
  const toast = useToast();
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [totalDuplicates, setTotalDuplicates] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>('');
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentRole(data.role || 'user');
        if (data.role !== 'admin') {
          router.push('/dashboard');
          return;
        }
      } else {
        router.push('/dashboard');
        return;
      }
    } catch {
      router.push('/dashboard');
      return;
    }
    setCheckingRole(false);
    loadDuplicates();
  };

  const loadDuplicates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/contacts/duplicates');
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
        setTotalDuplicates(data.totalDuplicates || 0);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao carregar duplicados');
      }
    } catch {
      toast.error('Erro ao carregar duplicados');
    }
    setLoading(false);
  };

  const handleDelete = async (contactId: string, contactName: string) => {
    if (!confirm(`Tem certeza que deseja deletar "${contactName}"? Esta acao e irreversivel.`)) return;

    setDeleting(contactId);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`"${contactName}" deletado`);
        // Remove from local state
        setGroups((prev) => {
          const updated = prev.map((g) => ({
            ...g,
            contacts: g.contacts.filter((c) => c.id !== contactId),
          })).filter((g) => g.contacts.length > 1);
          return updated;
        });
        setTotalDuplicates((prev) => prev - 1);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao deletar');
      }
    } catch {
      toast.error('Erro ao deletar contato');
    }
    setDeleting(null);
  };

  if (checkingRole) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (currentRole !== 'admin') return null;

  const fieldColors: Record<string, string> = {
    cpf: 'bg-red-500/15 text-red-400 border-red-500/20',
    cnpj: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    phone: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-sm text-emerald-400/70 hover:text-emerald-400 transition-colors">&larr; Admin</Link>
          </div>
          <h1 className="text-xl font-bold text-emerald-400">Contatos Duplicados</h1>
          <p className="text-sm text-purple-300/60 mt-1">
            {totalDuplicates > 0
              ? `${totalDuplicates} duplicado${totalDuplicates > 1 ? 's' : ''} encontrado${totalDuplicates > 1 ? 's' : ''} em ${groups.length} grupo${groups.length > 1 ? 's' : ''}`
              : 'Nenhum duplicado encontrado'}
          </p>
        </div>
        <button
          onClick={loadDuplicates}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
        >
          {loading ? 'Buscando...' : 'Recarregar'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-purple-800/30 rounded w-40 mb-4" />
              <div className="h-16 bg-purple-800/20 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* No duplicates */}
      {!loading && groups.length === 0 && (
        <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl text-center py-16">
          <svg className="mx-auto w-12 h-12 text-emerald-500/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-emerald-400 mt-3 font-medium">Nenhum duplicado encontrado!</p>
          <p className="text-xs text-purple-300/40 mt-1">Todos os contatos sao unicos</p>
        </div>
      )}

      {/* Duplicate groups */}
      {!loading && groups.map((group) => (
        <div key={group.key} className="bg-[#1e0f35] border border-purple-800/30 rounded-xl overflow-hidden">
          {/* Group header */}
          <div className="px-5 py-3 border-b border-purple-800/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${fieldColors[group.field] || 'bg-purple-500/15 text-purple-400'}`}>
                {group.field}
              </span>
              <span className="text-sm font-medium text-neutral-200">{group.label}</span>
            </div>
            <span className="text-xs text-purple-300/40">{group.contacts.length} contatos</span>
          </div>

          {/* Contacts in group */}
          <div className="divide-y divide-purple-800/20">
            {group.contacts.map((contact, idx) => (
              <div key={contact.id} className="px-5 py-3 flex items-center gap-4 hover:bg-purple-800/10 transition-colors">
                {/* Index badge */}
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                  idx === 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {idx === 0 ? '1' : idx + 1}
                </span>

                {/* Contact info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/contacts/${contact.id}`} className="text-sm font-medium text-white hover:text-emerald-400 transition-colors truncate">
                      {contact.name}
                    </Link>
                    {idx === 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">Mais antigo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-purple-300/50">
                    {contact.company && <span>{contact.company}</span>}
                    {contact.email && <span>{contact.email}</span>}
                    {contact.phone && <span>{contact.phone}</span>}
                    <span>{new Date(contact.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                {/* Status */}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-800/30 text-purple-300/60 shrink-0">
                  {contact.status}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="px-2.5 py-1 text-[11px] font-medium text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10 transition-colors"
                  >
                    Ver
                  </Link>
                  {idx > 0 && (
                    <button
                      onClick={() => handleDelete(contact.id, contact.name)}
                      disabled={deleting === contact.id}
                      className="px-2.5 py-1 text-[11px] font-medium text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                    >
                      {deleting === contact.id ? '...' : 'Remover'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
