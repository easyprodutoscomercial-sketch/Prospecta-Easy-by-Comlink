'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { svgAviao, svgSombra } from './aviao-comlink';

// Mapa da busca de indicacoes com IA: o aviao circula sobre a cidade do cliente
// enquanto a IA pesquisa e voa ate cada empresa achada. So depois do pouso a
// empresa aparece na lista (onPousou) — e o que faz a lista encher "uma a uma".
// Estilos (tinta roxa, pinos, pulso, aviao) ficam em globals.css, prefixo .mapa-ind.
//
// Leaflet puro, sem react-leaflet: o MapContainer do react-leaflet quebrava com a
// montagem dupla do React em modo estrito ("Map container is being reused by
// another instance" e "reading 'appendChild'"). Aqui cada montagem cria o mapa e
// a limpeza o destroi (map.remove), entao montar duas vezes e seguro.

export interface PontoMapa {
  id: string;
  numero: number; // mesmo numero do cartao na lista
  nome: string;
  coords: [number, number];
}

interface Props {
  origem: [number, number];
  nomeCliente: string;
  pousados: PontoMapa[];
  destino: PontoMapa | null; // proxima empresa da fila; null = circulando
  voando: boolean; // busca terminada: mapa fica so com os pontos, sem aviao
  status: string;
  onPousou: (id: string) => void;
  onPousoFinal?: () => void; // aviao voltou pra casa e sumiu: a janela toca o video do pouso
}

// CARTO passou a devolver "API KEY REQUIRED" em todo bloco (conferido em 02/10).
// Esri Dark Gray: fundo e nomes de cidade em camadas separadas, nomes por cima das rotas.
const ESRI_FUNDO = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const ESRI_NOMES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';

const BRASIL: [number, number] = [-14.235, -51.925];
const MS_VOO = 1700;
const MS_DECOLAGEM = 2600;
const MS_POUSO = 2800;
const MS_SUMIR = 600;
const TAM_AVIAO = 88;

const casa = L.divIcon({ html: '<div class="mapa-ind-casa"></div>', className: '', iconSize: [16, 16], iconAnchor: [8, 8] });

