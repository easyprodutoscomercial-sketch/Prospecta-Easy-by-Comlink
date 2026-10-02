'use client';

import { useCallback, useEffect, useState } from 'react';

// Bloqueia o CRM ate a pessoa autorizar notificacao. Sem botao de dispensar:
// o prompt antigo tinha "depois" e gravava no navegador, por isso ninguem ativou.
//
// Limites de navegador que o codigo precisa contornar:
// - requestPermission() so abre o balao se a permissao estiver em "default".
//   Se ja foi negada, NENHUM codigo reabre — tem que ser na mao, nas config. do site.
// - iPhone/iPad: push so funciona se o site estiver na Tela de Inicio (PWA).
//   No Safari da aba comum nao existe push, por decisao da Apple.

type Estado = 'checando' | 'ok' | 'pedir' | 'negado' | 'ios-instalar' | 'sem-suporte';

function base64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function navegador() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'edge';
  if (/OPR\//.test(ua)) return 'opera';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'chrome';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua)) return 'safari';
  return 'outro';
}

const COMO_REATIVAR: Record<string, string[]> = {
  chrome: ['Clique no cadeado 🔒 ao lado do endereço', 'Toque em "Notificações"', 'Mude para "Permitir"', 'Atualize a página (F5)'],
  edge: ['Clique no cadeado 🔒 ao lado do endereço', 'Abra "Permissões para este site"', 'Mude "Notificações" para "Permitir"', 'Atualize a página (F5)'],
  opera: ['Clique no cadeado 🔒 ao lado do endereço', 'Abra as permissões do site', 'Mude "Notificações" para "Permitir"', 'Atualize a página'],
  firefox: ['Clique no cadeado 🔒 ao lado do endereço', 'Em "Enviar notificações", clique no X para limpar o bloqueio', 'Atualize a página (F5)'],
  safari: ['Menu Safari → Configurações → Sites', 'Escolha "Notificações" na lateral', 'Ache controleicrm.vercel.app e mude para "Permitir"', 'Atualize a página'],
  outro: ['Abra as configurações do site no seu navegador', 'Procure "Notificações" e mude para "Permitir"', 'Atualize a página'],
};

