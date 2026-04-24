'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';

type Screen = 'loading' | 'welcome' | 'form' | 'palpite' | 'thanks' | 'paused' | 'error';

interface QuizConfig {
  id: string;
  quiz_ativo: boolean;
  nome_evento: string;
  descricao_desafio: string;
  mensagem_pausa: string;
  total_participantes: number;
  dia_feira: number | null;
  dias_feira: number | null;
  descricao_dia: string | null;
}

/* Components defined OUTSIDE to avoid remount on every keystroke */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`qz-card qz-fade ${className}`}>{children}</div>;
}

function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const h = size === 'md' ? 160 : 112;
  return <img src="/logo_easy.png" alt="Easy by Comlink" style={{ height: h }} className="qz-logo-img" />;
}

/* Step indicator */
function StepBar({ step }: { step: 1 | 2 }) {
  return (
    <div className="qz-steps">
      <div className="qz-step qz-step-active">
        <div className="qz-step-dot">1</div>
        <span className="qz-step-label">Dados</span>
      </div>
      <div className={`qz-step-line ${step === 2 ? 'qz-step-line-done' : ''}`} />
      <div className={`qz-step ${step === 2 ? 'qz-step-active' : ''}`}>
        <div className="qz-step-dot">2</div>
        <span className="qz-step-label">Palpite</span>
      </div>
    </div>
  );
}

/* SVG icon helpers */
const icons = {
  user: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
  building: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>,
  phone: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>,
  email: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>,
  map: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
  briefcase: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>,
};

function InputField({ icon, label, optional, ...props }: { icon: keyof typeof icons; label: string; optional?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="qz-field">
      <label className="qz-label">{label}{optional && <span className="qz-label-opt"> (opcional)</span>}</label>
      <div className="qz-input-wrap">
        <span className="qz-input-icon">{icons[icon]}</span>
        <input {...props} className="qz-input qz-input-icon-pad" />
      </div>
    </div>
  );
}

