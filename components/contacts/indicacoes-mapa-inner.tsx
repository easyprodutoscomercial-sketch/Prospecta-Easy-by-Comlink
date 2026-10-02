'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';

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
}

// CARTO passou a devolver "API KEY REQUIRED" em todo bloco (conferido em 02/10).
// Esri Dark Gray: fundo e nomes de cidade em camadas separadas, nomes por cima das rotas.
const ESRI_FUNDO = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const ESRI_NOMES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';

const BRASIL: [number, number] = [-14.235, -51.925];
const MS_VOO = 1700;

const casa = L.divIcon({ html: '<div class="mapa-ind-casa"></div>', className: '', iconSize: [16, 16], iconAnchor: [8, 8] });

function pino(numero: number, novo: boolean) {
  return L.divIcon({
    html: `<div class="mapa-ind-pino${novo ? ' novo' : ''}">${numero}</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// desenho aponta pra cima (norte); girar() roda pelo rumo do voo direto no
// elemento — trocar o icone a cada quadro recriaria o DOM 60x por segundo
const aviao = L.divIcon({
  html: `<div class="mapa-ind-aviao"><svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#fbbf24">
    <path d="M12 2c.8 0 1.4.7 1.4 1.6v5.6l7.6 4.6v2l-7.6-2.4v4.5l2.2 1.7v1.6L12 20.3l-3.6.9v-1.6l2.2-1.7v-4.5L3 15.8v-2l7.6-4.6V3.6C10.6 2.7 11.2 2 12 2z"/>
  </svg></div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function girar(m: L.Marker, graus: number) {
  const el = m.getElement()?.querySelector<HTMLElement>('.mapa-ind-aviao');
  if (el) el.style.transform = `rotate(${graus}deg)`;
}

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

export default function IndicacoesMapaInner({ origem, nomeCliente, pousados, destino, voando, status, onPousou }: Props) {
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
  // a janela redesenha a cada consulta de andamento (4s) e recria o objeto destino:
  // o voo so recomeca quando muda a EMPRESA de destino, nao a cada redesenho
  const destinoRef = useRef(destino);
  destinoRef.current = destino;
  const destinoId = destino?.id ?? null;

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

  // 3) aviao: circula enquanto a IA pesquisa, voa em curva ate a proxima empresa
  useEffect(() => {
    const map = mapa.current;
    if (!map || !voando) return;
    const m = L.marker(posicao.current, { icon: aviao, zIndexOffset: 1000, interactive: false }).addTo(map);
    let quadro = 0;
    const inicio = performance.now();
    const destino = destinoRef.current;

    if (!destino) {
      const o = inicial.current.origem;
      const circular = (t: number) => {
        const a = ((t - inicio) / 4500) * Math.PI * 2;
        const p: [number, number] = [o[0] + 0.07 * Math.sin(a), o[1] + 0.09 * Math.cos(a)];
        girar(m, rumo(posicao.current, p));
        m.setLatLng(p);
        posicao.current = p;
        quadro = requestAnimationFrame(circular);
      };
      quadro = requestAnimationFrame(circular);
    } else {
      const rota = arco(posicao.current, destino.coords, 60);
      const voar = (t: number) => {
        const k = Math.min(1, (t - inicio) / MS_VOO);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // acelera e freia
        const i = Math.min(rota.length - 2, Math.floor(e * (rota.length - 1)));
        const p = rota[i + 1];
        girar(m, rumo(rota[i], p));
        m.setLatLng(p);
        posicao.current = p;
        if (k < 1) quadro = requestAnimationFrame(voar);
        else onPousouRef.current(destino.id);
      };
      quadro = requestAnimationFrame(voar);
    }

    return () => {
      cancelAnimationFrame(quadro);
      m.remove();
    };
  }, [voando, destinoId]);

  return (
    <div className="mapa-ind relative h-full w-full">
      <div ref={caixa} className="absolute inset-0" style={{ background: '#0f0a1e' }} />
      <div className="mapa-ind-vinheta" />
      {status && <div className="mapa-ind-caixa left-3 top-3 border-amber-400/40 text-amber-100 font-semibold">{status}</div>}
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
