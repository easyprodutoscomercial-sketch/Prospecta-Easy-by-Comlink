'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getContactCoords } from '@/lib/data/brazil-cities-coords';
import type { PontoMapa } from './indicacoes-mapa-inner';
import { recarregarIndicacoesBuscadas } from '@/lib/hooks/use-indicacoes-buscadas';

// Leaflet mexe em window: so carrega no navegador
const MapaBusca = dynamic(() => import('./indicacoes-mapa-inner'), { ssr: false, loading: () => null });

interface Empresa {
  osmId: string;
  nome: string;
  tipo: string;
  endereco: string | null;
  cidade: string | null;
  telefone: string | null;
  site: string | null;
  lat: number | null;
  lon: number | null;
  // so nas indicacoes da IA
  razao_social?: string | null;
  cnpj?: string | null;
  segmento?: string | null;
  descricao?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  instagram?: string | null;
  bairro?: string | null;
  estado?: string | null;
  cep?: string | null;
  fonte?: string | null;
  jaNoCrm?: boolean;
  nota?: number | null;
  motivo?: string | null;
  porte?: string | null; // porte oficial da Receita
  porteConfirmado?: boolean; // buscas antes de 06/10 nao tem este campo
  porte_indicio?: string | null;
  contatoId?: string | null; // rascunho criado quando a IA achou
  noFunil?: boolean;
  apagado?: boolean;
}

interface EmpresaAchada {
  cnpj: string; razao_social: string | null; nome_fantasia: string | null;
  cidade: string | null; uf: string | null; endereco: string | null; porte: string | null;
}

interface InfoIA {
  custoEstimado: number;
  estimativaBaseadaEm: number;
  restantesHoje: number;
  limiteDia: number;
  alvo: string;
  segmentoCadastrado: string | null;
  origem: [number, number] | null;
  estado: string | null;
  bloqueio: string | null; // por que este usuario nao pode buscar aqui (contato sem dono, de outro vendedor)
  semCidade?: boolean; // a busca acha o CNPJ pelo nome e o vendedor confirma a empresa
  semCnpj?: boolean; // mostra o botao "Completar cadastro pela Receita"
  historico: { id: string; buscadoEm: string; empresas: number; quem: string; custo: number | null }[];
  resultado?: { id?: string } | null;
}

const chaveDe = (e: Empresa) => e.nome.toLowerCase();

// espalha um pouco empresas da mesma cidade pra os alfinetes nao ficarem um em cima do outro
function espalhar(nome: string, base: [number, number]): [number, number] {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) | 0;
  const a = ((h >>> 0) % 360) * (Math.PI / 180);
  const r = 0.025 + ((h >>> 8) % 100) / 2500; // na foto da previa 0.015 deixava pinos encavalados
  return [base[0] + r * Math.sin(a), base[1] + r * Math.cos(a)];
}

const MAXIMO_IA = 12;
const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  contactId: string;
  contactNome: string;
  cidade: string | null;
  aberto: boolean;
  onFechar: () => void;
}