export default function QuizPublicPage() {
  const params = useParams();
  const token = params.token as string;

  const [screen, setScreen] = useState<Screen>('loading');
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cidade, setCidade] = useState('');
  const [cargo, setCargo] = useState('');
  const [palpite, setPalpite] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [duplicateMsg, setDuplicateMsg] = useState('');
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasContactPicker, setHasContactPicker] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScanCard = () => { fileInputRef.current?.click(); };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/scan-card', { method: 'POST', body: formData });
      if (!res.ok) {
        let msg = 'Erro ao processar imagem. Preencha manualmente.';
        try { const d = await res.json(); msg = d.error || msg; } catch {}
        setError(msg);
        return;
      }
      const data = await res.json();
      let filled = 0;
      if (data.name) { setNome(data.name); filled++; }
      if (data.phone) { setTelefone(formatPhone(data.phone)); filled++; }
      if (data.email) { setEmail(data.email.toLowerCase()); filled++; }
      if (data.company) { setEmpresa(data.company); filled++; }
      if (data.cargo) { setCargo(data.cargo); filled++; }
      if (data.cidade) { setCidade(data.cidade); filled++; }
      if (filled === 0) {
        setError('Nao foi possivel ler dados do cartao. Preencha manualmente.');
      }
    } catch (err: any) {
      setError(`Erro: ${err?.message || 'falha de conexao'}. Preencha manualmente.`);
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    setHasContactPicker('contacts' in navigator && 'ContactsManager' in window);
  }, []);

  const pickContact = async () => {
    try {
      const nav = navigator as any;
      const props = await nav.contacts.getProperties();
      const supported = props as string[];
      const requested = ['name', 'tel', 'email'].filter(p => supported.includes(p));
      const [contact] = await nav.contacts.select(requested, { multiple: false });
      if (!contact) return;
      if (contact.name?.[0]) setNome(contact.name[0]);
      if (contact.tel?.[0]) setTelefone(formatPhone(contact.tel[0]));
      if (contact.email?.[0]) setEmail(contact.email[0]);
    } catch {
      // User cancelled or API not available
    }
  };

  const resetIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (screen !== 'welcome' && screen !== 'loading' && screen !== 'error' && screen !== 'paused') {
      idleTimerRef.current = setTimeout(() => {
        resetForm();
        setScreen('welcome');
      }, 60000);
    }
  }, [screen]);

  useEffect(() => {
    const events = ['touchstart', 'mousedown', 'keydown'];
    const handler = () => resetIdle();
    events.forEach((e) => window.addEventListener(e, handler));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdle]);

  useEffect(() => { resetIdle(); }, [screen, resetIdle]);

  // Auto-cleanup stale service workers on quiz page
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [token]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/quiz?token=${token}`, { cache: 'no-store' });
      if (!res.ok) { setScreen('error'); return; }
      const data = await res.json();
      setConfig(data);
      setScreen(data.quiz_ativo ? 'welcome' : 'paused');
    } catch { setScreen('error'); }
  };

  const resetForm = () => {
    setNome(''); setEmpresa(''); setTelefone('');
    setEmail(''); setCidade(''); setCargo('');
    setPalpite('');
    setError(''); setDuplicateMsg('');
  };

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const handleFormSubmit = () => {
    if (!nome.trim() || nome.trim().length < 2) { setError('Digite seu nome completo'); return; }
    if (!empresa.trim() || empresa.trim().length < 2) { setError('Digite o nome da sua empresa'); return; }
    if (telefone.replace(/\D/g, '').length < 10) { setError('Digite um telefone valido'); return; }
    setError(''); setScreen('palpite');
  };

  const handleNumpad = (digit: string) => {
    if (digit === 'del') setPalpite(palpite.slice(0, -1));
    else if (digit === 'C') setPalpite('');
    else if (palpite.length < 7) setPalpite(palpite + digit);
  };

  const handleSubmitPalpite = async () => {
    if (!palpite || Number(palpite) < 1) { setError('Digite um palpite valido'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, nome: nome.trim(), empresa: empresa.trim(),
          telefone: telefone.replace(/\D/g, ''), palpite: Number(palpite),
          email: email.trim() || undefined,
          cidade: cidade.trim() || undefined,
          cargo: cargo.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.duplicate) { setDuplicateMsg(data.message); setScreen('thanks'); }
      else if (data.success) { setScreen('thanks'); }
      else { setError(data.error || 'Erro ao enviar. Tente novamente.'); }
    } catch { setError('Erro de conexao. Tente novamente.'); }
    setSubmitting(false);
  };

  useEffect(() => {
    if (screen === 'thanks') {
      const t = setTimeout(() => { resetForm(); setScreen('welcome'); fetchConfig(); }, 6000);
      return () => clearTimeout(t);
    }
  }, [screen]);

  // Day badge helper — only show valid days (1..total)
  const showDayBadge = config?.dia_feira != null && config?.dias_feira != null
    && config.dia_feira >= 1 && config.dia_feira <= config.dias_feira;

  /* ── LOADING ── */
  if (screen === 'loading') return (
    <div className="qz-page">
      <div className="qz-loader">
        <div className="qz-loader-ring" />
        <div className="qz-loader-ring qz-loader-ring-2" />
      </div>
      <style>{styles}</style>
    </div>
  );

  /* ── ERROR ── */
  if (screen === 'error') return (
    <div className="qz-page">
      <Card className="text-center">
        <Logo />
        <div className="qz-spacer" />
        <div className="qz-status-icon qz-status-error">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
        </div>
        <h1 className="qz-title">Quiz nao encontrado</h1>
        <p className="qz-sub">Verifique o link e tente novamente.</p>
      </Card>
      <style>{styles}</style>
    </div>
  );

  /* ── PAUSED ── */
  if (screen === 'paused') return (
    <div className="qz-page">
      <Card className="text-center">
        <Logo />
        <div className="qz-spacer" />
        <div className="qz-status-icon qz-status-pause">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg>
        </div>
        <h1 className="qz-title">{config?.nome_evento || 'Quiz'}</h1>
        <p className="qz-sub">{config?.mensagem_pausa || 'O quiz esta pausado no momento.'}</p>
        <div className="qz-spacer" />
        <button onClick={fetchConfig} className="qz-btn qz-btn-ghost">Tentar novamente</button>
      </Card>
      <style>{styles}</style>
    </div>
  );

  /* ── WELCOME (fullscreen hero) ── */
  if (screen === 'welcome') return (
    <div className="qz-welcome" onClick={() => setScreen('form')}>
      {/* Mesh gradient orbs */}
      <div className="qz-orb qz-orb-1" />
      <div className="qz-orb qz-orb-2" />
      <div className="qz-orb qz-orb-3" />

      {/* Floating particles */}
      <div className="qz-particles">
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className="qz-particle" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${8 + Math.random() * 10}s`,
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
            opacity: 0.2 + Math.random() * 0.3,
          }} />
        ))}
      </div>

      {/* Content with glass panel */}
      <div className="qz-welcome-glass qz-fade">
        <div className="qz-welcome-inner">
          {/* Logo */}
          <img
            src="/logo_easy.png"
            alt="Easy by Comlink"
            className="qz-welcome-hero-logo"
          />

          {/* Day indicator — only valid days */}
          {showDayBadge && (
            <div className="qz-day-badge">
              <span className="qz-day-badge-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              </span>
              Dia {config!.dia_feira} de {config!.dias_feira}
            </div>
          )}

          {/* Event name */}
          <h1 className="qz-welcome-title">{config?.nome_evento || 'Quiz'}</h1>

          {/* Divider */}
          <div className="qz-welcome-divider" />

          {/* Challenge description */}
          <p className="qz-welcome-desc">{config?.descricao_desafio || 'Participe do nosso desafio!'}</p>

          {/* Counter */}
          {(config?.total_participantes || 0) > 0 && (
            <div className="qz-welcome-counter">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
              <span className="qz-welcome-counter-num">{config?.total_participantes}</span>
              <span className="qz-welcome-counter-label">participacoes</span>
            </div>
          )}

          {/* CTA Button */}
          <button className="qz-welcome-cta" onClick={(e) => { e.stopPropagation(); setScreen('form'); }}>
            <span>PARTICIPAR AGORA</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>

          <p className="qz-welcome-hint">Toque em qualquer lugar para comecar</p>
        </div>
      </div>

      <style>{styles}</style>
    </div>
  );

  return (
    <div className="qz-page">
      {/* ── FORM ── */}
      {screen === 'form' && (
        <Card>
          {/* Event context header */}
          <div className="qz-form-header">
            <Logo size="sm" />
            {config?.nome_evento && (
              <span className="qz-form-event-name">{config.nome_evento}</span>
            )}
            {showDayBadge && (
              <span className="qz-form-day-pill">Dia {config!.dia_feira}/{config!.dias_feira}</span>
            )}
          </div>

          <StepBar step={1} />
          <div className="qz-spacer-sm" />

          <h2 className="qz-section-title">Seus dados</h2>
          <p className="qz-section-sub">Preencha para validar sua participacao</p>
          <div className="qz-spacer-sm" />

          {/* Hidden file input pro OCR de cartao */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="qz-hidden"
            onChange={handleFileSelected}
          />

          <div className="qz-shortcuts">
            <button
              type="button"
              onClick={handleScanCard}
              disabled={scanning}
              className="qz-btn-contact-picker"
            >
              {scanning ? (
                <>
                  <span className="qz-spinner-sm" />
                  Lendo cartao...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Escanear cartao
                </>
              )}
            </button>
            {hasContactPicker && (
              <button type="button" onClick={pickContact} className="qz-btn-contact-picker">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                Buscar do celular
              </button>
            )}
          </div>

          {/* Required fields */}
          <InputField icon="user" label="Nome completo" type="text" value={nome}
            onChange={(e) => setNome(e.target.value)} placeholder="Digite seu nome" autoComplete="name" />
          <InputField icon="building" label="Empresa" type="text" value={empresa}
            onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da empresa" autoComplete="organization" />
          <InputField icon="phone" label="Telefone / WhatsApp" type="tel" inputMode="numeric" value={telefone}
            onChange={(e) => setTelefone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" autoComplete="tel" />

          {/* Optional fields - collapsible area */}
          <div className="qz-optional-divider">
            <span className="qz-optional-divider-line" />
            <span className="qz-optional-divider-text">Opcional</span>
            <span className="qz-optional-divider-line" />
          </div>

          <div className="qz-optional-grid">
            <InputField icon="email" label="Email" optional type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" />
            <InputField icon="map" label="Cidade" optional type="text" value={cidade}
              onChange={(e) => setCidade(e.target.value)} placeholder="Sua cidade" autoComplete="address-level2" />
            <InputField icon="briefcase" label="Funcao" optional type="text" value={cargo}
              onChange={(e) => setCargo(e.target.value)} placeholder="Seu cargo" autoComplete="organization-title" />
          </div>

          {error && <p className="qz-error">{error}</p>}
          <div className="qz-spacer-sm" />

          <button onClick={handleFormSubmit} className="qz-btn qz-btn-primary qz-btn-lg">
            CONTINUAR
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          </button>
          <button onClick={() => { resetForm(); setScreen('welcome'); }} className="qz-btn qz-btn-ghost">Voltar</button>
        </Card>
      )}

      {/* ── PALPITE ── */}
      {screen === 'palpite' && (
        <Card>
          {/* Event context header */}
          <div className="qz-form-header">
            <Logo size="sm" />
            {config?.nome_evento && (
              <span className="qz-form-event-name">{config.nome_evento}</span>
            )}
          </div>

          <StepBar step={2} />
          <div className="qz-spacer-sm" />

          <h2 className="qz-section-title">Qual e o seu palpite?</h2>
          <p className="qz-section-sub">{config?.descricao_desafio || 'Digite seu palpite'}</p>
          <div className="qz-spacer-sm" />

          {/* User context pill */}
          <div className="qz-user-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
            {nome}
          </div>

          <div className="qz-display">
            <span className="qz-display-label">SEU PALPITE</span>
            <span className={`qz-display-value ${palpite ? 'qz-display-has-value' : ''}`}>{palpite || '0'}</span>
          </div>

          <div className="qz-numpad">
            {['1','2','3','4','5','6','7','8','9','C','0','del'].map((k) => (
              <button key={k} onClick={() => handleNumpad(k)}
                className={`qz-numpad-key ${k === 'C' ? 'qz-key-clear' : k === 'del' ? 'qz-key-del' : ''}`}>
                {k === 'del' ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33z" />
                  </svg>
                ) : k}
              </button>
            ))}
          </div>

          {error && <p className="qz-error">{error}</p>}

          <button onClick={handleSubmitPalpite} disabled={submitting || !palpite}
            className="qz-btn qz-btn-primary qz-btn-lg" style={{ marginTop: 12 }}>
            {submitting ? (
              <><span className="qz-btn-spinner" /> ENVIANDO...</>
            ) : (
              <>ENVIAR PALPITE <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg></>
            )}
          </button>
          <button onClick={() => { setPalpite(''); setError(''); setScreen('form'); }} className="qz-btn qz-btn-ghost">Voltar</button>
        </Card>
      )}

      {/* ── THANKS ── */}
      {screen === 'thanks' && (
        <Card className="text-center">
          <Logo />
          <div className="qz-spacer" />

          {/* Confetti burst */}
          <div className="qz-confetti-wrap">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="qz-confetti-piece" style={{
                left: `${10 + Math.random() * 80}%`,
                animationDelay: `${Math.random() * 0.6}s`,
                animationDuration: `${1.5 + Math.random() * 1.5}s`,
                background: ['#34d399', '#a78bfa', '#fbbf24', '#f472b6', '#60a5fa', '#7c3aed'][i % 6],
                width: `${4 + Math.random() * 6}px`,
                height: `${4 + Math.random() * 6}px`,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                transform: `rotate(${Math.random() * 360}deg)`,
              }} />
            ))}
          </div>

          <div className="qz-success-check qz-fade">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" className="qz-check-path" />
            </svg>
          </div>

          <h1 className="qz-title" style={{ color: '#34d399', fontSize: 28 }}>
            {duplicateMsg ? 'Opa!' : 'Obrigado!'}
          </h1>
          <p className="qz-sub" style={{ fontSize: 16, color: 'rgba(196,181,253,0.7)' }}>
            {duplicateMsg || 'Sua participacao foi registrada com sucesso!'}
          </p>

          {!duplicateMsg && palpite && (
            <div className="qz-palpite-result">
              <span className="qz-palpite-result-label">Seu palpite</span>
              <span className="qz-palpite-result-value">{palpite}</span>
            </div>
          )}

          {!duplicateMsg && (
            <p className="qz-thanks-name">Boa sorte, {nome.split(' ')[0]}!</p>
          )}

          <div className="qz-spacer" />
          <div className="qz-return-bar"><div className="qz-return-bar-fill" /></div>
          <p className="qz-sub" style={{ fontSize: 12, marginTop: 8 }}>Voltando ao inicio...</p>
        </Card>
      )}

      <style>{styles}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   STYLES — v2 Modern
   ═══════════════════════════════════════════════════ */
