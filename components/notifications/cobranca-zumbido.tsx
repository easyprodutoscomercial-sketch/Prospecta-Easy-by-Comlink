'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Zumbido estilo MSN: quando chega cobranca nova, a tela inteira treme,
// toca um som curto e o titulo da aba fica piscando ate a pessoa voltar.
// O piscar da aba e o que pega quem deixou o CRM em segundo plano.

const INTERVALO_MS = 60_000; // de quanto em quanto tempo olha se chegou cobranca
const DURACAO_TREMOR_MS = 900;

export default function CobrancaZumbido() {
  const router = useRouter();
  const [pendentes, setPendentes] = useState(0);
  const [tremendo, setTremendo] = useState(false);
  const ultimoRef = useRef<number | null>(null);
  const tituloOriginal = useRef<string>('');

  // --- som: gerado na hora, sem arquivo. Dois bipes curtos, igual cutucada. ---
  function tocar() {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      [0, 0.18].forEach((atraso) => {
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.connect(vol);
        vol.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime + atraso);
        vol.gain.setValueAtTime(0.0001, ctx.currentTime + atraso);
        vol.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + atraso + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + atraso + 0.14);
        osc.start(ctx.currentTime + atraso);
        osc.stop(ctx.currentTime + atraso + 0.16);
      });
      setTimeout(() => ctx.close().catch(() => {}), 800);
    } catch {
      // navegador bloqueou audio sem interacao previa — o tremor e o titulo seguem valendo
    }
  }

  function zumbir() {
    setTremendo(true);
    tocar();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]); // celular
    setTimeout(() => setTremendo(false), DURACAO_TREMOR_MS);
  }

  // --- verifica periodicamente se o numero de cobrancas subiu ---
  useEffect(() => {
    tituloOriginal.current = document.title;
    let vivo = true;

    async function olhar() {
      try {
        const r = await fetch('/api/notifications/count', { cache: 'no-store' });
        const { count } = await r.json();
        if (!vivo) return;
        setPendentes(count || 0);
        if (ultimoRef.current !== null && count > ultimoRef.current) zumbir();
        ultimoRef.current = count || 0;
      } catch {
        /* sem rede: tenta de novo no proximo ciclo */
      }
    }

    olhar();
    const t = setInterval(olhar, INTERVALO_MS);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  // --- titulo da aba piscando: funciona mesmo com o CRM em segundo plano ---
  useEffect(() => {
    if (pendentes <= 0) {
      if (tituloOriginal.current) document.title = tituloOriginal.current;
      return;
    }
    let alterna = false;
    const t = setInterval(() => {
      document.title = alterna
        ? `(${pendentes}) COBRANCA PENDENTE`
        : `(${pendentes}) ⚠️ VOLTE PRO CRM`;
      alterna = !alterna;
    }, 1000);
    return () => {
      clearInterval(t);
      if (tituloOriginal.current) document.title = tituloOriginal.current;
    };
  }, [pendentes]);

  // --- tremor na tela inteira ---
  useEffect(() => {
    document.body.classList.toggle('zumbido-tremor', tremendo);
    return () => document.body.classList.remove('zumbido-tremor');
  }, [tremendo]);

  if (pendentes <= 0) return null;

  return (
    <button
      onClick={() => router.push('/kanban')}
      className={`fixed bottom-4 right-4 z-[90] flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-lg transition-colors
        ${pendentes >= 10
          ? 'bg-red-600 hover:bg-red-500 border-red-400/50 text-white animate-pulse'
          : 'bg-amber-500 hover:bg-amber-400 border-amber-300/50 text-[#1a0a2e]'}`}
      title="Ver cobrancas pendentes"
    >
      <span className="text-lg leading-none">🔔</span>
      <span className="text-sm font-bold">
        {pendentes} {pendentes === 1 ? 'cobranca' : 'cobrancas'} esperando voce
      </span>
    </button>
  );
}
