'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Script from 'next/script';

interface LinkInfo {
  label: string | null;
  user_name: string;
  pipeline_name: string;
}

interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
}

interface GoogleJwtPayload {
  name?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

function decodeJwtPayload(token: string): GoogleJwtPayload {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
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
  const [socialFilled, setSocialFilled] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const appleClientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
  const appleRedirectUri = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI;

  // Google Sign-In callback
  const handleGoogleResponse = useCallback((response: GoogleCredentialResponse) => {
    try {
      const payload = decodeJwtPayload(response.credential);
      if (payload.name) setName(payload.name);
      if (payload.email) setEmail(payload.email);
      setSocialFilled(true);
      setTimeout(() => phoneInputRef.current?.focus(), 100);
    } catch {
      setFieldErrors((prev) => ({ ...prev, form: 'Erro ao processar login Google. Preencha manualmente.' }));
    }
  }, []);

  // Initialize Google button when script loads
  const handleGoogleScriptLoad = useCallback(() => {
    if (!googleClientId || !googleButtonRef.current) return;
    const google = (window as unknown as Record<string, unknown>).google as {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
        };
      };
    };
    if (!google?.accounts?.id) return;
    google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleResponse,
      auto_select: false,
    });
    google.accounts.id.renderButton(googleButtonRef.current, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 320,
      locale: 'pt-BR',
    });
  }, [googleClientId, handleGoogleResponse]);

  // Apple Sign-In handler
  const handleAppleSignIn = async () => {
    try {
      const AppleID = (window as unknown as Record<string, unknown>).AppleID as {
        auth: {
          init: (config: Record<string, unknown>) => void;
          signIn: () => Promise<{
            authorization: { id_token: string };
            user?: { name?: { firstName?: string; lastName?: string }; email?: string };
          }>;
        };
      };
      if (!AppleID?.auth) return;
      AppleID.auth.init({
        clientId: appleClientId,
        scope: 'name email',
        redirectURI: appleRedirectUri,
        usePopup: true,
      });
      const response = await AppleID.auth.signIn();
      if (response.user) {
        const firstName = response.user.name?.firstName || '';
        const lastName = response.user.name?.lastName || '';
        if (firstName || lastName) setName(`${firstName} ${lastName}`.trim());
        if (response.user.email) setEmail(response.user.email);
      } else if (response.authorization?.id_token) {
        const payload = decodeJwtPayload(response.authorization.id_token);
        if (payload.email) setEmail(payload.email);
      }
      setSocialFilled(true);
      setTimeout(() => phoneInputRef.current?.focus(), 100);
    } catch {
      setFieldErrors((prev) => ({ ...prev, form: 'Erro ao processar login Apple. Preencha manualmente.' }));
    }
  };

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
      {/* Google Identity Services */}
      {googleClientId && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={handleGoogleScriptLoad}
        />
      )}
      {/* Apple Sign In */}
      {appleClientId && (
        <Script
          src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
          strategy="afterInteractive"
        />
      )}

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
        {/* Social Login - Quick Fill */}
        {(googleClientId || appleClientId) && !socialFilled && (
          <div className="mb-5">
            <p className="text-sm text-purple-300/60 mb-3 text-center">
              Preencha rapido com sua conta
            </p>
            <div className="space-y-2.5">
              {/* Google Button - rendered by Google SDK */}
              {googleClientId && (
                <div className="flex justify-center">
                  <div ref={googleButtonRef} />
                </div>
              )}

              {/* Apple Button */}
              {appleClientId && (
                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-white text-black text-sm font-medium rounded-full hover:bg-neutral-100 transition-colors active:scale-[0.98]"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  Continuar com Apple
                </button>
              )}
            </div>

            {/* Separator */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-purple-700/30" />
              <span className="text-xs text-purple-300/40">ou preencha manualmente</span>
              <div className="flex-1 h-px bg-purple-700/30" />
            </div>
          </div>
        )}

        {socialFilled && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm border border-emerald-500/20 text-center">
            Dados preenchidos! Confira e adicione seu telefone.
          </div>
        )}

        {!socialFilled && !(googleClientId || appleClientId) && (
          <p className="text-sm text-purple-300/60 mb-5 text-center">
            Preencha seus dados para que possamos entrar em contato.
          </p>
        )}

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
              ref={phoneInputRef}
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
