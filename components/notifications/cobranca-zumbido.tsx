'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Aviso de cobranca: a borda da tela fica acesa (parada) enquanto houver
// cobranca pendente, e uma lingueta pequena pendurada no topo mostra quantas sao.
// Quando chega cobranca nova a borda pisca por 5s, com bipe.
// A borda NAO pode ficar animada o tempo todo: o raio girando de 06/10 travou as
// maquinas dos vendedores (ver comentario em app/globals.css).
// O titulo da aba fica piscando: e o que pega quem deixou o CRM em segundo plano.
//
// Antes era um botao flutuante no canto de cima a direita, por cima de tudo:
// tampava Filtros/Expandir do kanban (reclamacao do dono em 05/10). O raio fica
// numa camada que deixa o clique passar (pointer-events: none) — nao trava nada.

const INTERVALO_MS = 30_000; // de quanto em quanto tempo olha se chegou cobranca
const DURACAO_ALERTA_MS = 5_000; // 5s de borda piscando: chama atencao sem atrapalhar o trabalho

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
    // Som e vibracao acompanham as rajadas de tremor (uma a cada 1,5s),
    // em vez de bipar uma vez so e deixar 20s de tremor mudo.
    tocar();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    const rajada = setInterval(() => {
      tocar();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }, 3000);
    setTimeout(() => {
      clearInterval(rajada);
      setTremendo(false);
    }, DURACAO_ALERTA_MS);
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
        // Treme quando o numero sobe E tambem na primeira carga, se ja houver
        // cobranca pendente. Quem abre o CRM devendo leva o zumbido na cara.
        const primeiraVez = ultimoRef.current === null;
        if ((primeiraVez && count > 0) || (!primeiraVez && count > ultimoRef.current!)) zumbir();
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

  if (pendentes <= 0) return null;

  const classe = `raio-cobranca${pendentes >= 10 ? ' vermelho' : ''}${tremendo ? ' alerta' : ''}`;
  const texto = `${pendentes} ${pendentes === 1 ? 'cobrança esperando' : 'cobranças esperando'}`;

  return (
    <>
      {/* camadas so de luz: o clique passa direto (pointer-events: none no CSS) */}
      <div className={classe} aria-hidden>
        <div className="raio-cobranca-fundo" />
        <div className="raio-cobranca-linha" />
      </div>
      {/* Lingueta no TOPO, nao embaixo: o rodape tem as barras de acao (Modo Foco,
          acoes em massa) com botoes centralizados. No computador fica no meio da
          barra do topo (vazio); no celular, entre o logo e o sininho. */}
      <button
        onClick={() => router.push('/kanban')}
        className={`${classe} raio-cobranca-lingueta fixed top-0 right-14 lg:right-auto lg:left-1/2 lg:-translate-x-1/2`}
        title={`${texto} — ver no kanban`}
      >
        <span>🔔</span>
        <span className="lg:hidden">{pendentes}</span>
        <span className="hidden lg:inline">{texto} · ver</span>
      </button>
    </>
  );
}