export default function PushObrigatorio() {
  const [estado, setEstado] = useState<Estado>('checando');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [adiado, setAdiado] = useState(false);

  // Trava sem saida deixava o CRM inutilizavel pra quem ja tinha clicado
  // "Bloquear" no navegador: a tela cobria tudo e nao havia como sair.
  // Continua insistindo (volta a cada login), mas nao impede o trabalho.
  useEffect(() => {
    try { setAdiado(sessionStorage.getItem('push_adiado') === '1'); } catch { /* sessao sem storage */ }
  }, []);

  function adiar() {
    try { sessionStorage.setItem('push_adiado', '1'); } catch { /* ignora */ }
    setAdiado(true);
  }

  const inscrever = useCallback(async () => {
    setOcupado(true);
    setErro(null);
    try {
      const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!chave) { setErro('Chave de notificação não configurada no servidor.'); return; }

      const permissao = await Notification.requestPermission();
      if (permissao === 'denied') { setEstado('negado'); return; }
      if (permissao !== 'granted') { setErro('Você precisa clicar em "Permitir" para continuar.'); return; }

      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const existente = await reg.pushManager.getSubscription();
      const sub = existente || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(chave),
      });

      // a rota espera { endpoint, keys } no topo do corpo
      const r = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!r.ok) { setErro('Não consegui registrar seu aparelho. Tente de novo.'); return; }

      setEstado('ok');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao ativar as notificações.');
    } finally {
      setOcupado(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Sem a chave publica no build, nenhum aparelho consegue se inscrever:
      // cobrar a ativacao so prende o vendedor numa tela que nunca resolve.
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) { setEstado('sem-suporte'); return; }

      const ehIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const instalado = window.matchMedia('(display-mode: standalone)').matches
        || (navigator as unknown as { standalone?: boolean }).standalone === true;

      if (ehIOS && !instalado) { setEstado('ios-instalar'); return; }
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setEstado('sem-suporte'); return;
      }
      if (Notification.permission === 'denied') { setEstado('negado'); return; }

      if (Notification.permission === 'granted') {
        // ja autorizou: garante que este aparelho esta registrado no servidor
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager.getSubscription();
          if (sub) { setEstado('ok'); return; }
        } catch { /* cai no fluxo de inscricao abaixo */ }
        await inscrever();
        return;
      }
      setEstado('pedir');
    })();
  }, [inscrever]);

  if (estado === 'ok' || estado === 'checando' || estado === 'sem-suporte' || adiado) return null;

  const Caixa = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-[#1e0f35] p-6 shadow-2xl">
        {children}
        <button
          onClick={adiar}
          className="mt-4 w-full py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Agora não — voltar a trabalhar
        </button>
        <p className="text-[10px] text-neutral-600 text-center mt-1">
          Volta a pedir no próximo acesso.
        </p>
      </div>
    </div>
  );

  if (estado === 'ios-instalar') {
    return (
      <Caixa>
        <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">Falta um passo no iPhone</p>
        <h2 className="text-xl font-bold text-white mb-3">Adicione o Controlei à Tela de Início</h2>
        <p className="text-sm text-neutral-300 mb-4">
          No iPhone e no iPad, a Apple só entrega notificação para sites instalados na tela de início.
          Pelo Safari normal não funciona. São 15 segundos:
        </p>
        <ol className="space-y-2 text-sm text-neutral-200 mb-4">
          {['Toque no botão Compartilhar (quadrado com seta para cima), na barra de baixo',
            'Role e toque em "Adicionar à Tela de Início"',
            'Confirme em "Adicionar"',
            'Feche o Safari e abra o Controlei pelo ícone novo',
            'Autorize a notificação quando ele pedir'].map((p, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-amber-500 text-[#1a0a2e] text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-amber-300/80">Enquanto isso, o CRM continua avisando pela própria tela.</p>
      </Caixa>
    );
  }

  if (estado === 'negado') {
    const passos = COMO_REATIVAR[navegador()] || COMO_REATIVAR.outro;
    return (
      <Caixa>
        <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Notificação bloqueada</p>
        <h2 className="text-xl font-bold text-white mb-3">Você precisa reativar na mão</h2>
        <p className="text-sm text-neutral-300 mb-4">
          A notificação deste site foi bloqueada neste navegador. Por segurança, nenhum site consegue
          pedir de novo sozinho — só você pode liberar:
        </p>
        <ol className="space-y-2 text-sm text-neutral-200 mb-4">
          {passos.map((p, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
        <button onClick={() => window.location.reload()} className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold">
          Já liberei — verificar de novo
        </button>
      </Caixa>
    );
  }

  return (
    <Caixa>
      <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">Obrigatório para usar o CRM</p>
      <h2 className="text-xl font-bold text-white mb-3">Ative as notificações</h2>
      <p className="text-sm text-neutral-300 mb-5">
        O Controlei avisa quando um contato está parado, quando uma ação vence e quando
        aparece cliente novo no balcão. Sem isso você perde negócio — e não dá pra usar o sistema.
      </p>
      <button
        onClick={inscrever}
        disabled={ocupado}
        className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#1a0a2e] text-sm font-bold disabled:opacity-60"
      >
        {ocupado ? 'Ativando...' : 'Ativar notificações agora'}
      </button>
      {erro && <p className="mt-3 text-xs text-red-300">{erro}</p>}
      <p className="mt-3 text-xs text-neutral-500">
        O navegador vai abrir uma caixa no alto da tela. Clique em <strong className="text-neutral-300">Permitir</strong>.
      </p>
    </Caixa>
  );
}
