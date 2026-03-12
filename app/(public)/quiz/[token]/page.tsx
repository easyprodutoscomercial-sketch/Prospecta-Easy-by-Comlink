'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';

type Screen = 'loading' | 'welcome' | 'form' | 'palpite' | 'thanks' | 'paused' | 'error';
type ScanMode = null | 'card';

interface QuizConfig {
  id: string;
  quiz_ativo: boolean;
  nome_evento: string;
  descricao_desafio: string;
  mensagem_pausa: string;
  total_participantes: number;
}

/* Components defined OUTSIDE to avoid remount on every keystroke */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`qz-card qz-fade ${className}`}>{children}</div>;
}

function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const h = size === 'md' ? 40 : 28;
  return <img src="/logo_comlink_200px.png" alt="Easy by Comlink" style={{ height: h }} className="qz-logo-img" />;
}

export default function QuizPublicPage() {
  const params = useParams();
  const token = params.token as string;

  const [screen, setScreen] = useState<Screen>('loading');
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [telefone, setTelefone] = useState('');
  const [palpite, setPalpite] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [duplicateMsg, setDuplicateMsg] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode>(null);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const focusLoopRef = useRef<number | null>(null);
  const scanModeRef = useRef<ScanMode>(null);
  const sendingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setNome(''); setEmpresa(''); setTelefone(''); setPalpite('');
    setError(''); setDuplicateMsg('');
  };

  /* ── Stop camera ── */
  const stopCamera = useCallback(() => {
    if (focusLoopRef.current) { cancelAnimationFrame(focusLoopRef.current); focusLoopRef.current = null; }
    scanModeRef.current = null;
    sendingRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanMode(null);
    setScanning(false);
    setScanStatus('');
    setCapturedImage(null);
  }, []);

  /* ── Sharpness detection (Laplacian variance) ── */
  const measureSharpness = (ctx: CanvasRenderingContext2D, w: number, h: number): number => {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const sw = w;
    const sh = h;
    // Convert to grayscale and compute Laplacian variance
    const gray: number[] = [];
    for (let i = 0; i < d.length; i += 4) {
      gray.push(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    }
    let sum = 0;
    let sum2 = 0;
    let count = 0;
    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const idx = y * sw + x;
        // Laplacian: 4*center - top - bottom - left - right
        const lap = 4 * gray[idx] - gray[idx - sw] - gray[idx + sw] - gray[idx - 1] - gray[idx + 1];
        sum += lap;
        sum2 += lap * lap;
        count++;
      }
    }
    const mean = sum / count;
    return (sum2 / count) - (mean * mean); // variance
  };

  /* ── Capture frame, show print, then send to AI ── */
  const sendToAI = async (canvas: HTMLCanvasElement) => {
    if (sendingRef.current || scanModeRef.current !== 'card') return;
    sendingRef.current = true;

    // 1) Take the print — freeze the captured image on screen
    const imageUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(imageUrl);
    setScanning(true);
    setScanStatus('Cartão capturado! Extraindo dados...');
    setError('');

    // Stop camera stream (we already have the photo)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (focusLoopRef.current) { cancelAnimationFrame(focusLoopRef.current); focusLoopRef.current = null; }

    // 2) Convert and send to AI
    canvas.toBlob(async (blob) => {
      if (!blob || scanModeRef.current !== 'card') { sendingRef.current = false; return; }
      try {
        const formData = new FormData();
        formData.append('image', blob, 'card.jpg');
        const res = await fetch('/api/scan-card', { method: 'POST', body: formData });
        if (scanModeRef.current !== 'card') { sendingRef.current = false; return; }
        const data = await res.json();
        console.log('scan-card response:', JSON.stringify(data));
        let empresa_val = data.company || data.org || data.organization || data.empresa || '';
        // Se não achou empresa, tenta extrair do domínio do email
        if (!empresa_val) {
          const email = data.email || data.e_mail || '';
          if (email && email.includes('@')) {
            const domain = email.split('@')[1]?.split('.')[0] || '';
            if (domain && !['gmail', 'hotmail', 'outlook', 'yahoo', 'icloud', 'live', 'uol', 'bol', 'terra', 'ig', 'aol', 'protonmail', 'zoho'].includes(domain.toLowerCase())) {
              // Capitaliza o nome do domínio como nome da empresa
              empresa_val = domain.charAt(0).toUpperCase() + domain.slice(1);
            }
          }
        }
        const nome_val = data.name || data.nome || '';
        const phone_val = data.phone || data.telefone || data.tel || '';
        if (res.ok && (nome_val || phone_val || empresa_val)) {
          if (nome_val) setNome(nome_val);
          if (empresa_val) setEmpresa(empresa_val);
          if (phone_val) {
            const digits = phone_val.replace(/\D/g, '');
            const local = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
            setTelefone(formatPhone(local));
          }
          stopCamera();
        } else {
          // Failed — reopen camera to try again
          setScanStatus('Não consegui ler. Tentando de novo...');
          setTimeout(() => { retryCapture(); }, 2000);
        }
      } catch {
        setScanStatus('Erro de conexão. Tentando de novo...');
        setTimeout(() => { retryCapture(); }, 2000);
      }
    }, 'image/jpeg', 0.92);
  };

  /* ── Retry: reopen camera after failed read ── */
  const retryCapture = async () => {
    sendingRef.current = false;
    setCapturedImage(null);
    setScanning(false);
    setScanStatus('');
    if (scanModeRef.current !== 'card') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        videoRef.current.onloadeddata = () => { startFocusLoop(); };
      }
    } catch {
      stopCamera();
      setError('Câmera não disponível.');
    }
  };

  /* ── Focus detection loop ── */
  const startFocusLoop = useCallback(() => {
    let sharpCount = 0;
    const SHARP_THRESHOLD = 120; // minimum sharpness to consider "in focus"
    const STABLE_FRAMES = 8;     // consecutive sharp frames before capture
    let lastCheck = 0;

    const loop = () => {
      if (scanModeRef.current !== 'card') return;
      focusLoopRef.current = requestAnimationFrame(loop);

      const now = performance.now();
      if (now - lastCheck < 200) return; // check ~5fps
      lastCheck = now;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || sendingRef.current) return;

      // Draw small version for analysis
      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, w, h);

      const sharpness = measureSharpness(ctx, w, h);

      if (sharpness >= SHARP_THRESHOLD) {
        sharpCount++;
        setScanStatus(`Focando... ${Math.min(100, Math.round((sharpCount / STABLE_FRAMES) * 100))}%`);
        if (sharpCount >= STABLE_FRAMES) {
          // Capture full resolution
          const fullScale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.round(video.videoWidth * fullScale);
          canvas.height = Math.round(video.videoHeight * fullScale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          sharpCount = 0;
          sendToAI(canvas);
        }
      } else {
        sharpCount = Math.max(0, sharpCount - 2); // decay fast when blurry
        setScanStatus('Segure o cartão parado...');
      }
    };

    focusLoopRef.current = requestAnimationFrame(loop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  /* ── Open camera for card scan ── */
  const openCardCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      scanModeRef.current = 'card';
      setScanMode('card');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          // Start focus detection after video is playing
          videoRef.current.onloadeddata = () => { startFocusLoop(); };
        }
      });
    } catch {
      setError('Câmera não disponível. Verifique as permissões.');
    }
  };

  // Cleanup camera on unmount or screen change
  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const handleFormSubmit = () => {
    if (!nome.trim() || nome.trim().length < 2) { setError('Digite seu nome completo'); return; }
    if (!empresa.trim() || empresa.trim().length < 2) { setError('Digite o nome da sua empresa'); return; }
    if (telefone.replace(/\D/g, '').length < 10) { setError('Digite um telefone válido'); return; }
    setError(''); setScreen('palpite');
  };

  const handleNumpad = (digit: string) => {
    if (digit === 'del') setPalpite(palpite.slice(0, -1));
    else if (digit === 'C') setPalpite('');
    else if (palpite.length < 7) setPalpite(palpite + digit);
  };

  const handleSubmitPalpite = async () => {
    if (!palpite || Number(palpite) < 1) { setError('Digite um palpite válido'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, nome: nome.trim(), empresa: empresa.trim(),
          telefone: telefone.replace(/\D/g, ''), palpite: Number(palpite),
        }),
      });
      const data = await res.json();
      if (data.duplicate) { setDuplicateMsg(data.message); setScreen('thanks'); }
      else if (data.success) { setScreen('thanks'); }
      else { setError(data.error || 'Erro ao enviar. Tente novamente.'); }
    } catch { setError('Erro de conexão. Tente novamente.'); }
    setSubmitting(false);
  };

  useEffect(() => {
    if (screen === 'thanks') {
      const t = setTimeout(() => { resetForm(); setScreen('welcome'); fetchConfig(); }, 5000);
      return () => clearTimeout(t);
    }
  }, [screen]);

  /* ── LOADING ── */
  if (screen === 'loading') return (
    <div className="qz-page">
      <div className="qz-spinner" />
      <style>{styles}</style>
    </div>
  );

  /* ── ERROR ── */
  if (screen === 'error') return (
    <div className="qz-page">
      <Card className="text-center">
        <Logo />
        <div className="qz-spacer" />
        <div className="qz-icon-circle qz-icon-red">!</div>
        <h1 className="qz-title">Quiz não encontrado</h1>
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
        <div className="qz-icon-circle qz-icon-yellow">II</div>
        <h1 className="qz-title">{config?.nome_evento || 'Quiz'}</h1>
        <p className="qz-sub">{config?.mensagem_pausa || 'O quiz está pausado no momento.'}</p>
      </Card>
      <style>{styles}</style>
    </div>
  );

  /* ── WELCOME (fullscreen hero) ── */
  if (screen === 'welcome') return (
    <div className="qz-welcome" onClick={() => setScreen('form')}>
      {/* Animated background particles */}
      <div className="qz-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="qz-particle" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 6}s`,
            animationDuration: `${6 + Math.random() * 8}s`,
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
            opacity: 0.15 + Math.random() * 0.25,
          }} />
        ))}
      </div>

      {/* Glow ring behind trophy */}
      <div className="qz-glow-ring" />

      {/* Content */}
      <div className="qz-welcome-content qz-fade">
        {/* Logo top */}
        <img src="/logo_comlink_200px.png" alt="Easy by Comlink" className="qz-welcome-logo" />

        {/* Trophy */}
        <div className="qz-welcome-trophy">
          <svg width="100" height="100" viewBox="0 0 24 24" fill="none">
            <path d="M8 21h8m-4-4v4" stroke="url(#tg)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M7.5 5h9v4a4.5 4.5 0 01-9 0V5z" stroke="url(#tg)" strokeWidth="1.5" fill="rgba(124,58,237,0.08)" />
            <path d="M6 5H4a2 2 0 00-2 2v1a4 4 0 004 4" stroke="url(#tg)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M18 5h2a2 2 0 012 2v1a4 4 0 01-4 4" stroke="url(#tg)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M7.5 13a4.5 4.5 0 009 0v1H7.5v-1z" stroke="url(#tg)" strokeWidth="1.5" />
            <defs>
              <linearGradient id="tg" x1="2" y1="5" x2="22" y2="21">
                <stop stopColor="#a78bfa" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Event name */}
        <h1 className="qz-welcome-title">{config?.nome_evento || 'Quiz'}</h1>

        {/* Challenge description */}
        <p className="qz-welcome-desc">{config?.descricao_desafio || 'Participe do nosso desafio!'}</p>

        {/* Counter */}
        {(config?.total_participantes || 0) > 0 && (
          <div className="qz-welcome-counter">
            <span className="qz-welcome-counter-num">{config?.total_participantes}</span>
            <span className="qz-welcome-counter-label"> participações</span>
          </div>
        )}

        {/* CTA Button */}
        <button className="qz-welcome-cta" onClick={(e) => { e.stopPropagation(); setScreen('form'); }}>
          <span>PARTICIPAR AGORA</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>

        <p className="qz-welcome-hint">Toque em qualquer lugar para começar</p>
      </div>

      <style>{styles}</style>
    </div>
  );

  return (
    <div className="qz-page">
      {/* ── FORM ── */}
      {screen === 'form' && (
        <Card>
          <div className="text-center"><Logo size="sm" /></div>
          <div className="qz-spacer-sm" />

          <h2 className="qz-section-title">Preencha seus dados</h2>
          <p className="qz-section-sub">Precisamos dessas informações para validar sua participação.</p>
          <div className="qz-spacer-sm" />

          {/* ── Scan button ── */}
          <button onClick={openCardCamera} className="qz-scan-btn qz-scan-btn-full">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            <span>Escanear Cartão de Visita</span>
          </button>
          <div className="qz-spacer-sm" />

          <div className="qz-field">
            <label className="qz-label">Nome completo</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder="Digite seu nome" autoComplete="name" className="qz-input" />
          </div>
          <div className="qz-field">
            <label className="qz-label">Empresa</label>
            <input type="text" value={empresa} onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Nome da empresa" autoComplete="organization" className="qz-input" />
          </div>
          <div className="qz-field">
            <label className="qz-label">Telefone / WhatsApp</label>
            <input type="tel" value={telefone} onChange={(e) => setTelefone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000" autoComplete="tel" className="qz-input" />
          </div>

          {error && <p className="qz-error">{error}</p>}
          <div className="qz-spacer-sm" />

          <button onClick={handleFormSubmit} className="qz-btn qz-btn-primary qz-btn-lg">CONTINUAR</button>
          <button onClick={() => { resetForm(); setScreen('welcome'); }} className="qz-btn qz-btn-ghost">Voltar</button>
        </Card>
      )}

      {/* ── Card Camera Overlay ── */}
      {scanMode === 'card' && (
        <div className="qz-camera-overlay qz-fade">
          <button onClick={stopCamera} className="qz-camera-close-float">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Live camera OR captured photo */}
          {capturedImage ? (
            <img src={capturedImage} alt="Cartão capturado" className="qz-captured-img qz-flash" />
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="qz-camera-video-full" />

              {/* Animated scan elements */}
              <div className="qz-scan-corners">
                <div className="qz-corner qz-corner-tl" />
                <div className="qz-corner qz-corner-tr" />
                <div className="qz-corner qz-corner-bl" />
                <div className="qz-corner qz-corner-br" />
              </div>
              <div className="qz-scan-line" />

              {/* Floating particles */}
              <div className="qz-scan-particles">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="qz-scan-dot" style={{
                    left: `${10 + Math.random() * 80}%`,
                    top: `${10 + Math.random() * 80}%`,
                    animationDelay: `${Math.random() * 4}s`,
                    animationDuration: `${2 + Math.random() * 3}s`,
                  }} />
                ))}
              </div>
            </>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {error && <p className="qz-camera-error">{error}</p>}

          {/* Bottom status */}
          <div className="qz-camera-bottom">
            <div className="qz-scan-emoji">
              {capturedImage ? '🤖' : scanning ? '🔍' : '📸'}
            </div>
            <div className="qz-scan-status-text">
              {capturedImage ? (
                <><span className="qz-spinner-sm" /><span>{scanStatus}</span></>
              ) : (
                <span className="qz-scan-hint">{scanStatus || 'Mostre o cartão pra câmera!'}</span>
              )}
            </div>
            {!capturedImage && (
              <div className="qz-scan-fun-msgs">
                <div className="qz-fun-scroll">
                  <span>Pode ser de cabeça pra baixo, eu leio assim mesmo 😎</span>
                  <span>Cartão amassado? Sem problema! 💪</span>
                  <span>Segura firme que eu tô lendo... 🔍</span>
                  <span>IA trabalhando pra você! 🚀</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PALPITE ── */}
      {screen === 'palpite' && (
        <Card>
          <div className="text-center"><Logo size="sm" /></div>
          <div className="qz-spacer-sm" />

          <h2 className="qz-section-title">Qual é o seu palpite?</h2>
          <p className="qz-section-sub">{config?.descricao_desafio || 'Digite seu palpite'}</p>
          <div className="qz-spacer-sm" />

          <div className="qz-display">
            <span className="qz-display-value">{palpite || '0'}</span>
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
            {submitting ? 'ENVIANDO...' : 'ENVIAR PALPITE'}
          </button>
          <button onClick={() => { setPalpite(''); setError(''); setScreen('form'); }} className="qz-btn qz-btn-ghost">Voltar</button>
        </Card>
      )}

      {/* ── THANKS ── */}
      {screen === 'thanks' && (
        <Card className="text-center">
          <Logo />
          <div className="qz-spacer" />

          <div className="qz-success-ring qz-fade">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="qz-title" style={{ color: '#34d399' }}>
            {duplicateMsg ? 'Opa!' : 'Obrigado!'}
          </h1>
          <p className="qz-sub" style={{ fontSize: 16 }}>
            {duplicateMsg || 'Sua participação foi registrada com sucesso!'}
          </p>

          {!duplicateMsg && palpite && (
            <div className="qz-palpite-badge">
              Seu palpite: <strong>{palpite}</strong>
            </div>
          )}

          <div className="qz-spacer" />
          <div className="qz-return-bar"><div className="qz-return-bar-fill" /></div>
          <p className="qz-sub" style={{ fontSize: 12, marginTop: 8 }}>Voltando ao início...</p>
        </Card>
      )}

      <style>{styles}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════ */
const styles = `
  /* ── WELCOME SCREEN (fullscreen hero) ── */
  .qz-welcome {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    background:
      radial-gradient(ellipse 80% 60% at 50% 40%, rgba(124,58,237,0.18) 0%, transparent 70%),
      radial-gradient(ellipse 60% 50% at 30% 80%, rgba(88,28,135,0.12) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 80% 20%, rgba(139,92,246,0.08) 0%, transparent 60%),
      linear-gradient(180deg, #0a0118 0%, #0d0520 40%, #120826 100%);
  }

  /* Floating particles */
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

  /* Glow ring */
  .qz-glow-ring {
    position: absolute;
    top: 50%; left: 50%;
    width: 320px; height: 320px;
    transform: translate(-50%, -55%);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.04) 50%, transparent 70%);
    animation: qzGlowPulse 4s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes qzGlowPulse {
    0%, 100% { transform: translate(-50%, -55%) scale(1); opacity: 0.6; }
    50%      { transform: translate(-50%, -55%) scale(1.15); opacity: 1; }
  }

  /* Welcome content */
  .qz-welcome-content {
    position: relative; z-index: 1;
    text-align: center;
    padding: 40px 32px;
    max-width: 500px;
  }
  .qz-welcome-logo {
    height: 44px; object-fit: contain;
    margin-bottom: 48px;
    opacity: 0.9;
  }
  .qz-welcome-trophy {
    margin: 0 auto 24px;
    width: 100px; height: 100px;
    animation: qzFloat 3s ease-in-out infinite;
    filter: drop-shadow(0 0 30px rgba(124,58,237,0.4));
  }
  .qz-welcome-title {
    font-size: 40px;
    font-weight: 900;
    color: #fff;
    margin: 0 0 12px;
    letter-spacing: -0.5px;
    line-height: 1.1;
    text-shadow: 0 0 40px rgba(124,58,237,0.3);
  }
  .qz-welcome-desc {
    font-size: 17px;
    color: rgba(196, 181, 253, 0.75);
    margin: 0 0 8px;
    line-height: 1.5;
  }
  .qz-welcome-counter {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    margin-top: 8px; margin-bottom: 40px;
    padding: 8px 20px;
    background: rgba(124, 58, 237, 0.12);
    border: 1px solid rgba(124, 58, 237, 0.18);
    border-radius: 100px;
  }
  .qz-welcome-counter-num {
    font-size: 22px; font-weight: 900; color: #a78bfa;
    font-variant-numeric: tabular-nums;
  }
  .qz-welcome-counter-label {
    font-size: 13px; color: rgba(167, 139, 250, 0.55);
  }

  /* CTA button */
  .qz-welcome-cta {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 18px 40px;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 1px;
    color: #fff;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    border: none;
    border-radius: 60px;
    cursor: pointer;
    box-shadow:
      0 0 0 0 rgba(124,58,237,0.4),
      0 8px 32px rgba(124,58,237,0.4),
      inset 0 1px 0 rgba(255,255,255,0.15);
    animation: qzCtaPulse 2.5s ease-in-out infinite;
    transition: transform .15s;
  }
  .qz-welcome-cta:active { transform: scale(0.95); }
  @keyframes qzCtaPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.4), 0 8px 32px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.15); }
    50%      { box-shadow: 0 0 0 12px rgba(124,58,237,0), 0 8px 40px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.15); }
  }

  .qz-welcome-hint {
    margin-top: 24px;
    font-size: 12px;
    color: rgba(167, 139, 250, 0.3);
    animation: qzBlink 2s ease-in-out infinite;
  }
  @keyframes qzBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* ── PAGE (form/palpite/thanks) ── */
  .qz-page {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: radial-gradient(ellipse at 50% 0%, #1e0f3a 0%, #0d0520 60%, #080312 100%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  /* Card */
  .qz-card {
    width: 100%;
    max-width: 420px;
    background: rgba(30, 15, 53, 0.85);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(139, 92, 246, 0.15);
    border-radius: 24px;
    padding: 36px 28px;
    box-shadow:
      0 0 0 1px rgba(139, 92, 246, 0.06),
      0 24px 48px rgba(0, 0, 0, 0.45),
      0 0 120px rgba(139, 92, 246, 0.06);
  }

  /* Animations */
  .qz-fade { animation: qzFadeUp .45s cubic-bezier(.16,1,.3,1); }
  @keyframes qzFadeUp {
    from { opacity: 0; transform: translateY(24px) scale(.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes qzFloat {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-10px); }
  }

  /* Spinner */
  .qz-spinner {
    width: 40px; height: 40px;
    border: 3px solid rgba(139, 92, 246, 0.2);
    border-top-color: #a78bfa;
    border-radius: 50%;
    animation: spin .7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Logo */
  .qz-logo-img { object-fit: contain; display: inline-block; }

  /* Typography */
  .qz-title { font-size: 24px; font-weight: 700; color: #fff; margin: 12px 0 6px; }
  .qz-sub { font-size: 14px; color: rgba(196, 181, 253, 0.55); margin: 0; line-height: 1.5; }
  .qz-section-title { font-size: 20px; font-weight: 700; color: #fff; margin: 0 0 4px; text-align: center; }
  .qz-section-sub { font-size: 13px; color: rgba(196, 181, 253, 0.5); margin: 0; text-align: center; line-height: 1.4; }

  /* Spacers */
  .qz-spacer    { height: 24px; }
  .qz-spacer-sm { height: 16px; }

  /* Icon circles */
  .qz-icon-circle {
    width: 64px; height: 64px; margin: 0 auto 8px;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 28px; font-weight: 800;
  }
  .qz-icon-red    { background: rgba(239,68,68,.12); color: #f87171; border: 2px solid rgba(239,68,68,.2); }
  .qz-icon-yellow { background: rgba(234,179,8,.12); color: #facc15; border: 2px solid rgba(234,179,8,.2); }

  /* Form */
  .qz-field { margin-bottom: 14px; }
  .qz-label {
    display: block; font-size: 12px; font-weight: 600;
    color: rgba(196, 181, 253, 0.6); margin-bottom: 6px;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .qz-input {
    width: 100%; box-sizing: border-box;
    background: rgba(13, 5, 32, 0.7);
    border: 1.5px solid rgba(139, 92, 246, 0.2);
    border-radius: 14px;
    padding: 14px 16px;
    font-size: 16px; color: #fff;
    caret-color: #a78bfa;
    outline: none; transition: border-color .2s, box-shadow .2s;
    -webkit-appearance: none;
  }
  .qz-input:focus {
    border-color: rgba(167, 139, 250, 0.5);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.1);
  }
  .qz-input::placeholder { color: rgba(139, 92, 246, 0.25); }

  .qz-error { text-align: center; color: #f87171; font-size: 13px; margin: 8px 0 0; font-weight: 500; }

  /* Display */
  .qz-display {
    background: rgba(13, 5, 32, 0.8);
    border: 2px solid rgba(139, 92, 246, 0.2);
    border-radius: 20px; padding: 20px;
    text-align: center; margin-bottom: 16px;
  }
  .qz-display-value {
    font-size: 42px; font-weight: 800; color: #a78bfa;
    font-family: "SF Mono", "Fira Code", monospace;
    letter-spacing: 4px;
    text-shadow: 0 0 30px rgba(167, 139, 250, 0.3);
  }

  /* Numpad */
  .qz-numpad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 4px; }
  .qz-numpad-key {
    height: 56px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 700; color: #e2e0ff;
    background: rgba(30, 15, 53, 0.6);
    border: 1px solid rgba(139, 92, 246, 0.15);
    border-radius: 14px; cursor: pointer;
    transition: background .15s, transform .1s;
    user-select: none; -webkit-user-select: none;
  }
  .qz-numpad-key:active { transform: scale(.93); background: rgba(139, 92, 246, 0.15); }
  .qz-key-clear { color: #f87171 !important; font-size: 16px !important; font-weight: 800 !important; background: rgba(239,68,68,.08) !important; border-color: rgba(239,68,68,.15) !important; }
  .qz-key-del { color: #fbbf24 !important; background: rgba(251,191,36,.06) !important; border-color: rgba(251,191,36,.12) !important; }

  /* Buttons */
  .qz-btn {
    display: block; width: 100%; border: none; cursor: pointer;
    font-family: inherit; font-weight: 700;
    transition: all .2s; user-select: none; -webkit-user-select: none;
  }
  .qz-btn:active { transform: scale(.97); }
  .qz-btn-primary {
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    color: #fff; border-radius: 16px;
    box-shadow: 0 4px 20px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
  }
  .qz-btn-primary:hover { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
  .qz-btn-primary:disabled { opacity: .45; cursor: not-allowed; transform: none; }
  .qz-btn-lg { padding: 16px; font-size: 16px; letter-spacing: 0.5px; }
  .qz-btn-ghost { background: none; color: rgba(196,181,253,.4); font-size: 13px; padding: 10px; border-radius: 12px; }
  .qz-btn-ghost:hover { color: rgba(196,181,253,.7); }

  /* Success */
  .qz-success-ring { margin: 0 auto 8px; width: 64px; height: 64px; }
  .qz-palpite-badge {
    display: inline-block; margin-top: 12px; padding: 8px 20px;
    background: rgba(139,92,246,.1); border: 1px solid rgba(139,92,246,.2);
    border-radius: 100px; font-size: 15px; color: #c4b5fd;
  }
  .qz-palpite-badge strong { font-size: 20px; color: #a78bfa; font-family: "SF Mono","Fira Code",monospace; margin-left: 4px; }

  /* Return bar */
  .qz-return-bar { height: 4px; width: 100%; max-width: 200px; margin: 0 auto; background: rgba(139,92,246,.1); border-radius: 4px; overflow: hidden; }
  .qz-return-bar-fill { height: 100%; width: 100%; background: linear-gradient(90deg,#7c3aed,#a78bfa); border-radius: 4px; animation: qzReturn 5s linear forwards; }
  @keyframes qzReturn { from { width: 100%; } to { width: 0%; } }

  .text-center { text-align: center; }

  /* ── Scan button ── */
  .qz-scan-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 16px;
    font-size: 14px;
    font-weight: 600;
    color: #c4b5fd;
    background: rgba(124, 58, 237, 0.08);
    border: 1.5px solid rgba(124, 58, 237, 0.2);
    border-radius: 14px;
    cursor: pointer;
    transition: all .2s;
    font-family: inherit;
  }
  .qz-scan-btn-full { width: 100%; }
  .qz-scan-btn:active {
    transform: scale(0.95);
    background: rgba(124, 58, 237, 0.15);
  }

  /* ── Camera Overlay ── */
  .qz-camera-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #000;
  }
  .qz-camera-close-float {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 10;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    cursor: pointer;
  }
  .qz-camera-video-full {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .qz-captured-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  /* Camera flash effect */
  .qz-flash {
    animation: qzFlash 0.6s ease-out;
  }
  @keyframes qzFlash {
    0%  { filter: brightness(3); }
    40% { filter: brightness(1); }
    100% { filter: brightness(1); }
  }

  /* ── Animated corners ── */
  .qz-scan-corners {
    position: absolute;
    top: 3%;
    left: 3%;
    right: 3%;
    bottom: 18%;
    pointer-events: none;
    z-index: 2;
    animation: qzCornersBreath 3s ease-in-out infinite;
  }
  @keyframes qzCornersBreath {
    0%, 100% { top: 3%; left: 3%; right: 3%; bottom: 18%; }
    50% { top: 2%; left: 2%; right: 2%; bottom: 16%; }
  }
  .qz-corner {
    position: absolute;
    width: 60px;
    height: 60px;
    border-color: rgba(167, 139, 250, 0.85);
    border-style: solid;
    border-width: 0;
  }
  .qz-corner-tl { top: 0; left: 0; border-top-width: 5px; border-left-width: 5px; border-radius: 18px 0 0 0; }
  .qz-corner-tr { top: 0; right: 0; border-top-width: 5px; border-right-width: 5px; border-radius: 0 18px 0 0; }
  .qz-corner-bl { bottom: 0; left: 0; border-bottom-width: 5px; border-left-width: 5px; border-radius: 0 0 0 18px; }
  .qz-corner-br { bottom: 0; right: 0; border-bottom-width: 5px; border-right-width: 5px; border-radius: 0 0 18px 0; }

  /* ── Scan line ── */
  .qz-scan-line {
    position: absolute;
    left: 4%;
    right: 4%;
    height: 3px;
    background: linear-gradient(90deg, transparent, rgba(167,139,250,0.8), rgba(139,92,246,1), rgba(167,139,250,0.8), transparent);
    z-index: 2;
    pointer-events: none;
    box-shadow: 0 0 20px rgba(139,92,246,0.6), 0 0 50px rgba(139,92,246,0.3);
    animation: qzScanMove 2.5s ease-in-out infinite;
  }
  @keyframes qzScanMove {
    0%   { top: 5%; opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { top: 80%; opacity: 0; }
  }

  /* ── Floating dots ── */
  .qz-scan-particles { position: absolute; inset: 0; pointer-events: none; z-index: 1; overflow: hidden; }
  .qz-scan-dot {
    position: absolute;
    width: 4px;
    height: 4px;
    background: #a78bfa;
    border-radius: 50%;
    animation: qzDotFloat ease-in-out infinite;
    opacity: 0;
  }
  @keyframes qzDotFloat {
    0%, 100% { opacity: 0; transform: scale(0) translateY(0); }
    30% { opacity: 0.6; transform: scale(1) translateY(-10px); }
    70% { opacity: 0.4; transform: scale(0.8) translateY(10px); }
  }

  /* ── Bottom status bar ── */
  .qz-camera-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px 20px 28px;
    background: linear-gradient(transparent, rgba(0,0,0,0.85));
    color: #fff;
    z-index: 3;
  }
  .qz-scan-emoji {
    font-size: 36px;
    animation: qzEmojiBounce 1.5s ease-in-out infinite;
  }
  @keyframes qzEmojiBounce {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-8px) scale(1.1); }
  }
  .qz-scan-status-text {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 700;
    min-height: 24px;
  }
  .qz-scan-hint {
    animation: qzPulseText 2s ease-in-out infinite;
  }
  @keyframes qzPulseText {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  /* ── Fun messages carousel ── */
  .qz-scan-fun-msgs {
    height: 20px;
    overflow: hidden;
    margin-top: 4px;
  }
  .qz-fun-scroll {
    display: flex;
    flex-direction: column;
    animation: qzFunScroll 12s ease-in-out infinite;
  }
  .qz-fun-scroll span {
    height: 20px;
    line-height: 20px;
    font-size: 12px;
    color: rgba(196, 181, 253, 0.5);
    text-align: center;
    white-space: nowrap;
  }
  @keyframes qzFunScroll {
    0%, 20%   { transform: translateY(0); }
    25%, 45%  { transform: translateY(-20px); }
    50%, 70%  { transform: translateY(-40px); }
    75%, 95%  { transform: translateY(-60px); }
    100%      { transform: translateY(0); }
  }
  .qz-spinner-sm {
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin .7s linear infinite;
    flex-shrink: 0;
  }
  .qz-camera-error {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    background: rgba(239,68,68,0.85);
    border-radius: 12px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    z-index: 4;
    text-align: center;
    max-width: 90%;
  }
  .qz-camera-status-hint {
    padding: 14px;
    text-align: center;
    color: rgba(196, 181, 253, 0.5);
    font-size: 13px;
    background: rgba(0,0,0,0.8);
  }

  /* Responsive */
  @media (max-width: 480px) {
    .qz-card { padding: 28px 20px; border-radius: 20px; }
    .qz-welcome-title { font-size: 30px; }
    .qz-welcome-cta { padding: 16px 32px; font-size: 16px; }
    .qz-numpad-key { height: 50px; font-size: 20px; }
    .qz-display-value { font-size: 36px; }
  }
  @media (min-width: 768px) {
    .qz-welcome-title { font-size: 48px; }
    .qz-welcome-desc { font-size: 19px; }
    .qz-welcome-trophy { width: 120px; height: 120px; }
    .qz-welcome-trophy svg { width: 120px; height: 120px; }
  }
  @media (min-height: 900px) {
    .qz-card { padding: 44px 32px; }
  }
`;