const styles = `
  * { box-sizing: border-box; }

  /* ── WELCOME SCREEN ── */
  .qz-welcome {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    background: #060114;
  }

  /* Mesh gradient orbs */
  .qz-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    animation: qzOrbFloat 12s ease-in-out infinite;
  }
  .qz-orb-1 {
    width: 500px; height: 500px;
    top: -15%; left: -10%;
    background: rgba(124,58,237,0.25);
    animation-delay: 0s;
  }
  .qz-orb-2 {
    width: 400px; height: 400px;
    bottom: -10%; right: -10%;
    background: rgba(88,28,135,0.2);
    animation-delay: -4s;
    animation-duration: 15s;
  }
  .qz-orb-3 {
    width: 300px; height: 300px;
    top: 40%; left: 50%;
    background: rgba(167,139,250,0.1);
    animation-delay: -8s;
    animation-duration: 18s;
  }
  @keyframes qzOrbFloat {
    0%, 100% { transform: translate(0,0) scale(1); }
    33% { transform: translate(30px,-20px) scale(1.05); }
    66% { transform: translate(-20px,15px) scale(0.95); }
  }

  /* Particles */
  .qz-particles {
    position: absolute; inset: 0; pointer-events: none; overflow: hidden;
  }
  .qz-particle {
    position: absolute;
    bottom: -10px;
    background: #a78bfa;
    border-radius: 50%;
    animation: qzParticleUp linear infinite;
  }
  @keyframes qzParticleUp {
    0%   { transform: translateY(0) scale(1); opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { transform: translateY(-100vh) scale(0.3); opacity: 0; }
  }

  /* Glass panel on welcome */
  .qz-welcome-glass {
    position: relative; z-index: 1;
    background: rgba(18, 8, 38, 0.45);
    backdrop-filter: blur(40px) saturate(1.4);
    -webkit-backdrop-filter: blur(40px) saturate(1.4);
    border: 1px solid rgba(139, 92, 246, 0.12);
    border-radius: 32px;
    padding: 8px;
    box-shadow:
      0 0 0 1px rgba(139,92,246,0.05),
      0 32px 64px rgba(0,0,0,0.5);
    max-width: 480px;
    width: calc(100% - 32px);
  }
  .qz-welcome-inner {
    text-align: center;
    padding: 40px 28px;
    background: rgba(18, 8, 38, 0.3);
    border-radius: 26px;
    border: 1px solid rgba(139,92,246,0.06);
  }

  .qz-welcome-hero-logo {
    display: block;
    margin: 0 auto 32px;
    width: min(90vw, 720px);
    max-height: 400px;
    object-fit: contain;
    animation: qzFloat 4s ease-in-out infinite;
    filter: drop-shadow(0 0 30px rgba(124,58,237,0.4));
  }
  @keyframes qzFloat {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-8px); }
  }

  .qz-welcome-title {
    font-size: 36px;
    font-weight: 900;
    color: #fff;
    margin: 0 0 0;
    letter-spacing: -0.5px;
    line-height: 1.1;
  }

  .qz-welcome-divider {
    width: 48px; height: 3px;
    background: linear-gradient(90deg, #7c3aed, #a78bfa);
    border-radius: 4px;
    margin: 16px auto;
    opacity: 0.6;
  }

  .qz-welcome-desc {
    font-size: 16px;
    color: rgba(196, 181, 253, 0.7);
    margin: 0 0 24px;
    line-height: 1.5;
  }

  .qz-welcome-counter {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 28px;
    padding: 8px 18px;
    background: rgba(124, 58, 237, 0.1);
    border: 1px solid rgba(124, 58, 237, 0.15);
    border-radius: 100px;
    color: rgba(167,139,250,0.7);
  }
  .qz-welcome-counter svg { opacity: 0.5; }
  .qz-welcome-counter-num {
    font-size: 18px; font-weight: 800; color: #a78bfa;
    font-variant-numeric: tabular-nums;
  }
  .qz-welcome-counter-label {
    font-size: 13px; color: rgba(167, 139, 250, 0.5);
  }

  /* CTA button */
  .qz-welcome-cta {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 18px 44px;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: #fff;
    background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
    border: none;
    border-radius: 60px;
    cursor: pointer;
    box-shadow:
      0 0 0 0 rgba(124,58,237,0.4),
      0 8px 32px rgba(124,58,237,0.35);
    animation: qzCtaPulse 3s ease-in-out infinite;
    transition: transform .15s, box-shadow .15s;
    position: relative;
    overflow: hidden;
  }
  .qz-welcome-cta::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%);
    border-radius: inherit;
  }
  .qz-welcome-cta:active { transform: scale(0.95); }
  @keyframes qzCtaPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.4), 0 8px 32px rgba(124,58,237,0.35); }
    50%      { box-shadow: 0 0 0 14px rgba(124,58,237,0), 0 8px 40px rgba(124,58,237,0.45); }
  }

  .qz-welcome-hint {
    margin-top: 20px;
    font-size: 12px;
    color: rgba(167, 139, 250, 0.25);
    animation: qzBlink 2.5s ease-in-out infinite;
  }
  @keyframes qzBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
  }

  /* ── PAGE (form/palpite/thanks) ── */
  .qz-page {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: #060114;
    background-image:
      radial-gradient(ellipse 70% 50% at 50% 0%, rgba(124,58,237,0.12) 0%, transparent 70%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  /* Card */
  .qz-card {
    width: 100%;
    max-width: 440px;
    position: relative;
    background: rgba(18, 8, 38, 0.65);
    backdrop-filter: blur(40px) saturate(1.3);
    -webkit-backdrop-filter: blur(40px) saturate(1.3);
    border: 1px solid rgba(139, 92, 246, 0.1);
    border-radius: 28px;
    padding: 36px 28px;
    box-shadow:
      0 0 0 1px rgba(139, 92, 246, 0.04),
      0 32px 64px rgba(0, 0, 0, 0.5);
  }

  /* Animations */
  .qz-fade { animation: qzFadeUp .5s cubic-bezier(.16,1,.3,1); }
  @keyframes qzFadeUp {
    from { opacity: 0; transform: translateY(20px) scale(.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Loader */
  .qz-loader { position: relative; width: 48px; height: 48px; }
  .qz-loader-ring {
    position: absolute; inset: 0;
    border: 2.5px solid transparent;
    border-top-color: #a78bfa;
    border-radius: 50%;
    animation: spin .9s cubic-bezier(.5,.15,.5,.85) infinite;
  }
  .qz-loader-ring-2 {
    inset: 6px;
    border-top-color: transparent;
    border-right-color: rgba(124,58,237,0.4);
    animation-direction: reverse;
    animation-duration: 1.4s;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Logo */
  .qz-logo-img { object-fit: contain; display: inline-block; }

  /* Typography */
  .qz-title { font-size: 24px; font-weight: 800; color: #fff; margin: 12px 0 6px; letter-spacing: -0.3px; }
  .qz-sub { font-size: 14px; color: rgba(196, 181, 253, 0.5); margin: 0; line-height: 1.5; }
  .qz-section-title { font-size: 22px; font-weight: 800; color: #fff; margin: 0 0 4px; text-align: center; letter-spacing: -0.3px; }
  .qz-section-sub { font-size: 13px; color: rgba(196, 181, 253, 0.45); margin: 0; text-align: center; line-height: 1.4; }

  /* Spacers */
  .qz-spacer    { height: 24px; }
  .qz-spacer-sm { height: 14px; }

  /* Status icons (error/pause) */
  .qz-status-icon {
    width: 72px; height: 72px; margin: 0 auto 12px;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
  }
  .qz-status-error {
    background: rgba(239,68,68,.08);
    color: #f87171;
    border: 2px solid rgba(239,68,68,.15);
    animation: qzStatusPulse 2s ease-in-out infinite;
  }
  .qz-status-pause {
    background: rgba(234,179,8,.08);
    color: #facc15;
    border: 2px solid rgba(234,179,8,.15);
    animation: qzStatusPulse 2s ease-in-out infinite;
  }
  @keyframes qzStatusPulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.1); }
    50% { box-shadow: 0 0 0 10px rgba(139,92,246,0); }
  }

  /* Step bar */
  .qz-steps {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin-bottom: 4px;
  }
  .qz-step {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    opacity: 0.3; transition: opacity .3s;
  }
  .qz-step-active { opacity: 1; }
  .qz-step-dot {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: rgba(124,58,237,0.15);
    border: 2px solid rgba(124,58,237,0.3);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 800; color: #a78bfa;
    transition: all .3s;
  }
  .qz-step-active .qz-step-dot {
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    border-color: #7c3aed;
    color: #fff;
    box-shadow: 0 0 16px rgba(124,58,237,0.3);
  }
  .qz-step-label { font-size: 10px; font-weight: 600; color: rgba(167,139,250,0.6); text-transform: uppercase; letter-spacing: 0.5px; }
  .qz-step-line {
    width: 48px; height: 2px;
    background: rgba(124,58,237,0.15);
    border-radius: 2px;
    margin: 0 8px;
    margin-bottom: 18px;
    transition: background .3s;
  }
  .qz-step-line-done { background: linear-gradient(90deg, #7c3aed, #a78bfa); }

  /* Form */
  .qz-field { margin-bottom: 12px; }
  .qz-label {
    display: block; font-size: 11px; font-weight: 700;
    color: rgba(196, 181, 253, 0.55); margin-bottom: 5px;
    text-transform: uppercase; letter-spacing: 0.8px;
  }
  .qz-label-opt {
    font-weight: 500; text-transform: none; letter-spacing: 0;
    color: rgba(196, 181, 253, 0.3); font-size: 10px;
  }
  .qz-input-wrap {
    position: relative;
  }
  .qz-input-icon {
    position: absolute;
    left: 14px; top: 50%; transform: translateY(-50%);
    color: rgba(167,139,250,0.35);
    display: flex; align-items: center;
    pointer-events: none;
    transition: color .2s;
  }
  .qz-input-wrap:focus-within .qz-input-icon {
    color: rgba(167,139,250,0.7);
  }
  .qz-input {
    width: 100%; box-sizing: border-box;
    background: rgba(13, 5, 32, 0.6);
    border: 1.5px solid rgba(139, 92, 246, 0.12);
    border-radius: 14px;
    padding: 13px 16px;
    font-size: 16px; color: #fff;
    caret-color: #a78bfa;
    outline: none; transition: all .25s;
    -webkit-appearance: none;
  }
  .qz-input-icon-pad { padding-left: 42px; }
  .qz-input:focus {
    border-color: rgba(124, 58, 237, 0.5);
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.08);
    background: rgba(13, 5, 32, 0.8);
  }
  .qz-input::placeholder { color: rgba(139, 92, 246, 0.2); }

  .qz-error {
    text-align: center; color: #f87171; font-size: 13px;
    margin: 8px 0 0; font-weight: 600;
    padding: 8px 12px;
    background: rgba(239,68,68,0.06);
    border-radius: 10px;
  }

  /* Display */
  .qz-display {
    background: rgba(13, 5, 32, 0.7);
    border: 2px solid rgba(139, 92, 246, 0.15);
    border-radius: 20px; padding: 16px 20px;
    text-align: center; margin-bottom: 14px;
    position: relative;
    overflow: hidden;
  }
  .qz-display::before {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 50% 100%, rgba(124,58,237,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .qz-display-label {
    display: block;
    font-size: 10px; font-weight: 700;
    color: rgba(167,139,250,0.4);
    letter-spacing: 2px;
    margin-bottom: 4px;
  }
  .qz-display-value {
    font-size: 48px; font-weight: 800; color: #a78bfa;
    font-family: "SF Mono", "Fira Code", ui-monospace, monospace;
    letter-spacing: 6px;
    text-shadow: 0 0 40px rgba(167, 139, 250, 0.25);
    position: relative;
  }

  /* Numpad */
  .qz-numpad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 4px; }
  .qz-numpad-key {
    height: 58px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 700; color: #e2e0ff;
    background: rgba(18, 8, 38, 0.5);
    border: 1px solid rgba(139, 92, 246, 0.1);
    border-radius: 16px; cursor: pointer;
    transition: all .15s;
    user-select: none; -webkit-user-select: none;
    position: relative;
    overflow: hidden;
  }
  .qz-numpad-key::after {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(circle at 50% 50%, rgba(139,92,246,0.15) 0%, transparent 70%);
    opacity: 0;
    transition: opacity .15s;
  }
  .qz-numpad-key:active { transform: scale(.92); }
  .qz-numpad-key:active::after { opacity: 1; }
  .qz-key-clear { color: #f87171 !important; font-size: 15px !important; font-weight: 800 !important; background: rgba(239,68,68,.05) !important; border-color: rgba(239,68,68,.12) !important; }
  .qz-key-del { color: #fbbf24 !important; background: rgba(251,191,36,.04) !important; border-color: rgba(251,191,36,.1) !important; }

  /* Buttons */
  .qz-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; border: none; cursor: pointer;
    font-family: inherit; font-weight: 700;
    transition: all .2s; user-select: none; -webkit-user-select: none;
  }
  .qz-btn:active { transform: scale(.97); }
  .qz-btn-primary {
    background: linear-gradient(135deg, #7c3aed, #5b21b6);
    color: #fff; border-radius: 16px;
    box-shadow: 0 4px 24px rgba(124,58,237,0.3);
    position: relative;
    overflow: hidden;
  }
  .qz-btn-primary::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%);
    border-radius: inherit;
  }
  .qz-btn-primary:hover { box-shadow: 0 4px 32px rgba(124,58,237,0.45); }
  .qz-btn-primary:disabled { opacity: .4; cursor: not-allowed; transform: none; }
  .qz-btn-lg { padding: 16px; font-size: 15px; letter-spacing: 1px; }
  .qz-btn-ghost { background: none; color: rgba(196,181,253,.35); font-size: 13px; padding: 10px; border-radius: 12px; }
  .qz-btn-ghost:hover { color: rgba(196,181,253,.6); }
  .qz-btn-spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin .6s linear infinite;
  }
  .qz-hidden { display: none; }
  .qz-shortcuts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .qz-btn-contact-picker {
    flex: 1 1 140px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(124,58,237,0.12);
    border: 1px solid rgba(124,58,237,0.35);
    color: rgba(196,181,253,0.95);
    font-size: 12px;
    font-weight: 600;
    border-radius: 12px;
    cursor: pointer;
    transition: background .15s, transform .15s;
  }
  .qz-btn-contact-picker:hover { background: rgba(124,58,237,0.22); }
  .qz-btn-contact-picker:disabled { opacity: .6; cursor: not-allowed; }
  .qz-btn-contact-picker:active { transform: scale(0.98); }
  .qz-spinner-sm {
    width: 14px; height: 14px;
    border: 2px solid rgba(196,181,253,0.3);
    border-top-color: rgba(196,181,253,0.95);
    border-radius: 50%;
    animation: spin .6s linear infinite;
    display: inline-block;
  }

  /* Success / Thanks */
  .qz-sparkles { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .qz-sparkle {
    position: absolute;
    width: 4px; height: 4px;
    background: #a78bfa;
    border-radius: 50%;
    animation: qzSparkle ease-out infinite;
  }
  @keyframes qzSparkle {
    0% { transform: scale(0) translateY(0); opacity: 0; }
    20% { transform: scale(1) translateY(-10px); opacity: 1; }
    100% { transform: scale(0) translateY(-40px); opacity: 0; }
  }

  .qz-success-check {
    margin: 0 auto 8px;
    width: 80px; height: 80px;
    background: rgba(52,211,153,0.08);
    border: 2px solid rgba(52,211,153,0.15);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    animation: qzCheckPop .5s cubic-bezier(.16,1,.3,1);
  }
  @keyframes qzCheckPop {
    0% { transform: scale(0); }
    60% { transform: scale(1.15); }
    100% { transform: scale(1); }
  }
  .qz-check-path {
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    animation: qzCheckDraw .6s .3s ease forwards;
  }
  @keyframes qzCheckDraw {
    to { stroke-dashoffset: 0; }
  }

  .qz-palpite-result {
    display: flex; flex-direction: column; align-items: center;
    margin-top: 16px; padding: 16px 24px;
    background: rgba(124,58,237,0.08);
    border: 1px solid rgba(124,58,237,0.15);
    border-radius: 16px;
  }
  .qz-palpite-result-label {
    font-size: 11px; font-weight: 700;
    color: rgba(167,139,250,0.5);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .qz-palpite-result-value {
    font-size: 32px; font-weight: 800; color: #a78bfa;
    font-family: "SF Mono", "Fira Code", ui-monospace, monospace;
    letter-spacing: 3px;
  }

  /* Return bar */
  .qz-return-bar {
    height: 3px; width: 100%; max-width: 180px; margin: 0 auto;
    background: rgba(139,92,246,.08);
    border-radius: 4px; overflow: hidden;
  }
  .qz-return-bar-fill {
    height: 100%; width: 100%;
    background: linear-gradient(90deg,#7c3aed,#a78bfa);
    border-radius: 4px;
    animation: qzReturn 6s linear forwards;
  }
  @keyframes qzReturn { from { width: 100%; } to { width: 0%; } }

  .text-center { text-align: center; }

  /* Form header with event context */
  .qz-form-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(139,92,246,0.08);
  }
  .qz-form-event-name {
    font-size: 12px;
    font-weight: 700;
    color: rgba(167,139,250,0.5);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .qz-form-day-pill {
    font-size: 10px;
    font-weight: 700;
    color: #a78bfa;
    background: rgba(124,58,237,0.12);
    padding: 3px 10px;
    border-radius: 100px;
    letter-spacing: 0.5px;
  }

  /* Optional fields divider */
  .qz-optional-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 6px 0 10px;
  }
  .qz-optional-divider-line {
    flex: 1;
    height: 1px;
    background: rgba(139,92,246,0.1);
  }
  .qz-optional-divider-text {
    font-size: 10px;
    font-weight: 700;
    color: rgba(167,139,250,0.25);
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }
  .qz-optional-grid .qz-field {
    margin-bottom: 8px;
  }
  .qz-optional-grid .qz-input {
    padding: 11px 16px;
    font-size: 15px;
  }
  .qz-optional-grid .qz-input-icon-pad {
    padding-left: 40px;
  }

  /* User pill on palpite screen */
  .qz-user-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    margin: 0 auto 12px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(167,139,250,0.6);
    background: rgba(124,58,237,0.08);
    border: 1px solid rgba(124,58,237,0.1);
    border-radius: 100px;
    width: fit-content;
    display: flex;
    justify-content: center;
  }

  /* Display value animation */
  .qz-display-has-value {
    color: #c4b5fd;
    text-shadow: 0 0 50px rgba(167,139,250,0.4);
  }

  /* Confetti */
  .qz-confetti-wrap {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .qz-confetti-piece {
    position: absolute;
    top: 30%;
    animation: qzConfetti ease-out forwards;
    opacity: 0;
  }
  @keyframes qzConfetti {
    0% { transform: translateY(0) rotate(0deg) scale(0); opacity: 0; }
    15% { opacity: 1; transform: scale(1); }
    100% { transform: translateY(200px) rotate(720deg) scale(0.3); opacity: 0; }
  }

  /* Thanks name */
  .qz-thanks-name {
    margin-top: 12px;
    font-size: 15px;
    font-weight: 700;
    color: rgba(196,181,253,0.5);
  }

  /* Day badge */
  .qz-day-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    margin-bottom: 16px;
    font-size: 12px;
    font-weight: 700;
    color: #a78bfa;
    background: rgba(124, 58, 237, 0.1);
    border: 1px solid rgba(124, 58, 237, 0.2);
    border-radius: 100px;
    letter-spacing: 0.5px;
  }
  .qz-day-badge-icon { display: flex; color: rgba(167,139,250,0.5); }

  /* Quick-fill buttons row */
  .qz-quickfill {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
  }
  .qz-btn-quickfill {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 700;
    color: #a78bfa;
    background: rgba(124, 58, 237, 0.06);
    border: 1.5px dashed rgba(124, 58, 237, 0.2);
    border-radius: 12px;
    cursor: pointer;
    transition: all .2s;
    font-family: inherit;
  }
  .qz-btn-quickfill:active {
    transform: scale(0.96);
    background: rgba(124, 58, 237, 0.15);
  }
  .qz-btn-quickfill-active {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.25);
    color: #f87171;
  }

  /* QR Scanner */
  .qz-scanner-wrap {
    margin-bottom: 14px;
    border-radius: 16px;
    overflow: hidden;
    border: 1.5px solid rgba(124, 58, 237, 0.15);
    background: #000;
  }
  .qz-scanner-wrap #qz-qr-reader {
    width: 100%;
  }
  .qz-scanner-wrap #qz-qr-reader video {
    border-radius: 0 !important;
  }
  .qz-scanner-hint {
    text-align: center;
    font-size: 11px;
    color: rgba(167, 139, 250, 0.5);
    padding: 8px;
    margin: 0;
    background: rgba(18, 8, 38, 0.8);
  }

  /* Geo button inside city input */
  .qz-geo-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(124, 58, 237, 0.12);
    border: 1px solid rgba(124, 58, 237, 0.2);
    border-radius: 8px;
    color: #a78bfa;
    cursor: pointer;
    transition: all .2s;
    padding: 0;
  }
  .qz-geo-btn:active {
    transform: translateY(-50%) scale(0.9);
    background: rgba(124, 58, 237, 0.25);
  }
  .qz-geo-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .qz-input-geo-pad { padding-right: 48px; }
  .qz-spinner-sm {
    width: 14px; height: 14px;
    border-width: 1.5px;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .qz-card { padding: 28px 20px; border-radius: 24px; }
    .qz-welcome-glass { border-radius: 24px; }
    .qz-welcome-inner { padding: 32px 20px; border-radius: 18px; }
    .qz-welcome-title { font-size: 28px; }
    .qz-welcome-cta { padding: 16px 32px; font-size: 15px; }
    .qz-numpad-key { height: 52px; font-size: 20px; }
    .qz-display-value { font-size: 40px; }
  }
  @media (min-width: 768px) {
    .qz-welcome-title { font-size: 44px; }
    .qz-welcome-desc { font-size: 18px; }
  }
  @media (min-height: 900px) {
    .qz-card { padding: 44px 32px; }
  }
`;
