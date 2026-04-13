'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Script from 'next/script';

interface LinkInfo {
  label: string | null;
  user_name: string;
  user_avatar?: string | null;
  pipeline_name: string;
  whatsapp_vendedor?: string | null;
  booth?: { company_name: string; booth_number: string | null } | null;
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

function LeadCapturePageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const eventId = searchParams.get('event');
  const boothId = searchParams.get('booth');

  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [boothCompany, setBoothCompany] = useState<string | null>(null);
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
  const [whatsappVendedor, setWhatsappVendedor] = useState<string | null>(null);

  // localStorage prefill
  const [prefilled, setPrefilled] = useState(false);

  // OCR state
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Geolocation state
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

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

  // Load saved data from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lead_capture_data');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.name) setName(data.name);
        if (data.phone) setPhone(data.phone);
        if (data.email) setEmail(data.email);
        if (data.company) setCompany(data.company);
        if (data.cargo) setCargo(data.cargo);
        if (data.cidade) setCidade(data.cidade);
        if (data.estado) setEstado(data.estado);
        if (data.name || data.phone) setPrefilled(true);
      }
    } catch { /* ignore parse errors */ }
  }, []);

  // Geolocation - silent, non-blocking
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`,
            { headers: { 'User-Agent': 'ProspectaEasy/1.0' } }
          );
          const data = await res.json();
          if (data.address) {
            setCidade(data.address.city || data.address.town || data.address.village || '');
            setEstado(data.address.state || '');
          }
        } catch { /* silent */ }
      },
      () => { /* permission denied or error - silent */ },
      { timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        let url = `/api/lead-capture?token=${token}`;
        if (eventId && boothId) {
          url += `&event=${eventId}&booth=${boothId}`;
        }
        const res = await fetch(url);
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
        if (data.booth?.company_name) {
          setBoothCompany(data.booth.company_name);
          setCompany(data.booth.company_name);
        }
      } catch {
        setError('Erro ao carregar formulario');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchInfo();
  }, [token, eventId, boothId]);

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
          cidade: cidade.trim() || undefined,
          estado: estado.trim() || undefined,
          event_id: eventId || undefined,
          booth_id: boothId || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok || data.success) {
        localStorage.setItem('lead_capture_data', JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          company: company.trim(),
          cargo: cargo.trim(),
          cidade: cidade.trim(),
          estado: estado.trim(),
        }));

        setWhatsappVendedor(data.whatsapp_vendedor || linkInfo?.whatsapp_vendedor || null);
        setSubmitMessage(data.message || 'Dados registrados com sucesso!');
        setSubmitted(true);
      } else {
        setFieldErrors({ form: data.error || 'Erro ao enviar dados' });
      }
    } catch {
      setFieldErrors({ form: 'Erro de conexao. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  // OCR - scan business card
  const handleScanCard = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setFieldErrors({});

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/scan-card', { method: 'POST', body: formData });

      if (!res.ok) {
        let msg = 'Erro ao processar imagem. Preencha manualmente.';
        try { const d = await res.json(); msg = d.error || msg; } catch {}
        setFieldErrors({ form: `${msg} (${res.status})` });
        return;
      }

      const data = await res.json();
      let filled = 0;

      if (data.name) { setName(data.name); filled++; }
      if (data.phone) { setPhone(formatPhone(data.phone)); filled++; }
      if (data.email) { setEmail(data.email.toLowerCase()); filled++; }
      if (data.company) { setCompany(data.company); filled++; }
      if (data.cargo) { setCargo(data.cargo); filled++; }
      if (data.cidade) { setCidade(data.cidade); filled++; }
      if (data.estado) { setEstado(data.estado); filled++; }

      if (filled === 0) {
        setFieldErrors({ form: 'Nao foi possivel ler dados do cartao. Tente outra foto ou preencha manualmente.' });
      }
    } catch (err: any) {
      setFieldErrors({ form: `Erro: ${err?.message || 'falha de conexao'}. Preencha manualmente.` });
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    const whatsappNumber = whatsappVendedor?.replace(/\D/g, '');

    return (
      <div className="min-h-screen bg-[#120826] flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-100 mb-3">Obrigado!</h1>
          <p className="text-sm text-purple-300/70 leading-relaxed">{submitMessage}</p>
          {linkInfo?.user_name && (
            <p className="text-xs text-purple-300/50 mt-2">
              {linkInfo.user_name} recebera seus dados.
            </p>
          )}

          {/* WhatsApp button */}
          {whatsappNumber && (
            <a
              href={`https://wa.me/55${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 w-full inline-flex items-center justify-center gap-2.5 px-5 py-3.5 bg-[#25D366] text-white text-sm font-semibold rounded-lg hover:bg-[#20bd5a] shadow-lg shadow-[#25D366]/25 transition-colors active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Falar no WhatsApp com {linkInfo?.user_name || 'vendedor'}
            </a>
          )}
        </div>
      </div>
    );
  }

  // Step 1 Form (main)
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

      {/* Hidden file input for OCR */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-5">
        <div className="flex items-center justify-center gap-3">
          {linkInfo?.user_avatar ? (
            <img
              src={linkInfo.user_avatar}
              alt={linkInfo.user_name}
              className="w-12 h-12 rounded-full object-cover border-2 border-white/30 shadow-lg"
            />
          ) : linkInfo?.user_name ? (
            <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center shadow-lg">
              <span className="text-lg font-bold text-white">
                {linkInfo.user_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            </div>
          ) : null}
          <div className="text-left">
            <h1 className="text-lg font-bold text-white">
              {linkInfo?.label || 'Cadastro Rapido'}
            </h1>
            {linkInfo?.user_name && (
              <p className="text-sm text-emerald-100/80">
                Atendimento: {linkInfo.user_name}
              </p>
            )}
          </div>
        </div>
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

        {/* Prefilled banner */}
        {prefilled && !socialFilled && (
          <div className="mb-4 p-3 rounded-lg bg-purple-500/10 text-purple-300 text-sm border border-purple-500/20 text-center">
            Dados anteriores carregados. Confira e envie!
          </div>
        )}

        {boothCompany && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm border border-emerald-500/20 text-center">
            Cadastro para: <strong>{boothCompany}</strong>
          </div>
        )}

        {!socialFilled && !prefilled && !boothCompany && !(googleClientId || appleClientId) && (
          <p className="text-sm text-purple-300/60 mb-5 text-center">
            Preencha seus dados para que possamos entrar em contato.
          </p>
        )}

        {fieldErrors.form && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/15 text-red-400 text-sm border border-red-500/20">
            {fieldErrors.form}
          </div>
        )}

        {/* Scan Card Button */}
        <button
          type="button"
          onClick={handleScanCard}
          disabled={scanning}
          className="w-full mb-4 py-3 flex items-center justify-center gap-2 text-sm font-medium text-purple-300 border border-purple-700/30 rounded-lg hover:bg-purple-500/10 transition-colors active:scale-[0.98] disabled:opacity-50"
        >
          {scanning ? (
            <>
              <div className="w-4 h-4 border-2 border-purple-600/30 border-t-emerald-500 rounded-full animate-spin" />
              Processando imagem...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Escanear Cartao de Visita
            </>
          )}
        </button>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1">
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
            <label className="block text-xs font-medium text-purple-300/80 mb-1">
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
            <label className="block text-xs font-medium text-purple-300/80 mb-1">Email</label>
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
            <label className="block text-xs font-medium text-purple-300/80 mb-1">Empresa</label>
            <input
              type="text"
              value={company}
              onChange={(e) => !boothCompany && setCompany(e.target.value)}
              readOnly={!!boothCompany}
              placeholder="Nome da empresa"
              autoComplete="organization"
              className={`w-full px-3.5 py-3 text-sm bg-[#1e0f35] border border-purple-700/30 rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${boothCompany ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
          </div>

          {/* Cargo */}
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1">Cargo</label>
            <input
              type="text"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Seu cargo"
              autoComplete="organization-title"
              className="w-full px-3.5 py-3 text-sm bg-[#1e0f35] border border-purple-700/30 rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Cidade + Estado - side by side */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-purple-300/80 mb-1">Cidade</label>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Sua cidade"
                className="w-full px-3.5 py-3 text-sm bg-[#1e0f35] border border-purple-700/30 rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-purple-300/80 mb-1">Estado</label>
              <input
                type="text"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                placeholder="UF"
                className="w-full px-3.5 py-3 text-sm bg-[#1e0f35] border border-purple-700/30 rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Observacoes */}
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1">Observacoes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alguma observacao ou interesse especifico?"
              rows={2}
              className="w-full px-3.5 py-3 text-sm bg-[#1e0f35] border border-purple-700/30 rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-emerald-600 text-white text-base font-bold rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 disabled:opacity-50 transition-colors active:scale-[0.98]"
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
          Powered by Controlei CRM
        </p>
      </div>
    </div>
  );
}

export default function LeadCapturePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#120826] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-800/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    }>
      <LeadCapturePageInner />
    </Suspense>
  );
}