export default function IndicacoesModal({ contactId, contactNome, cidade: cidadeInicial, aberto, onFechar }: Props) {
  // a cidade pode chegar depois: "Completar cadastro pela Receita" preenche e a janela ja usa
  const [cidade, setCidade] = useState(cidadeInicial);
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [resumo, setResumo] = useState<Record<string, number> | null>(null);
  const [perfis, setPerfis] = useState<{ id: string; rotulo: string }[]>([]);
  const [perfil, setPerfil] = useState('tudo');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [buscadoEm, setBuscadoEm] = useState<string | null>(null);
  const [raioKm, setRaioKm] = useState<number | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [verificadoEm, setVerificadoEm] = useState<Date | null>(null);
  const [ultimaTentativa, setUltimaTentativa] = useState<{ quando: string; erro: string | null; proximaApos: string } | null>(null);
  const [montado, setMontado] = useState(false);
  const [origem, setOrigem] = useState<'mapa' | 'ia'>('mapa');
  const [ia, setIa] = useState<InfoIA | null>(null);
  const [iaConfirmar, setIaConfirmar] = useState(false);
  const [iaJob, setIaJob] = useState<string | null>(null);
  const [iaSegundos, setIaSegundos] = useState(0);
  const [iaAviso, setIaAviso] = useState<string | null>(null);
  const [iaRodada, setIaRodada] = useState<{ atual: number; max: number } | null>(null);
  const [parando, setParando] = useState(false);
  const [iaCnpj, setIaCnpj] = useState<string | null>(null);
  const [iaCadastro, setIaCadastro] = useState<string[]>([]); // campos que a Receita preencheu no cliente
  // contato sem cidade: empresa que a IA achou pelo nome, esperando o vendedor dizer se e o cliente
  const [iaAchada, setIaAchada] = useState<EmpresaAchada | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [iaAchadaErro, setIaAchadaErro] = useState<string | null>(null);
  // botao "Completar cadastro pela Receita": acha o CNPJ pelo nome, o vendedor confirma, a ficha e preenchida
  const [cad, setCad] = useState<{ fase: 'procurando' | 'confirmar' | 'gravando' | 'feito' | 'erro'; resposta?: string;
    empresa?: EmpresaAchada; msg?: string } | null>(null);
  // empresas que o aviao ja "visitou": so essas aparecem na lista enquanto a busca anima
  const [reveladas, setReveladas] = useState<Set<string>>(new Set());
  const [animar, setAnimar] = useState(false);

  useEffect(() => setMontado(true), []);

  // 1) abre instantaneo com o que ja foi garimpado antes
  const verCache = useCallback(async (qualPerfil: string) => {
    setErro(null); setEmpresas([]); setEscolhidas(new Set()); setResumo(null);
    try {
      const r = await fetch(`/api/contacts/${contactId}/indicacoes?perfil=${qualPerfil}&cache=1`);
      const j = await r.json();
      console.info('[indicacoes]', { perfil: qualPerfil, status: r.status, pendente: !!j.pendente,
        chave: j.chave, ultimaTentativa: j.ultimaTentativa, empresas: (j.empresas || []).length, erro: j.erro });
      if (j.perfis) setPerfis(j.perfis);
      if (j.erro) { setErro(j.erro); return; }
      if (j.pendente) { setPendente(true); setUltimaTentativa(j.ultimaTentativa || null); return; }
      setEmpresas(j.empresas || []); setResumo(j.resumo || null);
      setBuscadoEm(j.buscadoEm || null); setRaioKm(j.raioKm ?? null); setPendente(false);
    } catch {
      setErro('Não consegui abrir agora.');
    }
  }, [contactId]);

  // 2) garimpo de verdade: roda em segundo plano, a janela pode ser fechada
  const buscar = useCallback(async (qualPerfil: string) => {
    setCarregando(true); setErro(null); setPendente(false);
    try {
      const r = await fetch(`/api/contacts/${contactId}/indicacoes?perfil=${qualPerfil}`);
      const j = await r.json();
      if (j.perfis) setPerfis(j.perfis);
      if (j.erro) { setErro(j.erro); return; }
      setEmpresas(j.empresas || []); setResumo(j.resumo || null);
      setBuscadoEm(j.buscadoEm || null); setRaioKm(j.raioKm ?? null);
    } catch {
      setErro('A busca não respondeu. Tente de novo em um minuto.');
    } finally {
      setCarregando(false);
    }
  }, [contactId]);

  // Busca com IA: so roda quando o consultor clica e confirma o custo.
  // Devolve true se ja havia resultado guardado (a equipe reaproveita sem pagar).
  const carregarIA = useCallback(async (buscaId?: string) => {
    try {
      const r = await fetch(`/api/contacts/${contactId}/indicacoes/ia${buscaId ? `?busca=${encodeURIComponent(buscaId)}` : ''}`);
      const j = await r.json();
      console.info('[indicacoes IA]', { status: r.status, custo: j.custoEstimado, restam: j.restantesHoje,
        guardado: !!j.resultado, job: j.jobEmAndamento, chave: j.chave });
      if (j.erro || j.error) return false;
      setIa(j);
      if (j.jobEmAndamento) setIaJob(j.jobEmAndamento);
      if (j.jobEmAndamento) setAnimar(true);
      else if (j.resultado?.empresas?.length) setReveladas(new Set(j.resultado.empresas.map(chaveDe)));
      if (j.resultado?.empresas?.length && !j.jobEmAndamento) {
        setOrigem('ia'); setPendente(false); setResumo(null); setErro(null);
        setEmpresas(j.resultado.empresas); setEscolhidas(new Set());
        setBuscadoEm(j.resultado.buscadoEm || null); setRaioKm(null);
        return true;
      }
    } catch { /* sem IA, a janela segue com o mapa */ }
    return false;
  }, [contactId]);

  async function iniciarIA() {
    if (!ia) return;
    setIaConfirmar(false); setIaAviso(null); setErro(null);
    try {
      const r = await fetch(`/api/contacts/${contactId}/indicacoes/ia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmado: true, custoMostrado: ia.custoEstimado }),
      });
      const j = await r.json();
      console.info('[indicacoes IA] iniciar', { status: r.status, ...j });
      if (j.erro || !j.job) { setIaAviso(j.erro || 'Não consegui iniciar a busca.'); return; }
      setIaSegundos(0);
      setIaRodada(null);
      setIaCnpj(null);
      setIaAchada(null); setIaAchadaErro(null);
      setIaCadastro(j.cadastro || []);
      setReveladas(new Set());
      setAnimar(true);
      setOrigem('ia'); setPendente(false); setResumo(null); setEmpresas([]); setEscolhidas(new Set());
      setIaJob(j.job);
    } catch {
      setIaAviso('Não consegui iniciar a busca. Tente de novo.');
    }
  }

  // acompanha a busca; se a janela fechar, ao reabrir retoma pelo jobEmAndamento
  useEffect(() => {
    if (!iaJob || !aberto) return;
    let vivo = true;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/contacts/${contactId}/indicacoes/ia?job=${encodeURIComponent(iaJob)}`);
        const j = await r.json();
        if (!vivo) return;
        console.info('[indicacoes IA] andamento', { status: j.status, segundos: j.segundos, rodada: j.rodada,
          empresas: j.empresas?.length, custo: j.custo_reais ?? j.custo_ate_agora, motivo: j.motivo, erro: j.erro });
        if (j.status === 'confirmar_cnpj') {
          setIaSegundos(j.segundos || 0);
          setIaAchada(j.empresa);
          return;
        }
        if (j.status === 'pesquisando') {
          setIaAchada(null);
          if (j.cadastro?.length) setIaCadastro(j.cadastro);
          setIaSegundos(j.segundos || 0);
          // rodada 0 = conferindo o CNPJ do proprio cliente (o "if (j.rodada)" pulava o zero)
          if (j.rodada != null) setIaRodada({ atual: j.rodada, max: j.maxRodadas });
          if (j.cnpjCliente) setIaCnpj(`CNPJ do cliente confirmado na Receita: ${j.cnpjCliente} — busca pela atividade oficial.`);
          else if (j.cnpjMotivo) setIaCnpj(`CNPJ do cliente não confirmado (${j.cnpjMotivo}) — busca pelo cadastro.`);
          // parciais: a lista e o mapa vao enchendo enquanto as rodadas seguem
          if (j.empresas?.length) { setOrigem('ia'); setPendente(false); setResumo(null); setEmpresas(j.empresas); }
          return;
        }
        terminou(j);
      } catch { /* tenta de novo no proximo ciclo */ }
    }, 4000);
    return () => { vivo = false; clearInterval(id); };
  }, [iaJob, aberto, contactId, carregarIA]); // eslint-disable-line react-hooks/exhaustive-deps

  function terminou(j: { status: string; empresas?: Empresa[]; poucas?: boolean; custo_reais?: number; erro?: string; motivo?: string }) {
        setIaJob(null);
        recarregarIndicacoesBuscadas(); // atualiza o selo "✈ N indicações" nos cards
        setIaRodada(null);
        if (j.status === 'pronta') {
          setOrigem('ia'); setPendente(false); setResumo(null); setErro(null);
          setEmpresas(j.empresas || []); setEscolhidas(new Set());
          setBuscadoEm(new Date().toISOString()); setRaioKm(null);
          const qtd = j.empresas?.length || 0;
          const custo = reais(j.custo_reais || 0);
          setIaAviso(j.motivo === 'parada'
            ? `Busca parada com ${qtd} empresa(s). Custou ${custo}.`
            : j.poucas ? `A IA só comprovou ${qtd} empresa(s) com fonte. Custou ${custo}.` : `${qtd} empresas salvas nos seus Rascunhos. Custou ${custo}.`);
          carregarIA();
        } else if (j.status === 'falhou') {
          setAnimar(false);
          setIaAviso(`${j.erro}${j.custo_reais ? ` (custou ${reais(j.custo_reais)})` : ''}`);
          carregarIA();
        } else {
          carregarIA();
        }
  }

  async function acharCadastro() {
    setCad({ fase: 'procurando' });
    try {
      const r = await fetch(`/api/contacts/${contactId}/receita/achar`, { method: 'POST' });
      const j = await r.json();
      if (j.erro || !j.resposta) { setCad({ fase: 'erro', msg: j.erro || 'Não consegui começar.' }); return; }
      setCad({ fase: 'procurando', resposta: j.resposta });
    } catch {
      setCad({ fase: 'erro', msg: 'Não consegui começar. Tente de novo.' });
    }
  }

  // acompanha a procura do CNPJ (leva ~10s)
  useEffect(() => {
    if (cad?.fase !== 'procurando' || !cad.resposta) return;
    let vivo = true;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/contacts/${contactId}/receita/achar?resposta=${encodeURIComponent(cad.resposta!)}`);
        const j = await r.json();
        if (!vivo || j.status === 'procurando') return;
        console.info('[receita achar]', j);
        if (j.status === 'confirmar') setCad({ fase: 'confirmar', empresa: j.empresa });
        else setCad({ fase: 'erro', msg: j.motivo || j.erro || 'Não achei o CNPJ.' });
      } catch { /* tenta de novo */ }
    }, 3000);
    return () => { vivo = false; clearInterval(id); };
  }, [cad?.fase, cad?.resposta, contactId]);

  async function confirmarCadastro(sim: boolean) {
    if (!cad?.empresa) return;
    if (!sim) { setCad({ fase: 'erro', msg: 'Ok, nada foi gravado. Preencha o CNPJ ou a cidade na ficha.' }); return; }
    setCad({ ...cad, fase: 'gravando' });
    try {
      const r = await fetch(`/api/contacts/${contactId}/receita`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: cad.empresa.cnpj }),
      });
      const j = await r.json();
      if (j.erro) { setCad({ ...cad, fase: 'confirmar', msg: j.erro }); return; }
      const lista = [...(j.atualizados || []), ...(j.avisos || [])];
      setCad({ fase: 'feito', msg: lista.length ? `Cadastro atualizado pela Receita: ${lista.join(', ')}.` : 'A ficha já estava completa.' });
      if (!cidade && cad.empresa.cidade) setCidade(cad.empresa.cidade);
      carregarIA().then((temIA) => { if (!temIA) verCache(perfil); });
    } catch {
      setCad({ ...cad, fase: 'confirmar', msg: 'Não consegui gravar. Tente de novo.' });
    }
  }

  // vendedor responde se a empresa achada pelo nome e mesmo o cliente
  async function confirmarEmpresa(sim: boolean) {
    if (!iaJob) return;
    setConfirmando(true); setIaAchadaErro(null);
    try {
      const r = await fetch(`/api/contacts/${contactId}/indicacoes/ia?job=${encodeURIComponent(iaJob)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmar: sim }),
      });
      const j = await r.json();
      console.info('[indicacoes IA] confirmar empresa', { sim, status: r.status, ...j });
      if (j.erro) { setIaAchadaErro(j.erro); return; }
      if (j.status === 'pesquisando') {
        setIaAchada(null);
        if (j.cadastro?.length) setIaCadastro(j.cadastro);
        if (j.cnpjCliente) setIaCnpj(`CNPJ do cliente confirmado: ${j.cnpjCliente} — busca pela atividade oficial.`);
        if (j.rodada != null) setIaRodada({ atual: j.rodada, max: j.maxRodadas });
        return;
      }
      setIaAchada(null);
      terminou(j);
    } catch {
      setIaAchadaErro('Não consegui enviar. Tente de novo.');
    } finally {
      setConfirmando(false);
    }
  }

  async function pararIA() {
    if (!iaJob) return;
    setParando(true);
    try {
      const r = await fetch(`/api/contacts/${contactId}/indicacoes/ia?job=${encodeURIComponent(iaJob)}`, { method: 'DELETE' });
      const j = await r.json();
      console.info('[indicacoes IA] parar', { status: r.status, ...j, empresas: j.empresas?.length });
      terminou(j);
    } catch {
      setIaAviso('Não consegui parar. Tente de novo.');
    } finally {
      setParando(false);
    }
  }

  // ---- animacao do mapa ----
  const iaVisiveis = origem === 'ia' && animar ? empresas.filter((e) => reveladas.has(chaveDe(e))) : empresas;
  const fila = origem === 'ia' && animar ? empresas.filter((e) => !reveladas.has(chaveDe(e))) : [];
  const pontoInicial: [number, number] | null = ia?.origem
    || (() => { const e = empresas.find((x) => getContactCoords(x.cidade, x.estado || ia?.estado || null)); return e ? getContactCoords(e.cidade, e.estado || ia?.estado || null) : null; })()
    || [-15.78, -47.93];
  const pontoDe = (e: Empresa): PontoMapa => ({
    id: chaveDe(e),
    numero: empresas.indexOf(e) + 1,
    nome: e.nome,
    coords: espalhar(e.nome, getContactCoords(e.cidade, e.estado || ia?.estado || null) || pontoInicial),
  });
  const destino = fila.length ? pontoDe(fila[0]) : null;
  const pousados = iaVisiveis.filter(() => origem === 'ia').map(pontoDe);
  // mapa fica junto da lista sempre que houver busca da IA (rodando ou ja pronta)
  const voando = origem === 'ia' && animar && (!!iaJob || fila.length > 0);
  const mostrarMapa = origem === 'ia' && (voando || iaVisiveis.length > 0);

  const pousou = useCallback((id: string) => {
    setReveladas((s) => new Set(s).add(id));
  }, []);

  // fila zerou e a busca acabou: desliga a animacao
  useEffect(() => {
    if (animar && !iaJob && fila.length === 0) setAnimar(false);
  }, [animar, iaJob, fila.length]);

  useEffect(() => {
    if (!aberto) return;
    (async () => {
      const temIA = await carregarIA();
      if (!temIA) { setOrigem('mapa'); verCache(perfil); }
    })();
    /* eslint-disable-next-line */
  }, [aberto]);

  function alternar(id: string) {
    setEscolhidas((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function trazer() {
    const selecionadas = empresas.filter((e) => escolhidas.has(e.osmId));
    if (!selecionadas.length) return;
    setSalvando(true);
    try {
      // da IA: ja sao rascunhos salvos, so entram no funil. Do mapa: cria o contato.
      const corpo = origem === 'ia'
        ? { contatoIds: selecionadas.map((e) => e.contatoId).filter(Boolean) }
        : { empresas: selecionadas };
      const r = await fetch(`/api/contacts/${contactId}/indicacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (origem === 'ia') {
        setIaAviso(j.criados > 0 ? `${j.criados} empresa(s) jogada(s) pro funil, na coluna Novo.` : (j.erro || 'Nenhuma foi pro funil.'));
        setEscolhidas(new Set());
        await carregarIA();
        router.refresh();
        return;
      }
      if (j.criados > 0) {
        router.refresh();
        onFechar();
      } else {
        setErro(j.erro || 'Nenhuma empresa foi adicionada (podem já existir no CRM).');
      }
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto || !montado) return null;

  // Desenhado direto no <body>, fora do cartao. Dentro do cartao do kanban a
  // janela cobria o card, o mouse "saia" dele, o card encolhia, a janela
  // remontava — e a tela entrava em laco de piscar.
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4" onClick={onFechar}>
      <div className={`w-full ${mostrarMapa ? 'max-w-6xl h-[88vh]' : 'max-w-3xl max-h-[85vh]'} flex flex-col rounded-2xl border border-purple-700/40 bg-[#1e0f35] shadow-2xl`}
           onClick={(e) => e.stopPropagation()}>

        <div className="p-5 border-b border-purple-800/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Indicações</p>
              <h2 className="text-lg font-bold text-white truncate">Empresas parecidas perto de {contactNome}</h2>
              <p className="text-xs text-purple-300/70 mt-0.5">
                {cidade
                  ? (raioKm ? `${cidade} e ${raioKm}km em volta` : `Buscando em ${cidade} e região`)
                  : 'Contato sem cidade cadastrada'}
              </p>
            </div>
            <button onClick={onFechar} className="shrink-0 w-8 h-8 rounded-lg hover:bg-purple-800/40 text-neutral-400 hover:text-white">✕</button>
          </div>

          {perfis.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-3">
              {perfis.map((p) => (
                <button key={p.id}
                  onClick={() => { setPerfil(p.id); setOrigem('mapa'); verCache(p.id); }}
                  disabled={carregando}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors disabled:opacity-50 ${
                    origem === 'mapa' && perfil === p.id
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-[#2a1245] text-neutral-400 border-purple-800/40 hover:text-neutral-200'}`}>
                  {p.rotulo}
                </button>
              ))}
            </div>
          )}

          {ia && (
            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              {iaJob && iaAchada ? (
                <div>
                  <p className="text-sm font-semibold text-sky-200">Achamos esta empresa pelo nome — é o seu cliente?</p>
                  <div className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/5 p-2.5 text-[12px] text-neutral-200 space-y-0.5">
                    <p className="font-semibold">{iaAchada.nome_fantasia || iaAchada.razao_social}</p>
                    {iaAchada.nome_fantasia && iaAchada.razao_social && <p className="text-neutral-400">{iaAchada.razao_social}</p>}
                    <p className="text-neutral-400">CNPJ {iaAchada.cnpj}{iaAchada.porte ? ` · ${iaAchada.porte}` : ''}</p>
                    <p className="text-neutral-400">{[iaAchada.endereco, [iaAchada.cidade, iaAchada.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ')}</p>
                  </div>
                  <p className="mt-1.5 text-[11px] text-neutral-500">
                    Sim: a cidade, o endereço e o que estiver vazio na ficha são preenchidos pela Receita e a busca continua. Não: nada é gravado.
                  </p>
                  {iaAchadaErro && <p className="mt-1 text-[11px] text-red-300/90">{iaAchadaErro}</p>}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => confirmarEmpresa(true)} disabled={confirmando}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#1a0a2e] text-xs font-bold disabled:opacity-50">
                      {confirmando ? 'Atualizando...' : 'Sim, é o cliente'}
                    </button>
                    <button onClick={() => confirmarEmpresa(false)} disabled={confirmando}
                      className="px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold disabled:opacity-50">
                      Não é
                    </button>
                  </div>
                </div>
              ) : iaJob ? (
                <div className="flex items-center gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full border-2 border-emerald-400/30 border-t-emerald-300 animate-spin" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-200">
                      Pesquisando na internet... {iaSegundos}s
                      {iaRodada && (iaRodada.atual === 0
                        ? <span className="text-neutral-400 font-normal"> · conferindo o CNPJ do cliente na Receita</span>
                        : <span className="text-neutral-400 font-normal"> · rodada {iaRodada.atual} de até {iaRodada.max}</span>)}
                      <span className="text-neutral-400 font-normal"> · {empresas.length} de 12</span>
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Para sozinha ao chegar em 12. Pode fechar a janela — o que já foi achado fica salvo nos seus Rascunhos.
                    </p>
                    {iaCnpj && <p className="text-[11px] text-sky-300/90 mt-0.5">{iaCnpj}</p>}
                    {iaCadastro.length > 0 && (
                      <p className="text-[11px] text-emerald-300/90 mt-0.5">Cadastro completado pela Receita: {iaCadastro.join(', ')}.</p>
                    )}
                  </div>
                  <button onClick={pararIA} disabled={parando}
                    className="ml-auto shrink-0 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold disabled:opacity-50">
                    {parando ? 'Parando...' : 'Parar busca'}
                  </button>
                </div>
              ) : iaConfirmar ? (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-neutral-200">
                    Esta busca custa cerca de <strong className="text-amber-300">{reais(ia.custoEstimado)}</strong>. Confirmar?
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setIaConfirmar(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-400 hover:text-neutral-200">Cancelar</button>
                    <button onClick={iniciarIA}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#1a0a2e] text-xs font-bold">
                      Confirmar e buscar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-100">
                      {origem === 'ia' ? 'Buscar de novo com IA' : 'Buscar até 12 empresas de médio/grande porte com IA'}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {ia.semCidade
                        ? 'Sem cidade: primeiro acho o CNPJ pelo nome e você confirma a empresa'
                        : ia.segmentoCadastrado ? `Segmento: ${ia.segmentoCadastrado}` : 'Sem segmento cadastrado — a IA descobre pelo nome da empresa'}
                      {' · '}custo ~{reais(ia.custoEstimado)}
                      {ia.estimativaBaseadaEm > 0 ? ` (média das últimas ${ia.estimativaBaseadaEm})` : ' (estimativa)'}
                      {' · '}você ainda tem {ia.restantesHoje} de {ia.limiteDia} buscas hoje
                    </p>
                  </div>
                  <button onClick={() => setIaConfirmar(true)} disabled={ia.restantesHoje <= 0 || !!ia.bloqueio}
                    title={ia.bloqueio || undefined}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold disabled:opacity-40">
                    Buscar com IA · ~{reais(ia.custoEstimado)}
                  </button>
                </div>
              )}
              {ia.bloqueio && !iaJob && <p className="mt-2 text-[11px] text-red-300/90">🔒 {ia.bloqueio}</p>}

              {/* Completar cadastro pela Receita: so pra quem tem permissao de IA e contato sem CNPJ */}
              {!iaJob && ia.limiteDia > 0 && (ia.semCnpj || cad) && (
                <div className="mt-2.5 pt-2.5 border-t border-emerald-500/15">
                  {!cad ? (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-[11px] text-neutral-400 min-w-0">
                        Sem CNPJ{ia.semCidade ? ' e sem cidade' : ''}: acho o CNPJ pelo nome, você confirma e eu preencho a ficha (cidade, endereço, CEP, telefone...). Não gasta as buscas do dia.
                      </p>
                      <button onClick={acharCadastro}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-200 text-xs font-bold">
                        Completar cadastro pela Receita · ~R$ 0,07
                      </button>
                    </div>
                  ) : cad.fase === 'procurando' ? (
                    <p className="text-[12px] text-sky-200 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-sky-400/30 border-t-sky-300 animate-spin" />
                      Procurando o CNPJ de {contactNome} pelo nome... (uns 10 segundos)
                    </p>
                  ) : (cad.fase === 'confirmar' || cad.fase === 'gravando') && cad.empresa ? (
                    <div>
                      <p className="text-sm font-semibold text-sky-200">Achei esta empresa — é o seu cliente?</p>
                      <div className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/5 p-2.5 text-[12px] text-neutral-200 space-y-0.5">
                        <p className="font-semibold">{cad.empresa.nome_fantasia || cad.empresa.razao_social}</p>
                        {cad.empresa.nome_fantasia && cad.empresa.razao_social && <p className="text-neutral-400">{cad.empresa.razao_social}</p>}
                        <p className="text-neutral-400">CNPJ {cad.empresa.cnpj}{cad.empresa.porte ? ` · ${cad.empresa.porte}` : ''}</p>
                        <p className="text-neutral-400">{[cad.empresa.endereco, [cad.empresa.cidade, cad.empresa.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ')}</p>
                      </div>
                      {cad.msg && <p className="mt-1 text-[11px] text-red-300/90">{cad.msg}</p>}
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => confirmarCadastro(true)} disabled={cad.fase === 'gravando'}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#1a0a2e] text-xs font-bold disabled:opacity-50">
                          {cad.fase === 'gravando' ? 'Gravando...' : 'Sim, é o cliente'}
                        </button>
                        <button onClick={() => confirmarCadastro(false)} disabled={cad.fase === 'gravando'}
                          className="px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold disabled:opacity-50">
                          Não é
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-[11px] ${cad.fase === 'feito' ? 'text-emerald-300/90' : 'text-amber-300/90'}`}>
                      {cad.msg}
                      {cad.fase === 'erro' && <button onClick={() => setCad(null)} className="ml-2 underline">tentar de novo</button>}
                    </p>
                  )}
                </div>
              )}
              {iaAviso && !iaJob && <p className="mt-2 text-[11px] text-amber-300/90">{iaAviso}</p>}

              {/* toda busca ja feita fica guardada: um clique mostra de novo, sem custo */}
              {ia.historico?.length > 0 && !iaJob && (
                <div className="mt-2.5 pt-2.5 border-t border-emerald-500/15">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">Buscas feitas para este cliente</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {ia.historico.map((b) => {
                      const atual = origem === 'ia' && ia.resultado?.id === b.id;
                      return (
                        <button key={b.id}
                          onClick={async () => { setIaAviso(null); setReveladas(new Set()); await carregarIA(b.id); }}
                          className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${atual
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                            : 'bg-[#2a1245] border-purple-800/40 text-neutral-300 hover:border-emerald-500/40'}`}>
                          {new Date(b.buscadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          {' · '}{b.quem.split(' ')[0]} · {b.empresas} empresas{b.custo != null ? ` · ${reais(b.custo)}` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {buscadoEm && !carregando && (
            <p className="text-[10px] text-neutral-600 mt-1.5">
              {origem === 'ia' ? 'Pesquisado pela IA' : 'Garimpado'} em {new Date(buscadoEm).toLocaleString('pt-BR')} · guardado por 7 dias para a equipe, sem custo
              {origem === 'mapa' && (
                <button onClick={() => verCache(perfil)} className="ml-2 underline text-amber-400/80 hover:text-amber-300">atualizar</button>
              )}
            </p>
          )}

          {resumo && !carregando && (
            <p className="text-xs text-neutral-500 mt-2.5">
              {resumo.encontradas} no mapa · {resumo.ja_no_crm} já no CRM · <strong className="text-emerald-400">{resumo.novas} novas</strong> · {resumo.com_telefone} com telefone
            </p>
          )}
        </div>

        {/* com mapa: mapa a esquerda e lista a direita no computador; empilhados no celular */}
        <div className={`flex-1 min-h-0 overflow-y-auto ${mostrarMapa ? 'md:grid md:grid-cols-[1.15fr_1fr] md:overflow-hidden' : ''}`}>
          {mostrarMapa && pontoInicial && (
            <div className="h-72 md:h-full p-3 md:pr-0">
              <div className="h-full rounded-xl overflow-hidden border border-purple-700/40 shadow-xl shadow-black/40">
                <MapaBusca
                  key={contactId}
                  origem={pontoInicial}
                  nomeCliente={contactNome}
                  pousados={pousados}
                  destino={destino}
                  voando={voando}
                  onPousou={pousou}
                  status={destino ? `✈ voando para ${destino.nome} · ${pousados.length + 1} de ${MAXIMO_IA}`
                    : iaJob ? '✈ procurando empresas na região...'
                    : `${pousados.length} empresas · passe o mouse num ponto`}
                />
              </div>
            </div>
          )}
          <div className={`p-5 ${mostrarMapa ? 'md:overflow-y-auto md:min-h-0' : ''}`}>
          {carregando && (
            <div className="flex flex-col items-center gap-3 py-12 text-purple-300/70">
              <span className="w-6 h-6 rounded-full border-2 border-purple-400/30 border-t-purple-300 animate-spin" />
              <p className="text-sm">Garimpando no mapa... leva até 1 minuto.</p>
              <p className="text-xs text-neutral-600">
                Pode fechar esta janela e continuar trabalhando — a busca segue sozinha
                e o resultado fica guardado.
              </p>
            </div>
          )}

          {pendente && !carregando && !erro && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-neutral-300">Esta cidade ainda está na fila do garimpo.</p>
              <p className="text-xs text-neutral-500 max-w-sm leading-relaxed">
                O sistema garimpa as cidades sozinho, em segundo plano, a cada meia hora —
                começando pelas que têm mais clientes de vocês. Quando chegar nesta, o
                resultado aparece aqui e fica guardado por 7 dias para a equipe toda.
                {ia && ' Se precisar agora, use a busca com IA acima.'}
              </p>
              {ultimaTentativa && (
                <p className="text-xs text-amber-300/80 max-w-sm leading-relaxed">
                  Última tentativa: {new Date(ultimaTentativa.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  {' '}— o servidor de mapa não respondeu. Tenta de novo depois das{' '}
                  {new Date(ultimaTentativa.proximaApos).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
                </p>
              )}
              {/* A resposta costuma ser igual ("ainda na fila"), entao sem retorno
                  visivel o botao parecia nao fazer nada. */}
              <button
                onClick={async () => {
                  setVerificando(true);
                  await verCache(perfil);
                  setVerificadoEm(new Date());
                  setVerificando(false);
                }}
                disabled={verificando}
                className="mt-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#1a0a2e] text-sm font-bold disabled:opacity-60">
                {verificando ? 'Verificando...' : 'Verificar de novo'}
              </button>
              {verificadoEm && !verificando && (
                <p className="text-[11px] text-neutral-500">
                  Verificado às {verificadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} — ainda não ficou pronta.
                </p>
              )}
            </div>
          )}

          {erro && !carregando && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm text-amber-200">{erro}</p>
              <button onClick={() => buscar(perfil)} className="mt-2 text-xs font-bold text-amber-300 underline">Tentar de novo</button>
            </div>
          )}

          {origem === 'mapa' && !carregando && !erro && !pendente && empresas.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-neutral-300 mb-2">Nada novo nesse perfil para {cidade}.</p>
              <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
                Esta busca usa o OpenStreetMap, que é um mapa colaborativo: a empresa só
                aparece se alguém a cadastrou lá. Em cidades grandes como Ribeirão Preto e
                Campinas o cadastro é rico; em cidades menores costuma ser vazio.
                Tente outro perfil acima, ou peça indicações a partir de um cliente de
                cidade maior.
              </p>
            </div>
          )}

          {origem === 'mapa' && !carregando && !erro && empresas.length > 0 && empresas.length < 5 && (
            <p className="mb-3 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-2">
              Só {empresas.length} resultado(s): o mapa tem pouca coisa cadastrada em {cidade}.
              Em cidades maiores essa busca rende bem mais.
            </p>
          )}

          <div className="space-y-2">
            {iaVisiveis.map((e) => {
              const marcada = escolhidas.has(e.osmId);
              // da IA: so rascunho salvo pode ir pro funil
              const bloqueada = !!e.jaNoCrm || !!e.noFunil || (origem === 'ia' && !e.contatoId);
              const local = [e.endereco, e.bairro, e.cidade, e.estado].filter(Boolean).join(', ');
              return (
                <div key={e.osmId} role="button" tabIndex={bloqueada ? -1 : 0}
                  onClick={() => !bloqueada && alternar(e.osmId)}
                  onKeyDown={(ev) => { if (!bloqueada && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); alternar(e.osmId); } }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    bloqueada ? 'opacity-50 cursor-not-allowed bg-[#2a1245]/30 border-purple-800/20'
                    : marcada ? 'cursor-pointer bg-emerald-500/10 border-emerald-500/40' : 'cursor-pointer bg-[#2a1245]/50 border-purple-800/30 hover:border-purple-600/50'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold ${
                      marcada ? 'bg-emerald-500 border-emerald-500 text-[#1a0a2e]' : 'border-neutral-600'}`}>
                      {marcada ? '✓' : ''}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-neutral-100 truncate">
                        {origem === 'ia' && (
                          <span className="inline-block mr-1.5 w-5 h-5 rounded-full bg-emerald-500 text-[#0f0a1e] text-[11px] leading-5 text-center align-middle">
                            {empresas.indexOf(e) + 1}
                          </span>
                        )}
                        {e.nome}
                        {e.nota != null && <span className="ml-2 text-[10px] font-bold text-emerald-300">nota {e.nota}</span>}
                        {e.porteConfirmado === true ? (
                          <span className="ml-2 text-[10px] font-semibold text-emerald-300" title={`Porte na Receita: ${e.porte}`}>médio/grande ✓ Receita</span>
                        ) : e.porteConfirmado === false ? (
                          <span className="ml-2 text-[10px] font-semibold text-neutral-500" title={e.porte_indicio || 'Sem CNPJ para conferir na Receita'}>porte não confirmado</span>
                        ) : null}
                        {e.noFunil ? <span className="ml-2 text-[10px] font-semibold text-emerald-300">✓ no funil</span>
                          : e.contatoId ? <span className="ml-2 text-[10px] font-semibold text-sky-300">salva nos Rascunhos</span>
                          : e.jaNoCrm ? <span className="ml-2 text-[10px] font-semibold text-amber-300">já estava no CRM</span>
                          : e.apagado ? <span className="ml-2 text-[10px] font-semibold text-neutral-500">excluída</span> : null}
                      </p>
                      {e.motivo && <p className="text-[11px] text-emerald-200/60 line-clamp-1">{e.motivo}</p>}
                      {e.porte_indicio && <p className="text-[11px] text-neutral-400 line-clamp-1">Porte: {e.porte_indicio}</p>}
                      {(e.razao_social || e.cnpj) && (
                        <p className="text-[11px] text-neutral-400 truncate">
                          {e.razao_social}{e.razao_social && e.cnpj ? ' · ' : ''}{e.cnpj ? `CNPJ ${e.cnpj}` : ''}
                        </p>
                      )}
                      {e.descricao && <p className="text-[11px] text-neutral-500 line-clamp-2">{e.descricao}</p>}
                      <p className="text-xs text-purple-300/60 truncate">
                        {e.fonte ? (local || e.tipo) : `${e.tipo}${e.endereco ? ` · ${e.endereco}` : ''}${e.cidade ? ` · ${e.cidade}` : ''}`}
                        {e.cep ? ` · CEP ${e.cep}` : ''}
                      </p>
                      <div className="flex gap-1.5 flex-wrap mt-1.5">
                        {e.telefone && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-300">{e.telefone}</span>}
                        {e.whatsapp && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500/15 text-green-300">Zap {e.whatsapp}</span>}
                        {e.email && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/15 text-amber-200">{e.email}</span>}
                        {e.site && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-sky-500/15 text-sky-300">site</span>}
                        {e.instagram && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-pink-500/15 text-pink-300">instagram</span>}
                        {!e.telefone && !e.whatsapp && !e.email && !e.site && (
                          <span className="text-[10px] text-neutral-600 italic">sem contato encontrado — precisa pesquisar</span>
                        )}
                      </div>
                      {e.fonte && (
                        <a href={e.fonte} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}
                          className="inline-block mt-1.5 text-[10px] text-sky-400/80 hover:text-sky-300 underline truncate max-w-full">
                          fonte: {e.fonte.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)} — confira antes de ligar
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>

        <div className="p-4 border-t border-purple-800/40 flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">
            {escolhidas.size > 0 ? `${escolhidas.size} selecionada(s)` : 'Marque as que quiser trabalhar'}
          </p>
          <button onClick={trazer} disabled={escolhidas.size === 0 || salvando}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#1a0a2e] text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed">
            {salvando ? (origem === 'ia' ? 'Jogando...' : 'Trazendo...')
              : origem === 'ia' ? `Jogar ${escolhidas.size || ''} pro funil` : `Trazer ${escolhidas.size || ''} pro meu funil`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
