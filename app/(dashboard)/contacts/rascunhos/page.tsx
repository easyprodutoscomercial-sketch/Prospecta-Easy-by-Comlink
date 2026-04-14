'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DraftContact {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  cargo: string | null;
  event_id: string | null;
  updated_at: string;
  created_at: string;
  created_by_user_id: string | null;
  event?: { id: string; name: string; cover_image_url?: string | null } | null;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `ha ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `ha ${h}h`;
  const d = Math.floor(h / 24);
  return `ha ${d} dia${d > 1 ? 's' : ''}`;
}

export default function RascunhosPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/contacts?drafts=true&limit=500');
      if (!res.ok) return;
      const data = await res.json();
      setDrafts(data.contacts || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleContinue = (draft: DraftContact) => {
    if (draft.event_id) {
      // Abre o evento com o query param pra auto-abrir o walk-in form daquele draft
      router.push(`/eventos/${draft.event_id}?resumeDraft=${draft.id}`);
    } else {
      // Rascunho sem evento: abre a pagina de edicao normal do contato
      router.push(`/contacts/${draft.id}`);
    }
  };

  const handleDiscard = async (draft: DraftContact) => {
    if (deletingId === draft.id) return;
    if (!confirm(`Descartar este rascunho? (${draft.name !== '(rascunho)' ? draft.name : 'sem nome'})`)) {
      return;
    }
    setDeletingId(draft.id);
    // Remove otimisticamente — click duplo ou 404 "ja deletado" nao volta o item.
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    try {
      const res = await fetch(`/api/contacts/${draft.id}`, { method: 'DELETE' });
      // 404 = contato ja nao existe (ex: ja deletado). Tratamos como sucesso.
      if (!res.ok && res.status !== 404) {
        alert('Erro ao descartar rascunho');
        await fetchDrafts();
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Rascunhos</h1>
          <p className="text-purple-300/50 text-sm mt-1">
            Contatos iniciados mas ainda nao finalizados. Volte em qualquer um pra continuar o cadastro.
          </p>
        </div>
        <Link
          href="/contacts"
          className="px-3 py-2 bg-purple-800/30 text-purple-200/80 border border-purple-700/30 rounded-lg text-xs font-medium hover:bg-purple-800/50 hover:text-white transition-colors"
        >
          Ver contatos finalizados
        </Link>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[#1e0f35] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-16 bg-[#1e0f35] rounded-xl border border-purple-800/30">
          <svg className="w-12 h-12 mx-auto text-purple-500/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-purple-300/50">Nenhum rascunho pendente</p>
          <p className="text-purple-300/30 text-xs mt-1">
            Quando voce iniciar um contato avulso numa feira e nao finalizar, ele aparece aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => {
            const hasRealName = draft.name && draft.name !== '(rascunho)';
            return (
              <div
                key={draft.id}
                className="bg-[#1e0f35] rounded-xl border border-amber-500/20 p-4 flex items-start gap-4 hover:border-amber-500/40 transition-colors"
              >
                <div className="shrink-0 w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold truncate">
                      {hasRealName ? draft.name : '(sem nome ainda)'}
                    </span>
                    {draft.event && (
                      <Link
                        href={`/eventos/${draft.event.id}`}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors"
                      >
                        {draft.event.name}
                      </Link>
                    )}
                  </div>
                  <div className="text-xs text-purple-300/60 mt-0.5 flex flex-wrap gap-3">
                    {draft.company && <span>{draft.company}</span>}
                    {draft.phone && <span>{draft.phone}</span>}
                    {draft.email && <span className="truncate max-w-[200px]">{draft.email}</span>}
                  </div>
                  <div className="text-[10px] text-amber-300/50 mt-1">
                    Atualizado {formatRelative(draft.updated_at || draft.created_at)}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => handleContinue(draft)}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Continuar
                  </button>
                  <button
                    onClick={() => handleDiscard(draft)}
                    disabled={deletingId === draft.id}
                    className="p-2 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Descartar rascunho"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
