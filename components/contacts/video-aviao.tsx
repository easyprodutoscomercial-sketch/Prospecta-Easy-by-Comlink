'use client';

import { useEffect, useRef, useState } from 'react';

// Video do King Air da Comlink por cima da janela de indicacoes (pedido do dono em 06/10):
// a subida toca quando o consultor manda buscar e a descida quando a busca termina.
// Subida: video do dono com o comandante Mario embarcando em frente ao predio da Comlink e o
// King Air decolando (cortado em 6s a pedido do dono, 06/10). Descida: trecho final (4,4s) do video de decolagem e pouso.
// Ficam em public/noprecache/: o app instalado nao baixa os videos antes de alguem buscar.
// Sem som: o navegador nao deixa video tocar sozinho com som, e turbina no escritorio incomoda.

export type VideoAviaoTipo = 'decolagem' | 'pouso';

export const SRC_VIDEO: Record<VideoAviaoTipo, string> = {
  decolagem: '/noprecache/videos/aviao-subida-capitao.mp4', // nome novo a cada troca: o antigo nao fica no cache de ninguem
  pouso: '/noprecache/videos/aviao-pouso.mp4',
};

const MS_SAIDA = 450;
const MS_LIMITE = 13000; // video travado ou rede lenta: nao prende a tela (o mais longo tem 6s)

interface Props {
  tipo: VideoAviaoTipo;
  legenda: string;
  onFim: () => void;
}

export default function VideoAviao({ tipo, legenda, onFim }: Props) {
  const [saindo, setSaindo] = useState(false);
  const acabou = useRef(false);
  const onFimRef = useRef(onFim);
  onFimRef.current = onFim;

  const fechar = () => {
    if (acabou.current) return;
    acabou.current = true;
    setSaindo(true);
    setTimeout(() => onFimRef.current(), MS_SAIDA);
  };

  useEffect(() => {
    // quem pediu menos animacao no sistema nao ve o video
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { onFimRef.current(); return; }
    const limite = setTimeout(fechar, MS_LIMITE);
    return () => clearTimeout(limite);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tela inteira (fixed), por cima de tudo: z-[1200] porque as camadas do Leaflet usam 400-700
  return (
    <div className={`fixed inset-0 z-[1200] overflow-hidden bg-black transition-opacity duration-[450ms] ${saindo ? 'opacity-0' : 'opacity-100'}`}>
      <video
        src={SRC_VIDEO[tipo]}
        poster={SRC_VIDEO[tipo].replace('.mp4', '.jpg')}
        autoPlay muted playsInline
        onEnded={fechar}
        onError={fechar}
        className="h-full w-full object-cover"
      />
      {/* legenda no alto: o video do comandante ja traz "Mario, nosso capitao" gravado embaixo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 via-black/30 to-transparent px-6 pt-6 pb-16 pr-28">
        <p className="text-lg md:text-2xl font-bold text-white drop-shadow">{legenda}</p>
      </div>
      <button onClick={fechar}
        className="absolute right-4 top-4 rounded-lg border border-white/30 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-black/60">
        Pular
      </button>
    </div>
  );
}
