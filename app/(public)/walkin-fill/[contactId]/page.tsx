'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// Pagina publica usada pelo cliente na feira — abre via QR code mostrado na
// tela do vendedor. O cliente preenche os proprios dados que caem direto no
// rascunho que o vendedor tem aberto.
export default function WalkInFillPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    company: '',
    cargo: '',
    phone: '',
    email: '',
  });
  const [seller, setSeller] = useState<{ name: string; avatar_url: string | null } | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/walkin-fill/${contactId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setLoadError(data.error || 'Nao foi possivel abrir o cadastro');
          return;
        }
        const data = await res.json();
        setForm({
          name: data.name || '',
          company: data.company || '',
          cargo: data.cargo || '',
          phone: data.phone || '',
          email: data.email || '',
        });
        setSeller(data.seller || null);
        setEventName(data.event_name || null);
      } catch {
        setLoadError('Erro de conexao');
      } finally {
        setLoading(false);
      }
    })();
  }, [contactId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.name.trim().length < 2) {
      alert('Digite seu nome');
      return;
    }
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      alert('Digite seu telefone com DDD (min 10 digitos)');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/walkin-fill/${contactId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erro ao enviar dados');
        return;
      }
      setSubmitted(true);
    } catch {
      alert('Sem conexao. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-4 py-4 text-base border rounded-xl bg-[#2a1245] text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-500 border-purple-700/30';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-purple-300/60">Carregando...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-[#1e0f35] rounded-2xl border border-red-500/30 p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500/15 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-white font-bold text-lg mb-1">Ops</h1>
          <p className="text-purple-200/70 text-sm">{loadError}</p>
          <p className="text-purple-300/40 text-xs mt-3">
            Peca ao vendedor pra gerar um novo QR code.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-[#1e0f35] rounded-2xl border border-emerald-500/30 p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-white font-bold text-xl mb-2">Obrigado!</h1>
          <p className="text-purple-200/70 text-sm">
            Seus dados foram recebidos. O vendedor vai continuar daqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center p-4 py-8">
      <div className="max-w-md w-full space-y-4">
        {/* Bloco do vendedor — da confianca pro cliente de que sabe pra quem
            esta preenchendo os dados. */}
        {seller && (
          <div className="bg-[#1e0f35] rounded-2xl border border-cyan-500/30 p-4 flex items-center gap-3">
            {seller.avatar_url ? (
              <img
                src={seller.avatar_url}
                alt={seller.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-cyan-400/40"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-cyan-500/15 border-2 border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold text-xl">
                {seller.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-cyan-300/60 font-bold">
                Voce esta cadastrando com
              </div>
              <div className="text-white font-bold text-base truncate">{seller.name}</div>
              {eventName && (
                <div className="text-xs text-purple-300/60 truncate">{eventName}</div>
              )}
            </div>
          </div>
        )}

        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Preencha seus dados</h1>
          <p className="text-purple-300/60 text-sm mt-1">
            Seu contato vai direto pro vendedor acima.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 bg-[#1e0f35] rounded-2xl border border-purple-800/30 p-5">
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-1">Nome *</label>
            <input
              type="text"
              required
              placeholder="Seu nome completo"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-1">Empresa</label>
            <input
              type="text"
              placeholder="Nome da empresa"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-1">Cargo</label>
            <input
              type="text"
              placeholder="Seu cargo"
              value={form.cargo}
              onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-1">Telefone / WhatsApp *</label>
            <input
              type="tel"
              inputMode="tel"
              required
              placeholder="(11) 99999-9999"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-1">E-mail</label>
            <input
              type="email"
              inputMode="email"
              placeholder="seuemail@exemplo.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 min-h-[56px] bg-cyan-500 text-white rounded-xl font-bold text-base hover:bg-cyan-600 disabled:opacity-50 transition-all shadow-lg shadow-cyan-900/30"
          >
            {submitting ? 'Enviando...' : 'Enviar meus dados'}
          </button>
        </form>
      </div>
    </div>
  );
}
