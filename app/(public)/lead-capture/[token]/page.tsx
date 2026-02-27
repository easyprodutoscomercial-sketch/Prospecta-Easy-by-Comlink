'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface LinkInfo {
  label: string | null;
  user_name: string;
  pipeline_name: string;
}

export default function LeadCapturePage() {
  const params = useParams();
  const token = params.token as string;

  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inactive, setInactive] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [cargo, setCargo] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch(`/api/lead-capture?token=${token}`);
        const data = await res.json();

        if (res.status === 410) {
          setInactive(true);
          return;
        }

        if (!res.ok) {
          setError(data.error || 'Link invalido');
          return;
        }

        setLinkInfo(data);
      } catch {
        setError('Erro ao carregar formulario');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchInfo();
  }, [token]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhone(value));
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errors.name = 'Nome e obrigatorio';
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) errors.phone = 'Telefone invalido';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email invalido';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/lead-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          company: company.trim() || undefined,
          cargo: cargo.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok || data.success) {
        setSubmitted(true);
        setSubmitMessage(data.message || 'Dados registrados com sucesso!');
      } else {
        setFieldErrors({ form: data.error || 'Erro ao enviar dados' });
      }
    } catch {
      setFieldErrors({ form: 'Erro de conexao. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#120826] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-800/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Inactive link
  if (inactive) {
    return (
      <div className="min-h-screen bg-[#120826] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/15 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-neutral-100 mb-2">Link Desativado</h1>
          <p className="text-sm text-purple-300/60">Este formulario de cadastro foi desativado pelo vendedor.</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#120826] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/15 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-neutral-100 mb-2">Link Invalido</h1>
          <p className="text-sm text-purple-300/60">{error}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#120826] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-100 mb-3">Obrigado!</h1>
          <p className="text-sm text-purple-300/70 leading-relaxed">{submitMessage}</p>
          {linkInfo?.user_name && (
            <p className="text-xs text-purple-300/50 mt-4">
              {linkInfo.user_name} recebera seus dados.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Form
  return (
    <div className="min-h-screen bg-[#120826] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-5 text-center">
        <h1 className="text-lg font-bold text-white">
          {linkInfo?.label || 'Cadastro Rapido'}
        </h1>
        {linkInfo?.user_name && (
          <p className="text-sm text-emerald-100/80 mt-1">
            Atendimento: {linkInfo.user_name}
          </p>
        )}
      </div>

      {/* Form */}
      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        <p className="text-sm text-purple-300/60 mb-5 text-center">
          Preencha seus dados para que possamos entrar em contato.
        </p>

        {fieldErrors.form && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/15 text-red-400 text-sm border border-red-500/20">
            {fieldErrors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1.5">
              Nome Completo <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
              className={`w-full px-3.5 py-3 text-sm bg-[#1e0f35] border rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                fieldErrors.name ? 'border-red-500/50' : 'border-purple-700/30'
              }`}
            />
            {fieldErrors.name && (
              <p className="text-xs text-red-400 mt-1">{fieldErrors.name}</p>
            )}
          </div>

          {/* Telefone/WhatsApp */}
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1.5">
              Telefone / WhatsApp <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(00) 00000-0000"
              autoComplete="tel"
              inputMode="numeric"
              className={`w-full px-3.5 py-3 text-sm bg-[#1e0f35] border rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                fieldErrors.phone ? 'border-red-500/50' : 'border-purple-700/30'
              }`}
            />
            {fieldErrors.phone && (
              <p className="text-xs text-red-400 mt-1">{fieldErrors.phone}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              inputMode="email"
              className={`w-full px-3.5 py-3 text-sm bg-[#1e0f35] border rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                fieldErrors.email ? 'border-red-500/50' : 'border-purple-700/30'
              }`}
            />
            {fieldErrors.email && (
              <p className="text-xs text-red-400 mt-1">{fieldErrors.email}</p>
            )}
          </div>

          {/* Empresa */}
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1.5">
              Empresa
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Nome da empresa"
              autoComplete="organization"
              className="w-full px-3.5 py-3 text-sm bg-[#1e0f35] border border-purple-700/30 rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Cargo */}
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1.5">
              Cargo
            </label>
            <input
              type="text"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Seu cargo"
              autoComplete="organization-title"
              className="w-full px-3.5 py-3 text-sm bg-[#1e0f35] border border-purple-700/30 rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Observacoes */}
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1.5">
              Observacoes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alguma observacao ou interesse especifico?"
              rows={3}
              className="w-full px-3.5 py-3 text-sm bg-[#1e0f35] border border-purple-700/30 rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 disabled:opacity-50 transition-colors active:scale-[0.98]"
          >
            {submitting ? 'Enviando...' : 'Enviar Dados'}
          </button>

          <p className="text-[10px] text-purple-300/40 text-center leading-relaxed">
            Ao enviar, voce autoriza o contato comercial por telefone, WhatsApp ou email.
          </p>
        </form>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 text-center border-t border-purple-800/20">
        <p className="text-[10px] text-purple-300/30">
          Powered by Controlei
        </p>
      </div>
    </div>
  );
}