function pino(numero: number, novo: boolean) {
  return L.divIcon({
    html: `<div class="mapa-ind-pino${novo ? ' novo' : ''}">${numero}</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// Aviao da Comlink (components/contacts/aviao-comlink.ts) com sombra no chao.
// O desenho aponta pro norte; pose() gira, encolhe e afasta a sombra direto no
// elemento — trocar o icone a cada quadro recriaria o DOM 60x por segundo.
// Tudo e transform/opacity num elemento de 88px: a placa de video faz sozinha.
const aviao = L.divIcon({
  html: `<div class="mapa-ind-aviao"><div class="mapa-ind-aviao-sombra">${svgSombra(TAM_AVIAO)}</div><div class="mapa-ind-aviao-corpo">${svgAviao(TAM_AVIAO)}</div></div>`,
  className: '',
  iconSize: [TAM_AVIAO, TAM_AVIAO],
  iconAnchor: [TAM_AVIAO / 2, TAM_AVIAO / 2],
});

// altitude 0 = no chao (pequeno, sombra colada embaixo), 1 = em cruzeiro (sombra longe)
function pose(m: L.Marker, graus: number, altitude: number) {
  const raiz = m.getElement();
  const corpo = raiz?.querySelector<HTMLElement>('.mapa-ind-aviao-corpo');
  const sombra = raiz?.querySelector<HTMLElement>('.mapa-ind-aviao-sombra');
  const escala = 0.42 + 0.58 * altitude;
  if (corpo) corpo.style.transform = `rotate(${graus}deg) scale(${escala})`;
  if (sombra) {
    const d = 2 + 20 * altitude;
    sombra.style.transform = `translate(${d}px, ${d * 1.15}px) rotate(${graus}deg) scale(${escala * 0.92})`;
    sombra.style.opacity = String(0.5 - 0.28 * altitude);
  }
}

const suave = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };

function rumo(de: [number, number], para: [number, number]) {
  const dy = para[0] - de[0];
  const dx = (para[1] - de[1]) * Math.cos((de[0] * Math.PI) / 180);
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

// rota em curva (como rota de aviao), em vez de reta
function arco(a: [number, number], b: [number, number], n = 40): [number, number][] {
  const c: [number, number] = [(a[0] + b[0]) / 2 - (b[1] - a[1]) * 0.25, (a[1] + b[1]) / 2 + (b[0] - a[0]) * 0.25];
  const r: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    r.push([
      (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
      (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
    ]);
  }
  return r;
}

const SEM_INTERACAO: L.MapOptions = {
  zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false,
  doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false,
};

export default function IndicacoesMapaInner({ origem, nomeCliente, pousados, destino, voando, status, onPousou, onPousoFinal }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const caixaMini = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const camadas = useRef<{ rotas: L.LayerGroup; pinos: L.LayerGroup } | null>(null);
  const posicao = useRef<[number, number]>(origem);
  const qtdEnquadrada = useRef(0);
  const primeiroVisto = useRef<string | null>(null);
  const inicial = useRef({ origem, pousados, nomeCliente });
  const onPousouRef = useRef(onPousou);
  onPousouRef.current = onPousou;
  const onPousoFinalRef = useRef(onPousoFinal);
  onPousoFinalRef.current = onPousoFinal;
  // a janela redesenha a cada consulta de andamento (4s) e recria o objeto destino:
  // o voo so recomeca quando muda a EMPRESA de destino, nao a cada redesenho
  const destinoRef = useRef(destino);
  destinoRef.current = destino;
  const voandoRef = useRef(voando);
  voandoRef.current = voando;
  // fase do aviao so pro letreiro (decolando/pousando); o resto vive em refs, fora do React
  const [faseUI, setFaseUI] = useState<'decolando' | 'pousando' | null>(null);
  const marcador = useRef<L.Marker | null>(null);
  const quadro = useRef(0);
  const rumoAtual = useRef(0);
  const [pousos, setPousos] = useState(0); // cada pouso completo: se outra busca ja comecou, decola de novo

  // 1) cria o mapa (e o mini mapa do Brasil); a limpeza destroi os dois
  useEffect(() => {
    if (!caixa.current || !caixaMini.current) return;
    const { origem: o, pousados: ps, nomeCliente: nome } = inicial.current;

    // zoom pedido pelo dono: botoes + e -, rodinha do mouse e pinca no celular
    const map = L.map(caixa.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: true })
      .setView(BRASIL, 4);
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(map);
    L.tileLayer(ESRI_FUNDO, { className: 'mapa-ind-fundo' }).addTo(map);
    // nomes das cidades acima das rotas (overlayPane) e abaixo dos pinos (markerPane)
    L.tileLayer(ESRI_NOMES, { pane: 'shadowPane' }).addTo(map);
    const rotas = L.layerGroup().addTo(map);
    const pinos = L.layerGroup().addTo(map);
    L.marker(o, { icon: casa, zIndexOffset: 500 })
      .bindTooltip(`${nome} (cliente)`, { direction: 'top', offset: [0, -10], className: 'mapa-ind-rotulo' })
      .addTo(map);
    mapa.current = map;
    camadas.current = { rotas, pinos };
    qtdEnquadrada.current = ps.length;

    // abre no Brasil inteiro e mergulha na regiao; se ja ha pontos, enquadra todos
    const abertura = setTimeout(() => {
      if (ps.length > 1) map.flyToBounds(L.latLngBounds([o, ...ps.map((p) => p.coords)]).pad(0.3), { duration: 2, maxZoom: 10 });
      else map.flyTo(o, 9, { duration: 2 });
    }, 400);

    // zoom 2 num quadro de 112px cobre ~39 graus de longitude: o Brasil inteiro (no 3 cortava)
    const mini = L.map(caixaMini.current, SEM_INTERACAO).setView([-14.5, -52], 2);
    L.tileLayer(ESRI_FUNDO, { className: 'mapa-ind-fundo' }).addTo(mini);
    L.circleMarker(o, { radius: 5, color: '#fbbf24', weight: 2, fillColor: '#f59e0b', fillOpacity: 1 }).addTo(mini);

    // a janela muda de largura quando o mapa aparece: sem isso ficam faixas cinzas
    const observador = new ResizeObserver(() => { map.invalidateSize(); mini.invalidateSize(); });
    observador.observe(caixa.current);

    return () => {
      clearTimeout(abertura);
      observador.disconnect();
      map.remove();
      mini.remove();
      mapa.current = null;
      camadas.current = null;
    };
  }, []);

  // 2) pinos numerados e rotas encadeadas (cliente -> 1 -> 2 -> ...)
  useEffect(() => {
    const map = mapa.current;
    const c = camadas.current;
    if (!map || !c) return;
    c.rotas.clearLayers();
    c.pinos.clearLayers();
    let anterior = inicial.current.origem;
    const ultimo = pousados[pousados.length - 1]?.id;
    for (const p of pousados) {
      L.polyline(arco(anterior, p.coords), { color: '#fbbf24', weight: 2, opacity: 0.55, dashArray: '2 6', lineCap: 'round' })
        .addTo(c.rotas);
      L.marker(p.coords, { icon: pino(p.numero, voando && p.id === ultimo) })
        .bindTooltip(`${p.numero}. ${p.nome}`, { direction: 'top', offset: [0, -12], className: 'mapa-ind-rotulo' })
        .addTo(c.pinos);
      anterior = p.coords;
    }
    // trocou de busca no historico (outra lista): enquadra a nova de uma vez
    const primeiro = pousados[0]?.id ?? null;
    if (primeiro && primeiroVisto.current && primeiro !== primeiroVisto.current && pousados.length > 1) {
      qtdEnquadrada.current = pousados.length;
      map.flyToBounds(L.latLngBounds([inicial.current.origem, ...pousados.map((p) => p.coords)]).pad(0.3), { duration: 1.2, maxZoom: 10 });
    }
    primeiroVisto.current = primeiro;
    // empresa em cidade vizinha fora da tela: afasta o zoom pra caber todo mundo
    if (pousados.length >= 2 && pousados.length !== qtdEnquadrada.current) {
      qtdEnquadrada.current = pousados.length;
      const b = L.latLngBounds([inicial.current.origem, ...pousados.map((p) => p.coords)]);
      if (!map.getBounds().contains(b)) map.flyToBounds(b.pad(0.3), { duration: 1, maxZoom: 10 });
    }
  }, [pousados, voando]);

  // 3) aviao: decola da casa do cliente quando a busca comeca, circula enquanto a IA
  //    pesquisa, voa em curva ate cada empresa achada e, no fim, volta e pousa na casa
  //    do cliente (pedido do dono em 06/10). Um laco so, que le a fase a cada quadro:
  //    a janela redesenha a cada 4s e isso nao pode interromper decolagem nem pouso.
  useEffect(() => {
    if (!voando || marcador.current || !mapa.current) return;
    const map = mapa.current;
    const o = inicial.current.origem;
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const dur = (ms: number) => (reduzido ? 1 : ms);
    const m = L.marker(o, { icon: aviao, zIndexOffset: 1000, interactive: false }).addTo(map);
    marcador.current = m;
    posicao.current = o;

    type Fase =
      | { nome: 'decolando'; t0: number; fim: [number, number] }
      | { nome: 'circulando'; t0: number; centro: [number, number] }
      | { nome: 'indo'; t0: number; rota: [number, number][]; id: string }
      | { nome: 'pousando'; t0: number; rota: [number, number][] }
      | { nome: 'sumindo'; t0: number };
    // pista: corre pro leste e sai no ponto onde comeca o circulo sobre a cidade
    const pista: [number, number] = [o[0], o[1] + 0.09];
    let fase: Fase = { nome: 'decolando', t0: performance.now(), fim: pista };
    rumoAtual.current = rumo(o, pista);
    pose(m, rumoAtual.current, 0);
    setFaseUI('decolando');

    // curva suave: o nariz vira aos poucos em vez de saltar de rumo
    const apontar = (de: [number, number], para: [number, number]) => {
      if (de[0] === para[0] && de[1] === para[1]) return rumoAtual.current;
      const alvo = rumo(de, para);
      const diff = ((alvo - rumoAtual.current + 540) % 360) - 180;
      rumoAtual.current += diff * 0.18;
      return rumoAtual.current;
    };
    const mover = (p: [number, number], altitude: number) => {
      const g = apontar(posicao.current, p);
      m.setLatLng(p);
      posicao.current = p;
      pose(m, g, altitude);
    };
    const circularAqui = (t: number): Fase => {
      // o circulo passa pelo ponto onde o aviao esta (antes ele "teletransportava" pra cidade do cliente)
      const p = posicao.current;
      return { nome: 'circulando', t0: t, centro: [p[0], p[1] - 0.09] };
    };

    const tick = (t: number) => {
      if (fase.nome === 'decolando') {
        const k = Math.min(1, (t - fase.t0) / dur(MS_DECOLAGEM));
        const e = k * k; // acelera na pista
        mover([o[0] + (fase.fim[0] - o[0]) * e, o[1] + (fase.fim[1] - o[1]) * e], suave((k - 0.35) / 0.65));
        if (k >= 1) { fase = circularAqui(t); setFaseUI(null); }
      } else if (fase.nome === 'circulando') {
        const destino = destinoRef.current;
        if (!voandoRef.current) {
          fase = { nome: 'pousando', t0: t, rota: arco(posicao.current, o, 90) };
          setFaseUI('pousando');
        } else if (destino) {
          fase = { nome: 'indo', t0: t, rota: arco(posicao.current, destino.coords, 60), id: destino.id };
        } else {
          const a = ((t - fase.t0) / 4500) * Math.PI * 2;
          mover([fase.centro[0] + 0.07 * Math.sin(a), fase.centro[1] + 0.09 * Math.cos(a)], 1);
        }
      } else if (fase.nome === 'indo') {
        const k = Math.min(1, (t - fase.t0) / MS_VOO);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // acelera e freia
        const i = Math.min(fase.rota.length - 2, Math.floor(e * (fase.rota.length - 1)));
        mover(fase.rota[i + 1], 1);
        if (k >= 1) { onPousouRef.current(fase.id); fase = circularAqui(t); }
      } else if (fase.nome === 'pousando') {
        const k = Math.min(1, (t - fase.t0) / dur(MS_POUSO));
        const e = 1 - Math.pow(1 - k, 2.2); // vem rapido e freia na pista
        const i = Math.min(fase.rota.length - 2, Math.floor(e * (fase.rota.length - 1)));
        mover(fase.rota[i + 1], 1 - suave((k - 0.3) / 0.5)); // desce e toca o chao antes do fim
        if (k >= 1) fase = { nome: 'sumindo', t0: t };
      } else {
        const k = Math.min(1, (t - fase.t0) / dur(MS_SUMIR));
        m.setOpacity(1 - k);
        if (k >= 1) {
          m.remove();
          marcador.current = null;
          setFaseUI(null);
          setPousos((n) => n + 1);
          onPousoFinalRef.current?.();
          return; // fim do laco; se outra busca comecar, o efeito decola de novo
        }
      }
      quadro.current = requestAnimationFrame(tick);
    };
    quadro.current = requestAnimationFrame(tick);
    // sem limpeza aqui de proposito: o laco segue ate o pouso mesmo com a janela redesenhando
  }, [voando, pousos]);

  // fechou a janela: para o laco e tira o aviao
  useEffect(() => () => {
    cancelAnimationFrame(quadro.current);
    marcador.current?.remove();
    marcador.current = null;
  }, []);

  return (
    <div className="mapa-ind relative h-full w-full">
      <div ref={caixa} className="absolute inset-0" style={{ background: '#0f0a1e' }} />
      <div className="mapa-ind-vinheta" />
      {faseUI ? (
        <div className="mapa-ind-caixa left-3 top-3 border-teal-400/50 text-teal-100 font-semibold">
          {faseUI === 'decolando' ? `🛫 Decolando de ${nomeCliente}...` : `🛬 Pousando de volta em ${nomeCliente}`}
        </div>
      ) : status && <div className="mapa-ind-caixa left-3 top-3 border-amber-400/40 text-amber-100 font-semibold">{status}</div>}
      <div className="absolute right-3 top-3 z-[500] w-28 h-28 rounded-xl overflow-hidden border border-purple-500/40 shadow-lg shadow-black/50 pointer-events-none">
        <div ref={caixaMini} className="h-full w-full" style={{ background: '#0f0a1e' }} />
      </div>
      <div className="mapa-ind-caixa left-3 bottom-3 border-purple-500/30 text-purple-100 flex gap-3 items-center">
        <span><i className="mapa-ind-bola bg-amber-500" />Cliente</span>
        <span><i className="mapa-ind-bola bg-emerald-500" />Indicadas ({pousados.length})</span>
        <span className="text-[9px] text-neutral-500">mapa © Esri</span>
      </div>
    </div>
  );
}
