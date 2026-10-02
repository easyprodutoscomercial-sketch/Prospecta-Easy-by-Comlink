'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

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
}

interface Props {
  contactId: string;
  contactNome: string;
  cidade: string | null;
  aberto: boolean;
  onFechar: () => void;
}

export default function IndicacoesModal({ contactId, contactNome, cidade, aberto, onFechar }: Props) {
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
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  // 1) abre instantaneo com o que ja foi garimpado antes
  const verCache = useCallback(async (qualPerfil: string) => {
    setErro(null); setEmpresas([]); setEscolhidas(new Set()); setResumo(null);
    try {
      const r = await fetch(`/api/contacts/${contactId}/indicacoes?perfil=${qualPerfil}&cache=1`);
      const j = await r.json();
      if (j.perfis) setPerfis(j.perfis);
      if (j.erro) { setErro(j.erro); return; }
      if (j.pendente) { setPendente(true); return; }
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

  useEffect(() => { if (aberto) verCache(perfil); /* eslint-disable-next-line */ }, [aberto]);

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
      const r = await fetch(`/api/contacts/${contactId}/indicacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresas: selecionadas }),
      });
      const j = await r.json();
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
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-purple-700/40 bg-[#1e0f35] shadow-2xl"
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
                  onClick={() => { setPerfil(p.id); verCache(p.id); }}
                  disabled={carregando}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors disabled:opacity-50 ${
                    perfil === p.id
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-[#2a1245] text-neutral-400 border-purple-800/40 hover:text-neutral-200'}`}>
                  {p.rotulo}
                </button>
              ))}
            </div>
          )}

          {buscadoEm && !carregando && (
            <p className="text-[10px] text-neutral-600 mt-1.5">
              Garimpado em {new Date(buscadoEm).toLocaleString('pt-BR')} · guardado por 7 dias
              <button onClick={() => verCache(perfil)} className="ml-2 underline text-amber-400/80 hover:text-amber-300">atualizar</button>
            </p>
          )}

          {resumo && !carregando && (
            <p className="text-xs text-neutral-500 mt-2.5">
              {resumo.encontradas} no mapa · {resumo.ja_no_crm} já no CRM · <strong className="text-emerald-400">{resumo.novas} novas</strong> · {resumo.com_telefone} com telefone
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
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
              </p>
              <button onClick={() => verCache(perfil)}
                className="mt-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#1a0a2e] text-sm font-bold">
                Verificar de novo
              </button>
            </div>
          )}

          {erro && !carregando && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm text-amber-200">{erro}</p>
              <button onClick={() => buscar(perfil)} className="mt-2 text-xs font-bold text-amber-300 underline">Tentar de novo</button>
            </div>
          )}

          {!carregando && !erro && !pendente && empresas.length === 0 && (
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

          {!carregando && !erro && empresas.length > 0 && empresas.length < 5 && (
            <p className="mb-3 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-2">
              Só {empresas.length} resultado(s): o mapa tem pouca coisa cadastrada em {cidade}.
              Em cidades maiores essa busca rende bem mais.
            </p>
          )}

          <div className="space-y-2">
            {empresas.map((e) => {
              const marcada = escolhidas.has(e.osmId);
              return (
                <button key={e.osmId} onClick={() => alternar(e.osmId)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    marcada ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-[#2a1245]/50 border-purple-800/30 hover:border-purple-600/50'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold ${
                      marcada ? 'bg-emerald-500 border-emerald-500 text-[#1a0a2e]' : 'border-neutral-600'}`}>
                      {marcada ? '✓' : ''}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-neutral-100 truncate">{e.nome}</p>
                      <p className="text-xs text-purple-300/60 truncate">
                        {e.tipo}{e.endereco ? ` · ${e.endereco}` : ''}{e.cidade ? ` · ${e.cidade}` : ''}
                      </p>
                      <div className="flex gap-1.5 flex-wrap mt-1.5">
                        {e.telefone && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-300">{e.telefone}</span>}
                        {e.site && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-sky-500/15 text-sky-300">site</span>}
                        {!e.telefone && !e.site && <span className="text-[10px] text-neutral-600 italic">sem contato no mapa — precisa pesquisar</span>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-purple-800/40 flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">
            {escolhidas.size > 0 ? `${escolhidas.size} selecionada(s)` : 'Marque as que quiser trabalhar'}
          </p>
          <button onClick={trazer} disabled={escolhidas.size === 0 || salvando}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#1a0a2e] text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed">
            {salvando ? 'Trazendo...' : `Trazer ${escolhidas.size || ''} pro meu funil`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
