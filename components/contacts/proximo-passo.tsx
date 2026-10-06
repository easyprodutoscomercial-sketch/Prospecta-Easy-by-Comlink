'use client';

import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PROXIMA_ACAO_LABELS } from '@/lib/utils/labels';
import { TIPOS_PROXIMO_PASSO, exigeProximoPasso, proximoDiaUtilAs9, type TipoProximoPasso } from '@/lib/utils/proximo-passo';

// Janela "Proximo passo" usada por todas as telas que registram atividade (ficha do contato,
// gaveta do kanban, Modo Foco, agenda). Regra em lib/utils/proximo-passo.ts.
//
// Uso:  const { pedirProximoPasso, janelaProximoPasso } = useProximoPasso();
//       const pp = await pedirProximoPasso(outcome, atual);  // null = cancelou
//       fetch('/api/interactions', { body: JSON.stringify({ ...dados, ...pp }) })
//       ... e renderizar {janelaProximoPasso}

export type ProximoPasso = { proxima_acao_tipo?: TipoProximoPasso; proxima_acao_data?: string };
type Atual = { tipo?: string | null; data?: string | null };

const ATALHOS: { rotulo: string; dias: number }[] = [
  { rotulo: 'Amanhã 9h', dias: 1 },
  { rotulo: 'Em 2 dias', dias: 2 },
  { rotulo: 'Em 1 semana', dias: 7 },
];

// datetime-local trabalha no horario do navegador: converte ida e volta
const paraCampo = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const doCampo = (v: string) => new Date(v).toISOString();
const dataLegivel = (iso: string) => new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function useProximoPasso() {
  const [aberta, setAberta] = useState(false);
  const [tipo, setTipo] = useState<TipoProximoPasso>('LIGAR');
  const [data, setData] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const resolver = useRef<((v: ProximoPasso | null) => void) | null>(null);

  const pedirProximoPasso = useCallback((outcome: string, atual?: Atual): Promise<ProximoPasso | null> => {
    // fechou ou perdeu: nao tem proximo passo
    if (!exigeProximoPasso(outcome)) return Promise.resolve({});
    const futuro = atual?.data && new Date(atual.data).getTime() > Date.now() ? atual.data : null;
    setTipo((TIPOS_PROXIMO_PASSO as readonly string[]).includes(atual?.tipo || '') && futuro ? atual!.tipo as TipoProximoPasso : 'LIGAR');
    setData(futuro || proximoDiaUtilAs9(1));
    setErro(null);
    setAberta(true);
    return new Promise((r) => { resolver.current = r; });
  }, []);

  const fechar = (v: ProximoPasso | null) => {
    setAberta(false);
    resolver.current?.(v);
    resolver.current = null;
  };

  const confirmar = () => {
    if (!data || new Date(data).getTime() < Date.now() - 60_000) { setErro('Escolha uma data no futuro.'); return; }
    fechar({ proxima_acao_tipo: tipo, proxima_acao_data: data });
  };

  const janelaProximoPasso = aberta && typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4" onClick={() => fechar(null)}>
      <div className="w-full max-w-sm rounded-2xl border border-purple-700/40 bg-[#1e0f35] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Próximo passo</p>
        <h3 className="mt-0.5 text-base font-bold text-white">O que você vai fazer, e quando?</h3>
        <p className="mt-1 text-[11px] text-neutral-400">O CRM te lembra na data. Sem próximo passo a empresa some no funil.</p>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {TIPOS_PROXIMO_PASSO.map((t) => (
            <button key={t} type="button" onClick={() => setTipo(t)}
              className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${tipo === t
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                : 'border-purple-700/30 bg-[#2a1245] text-neutral-300 hover:border-purple-500/50'}`}>
              {PROXIMA_ACAO_LABELS[t] || t}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {ATALHOS.map((a) => (
            <button key={a.dias} type="button" onClick={() => { setData(proximoDiaUtilAs9(a.dias)); setErro(null); }}
              className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/20">
              {a.rotulo}
            </button>
          ))}
        </div>
        <input type="datetime-local" value={data ? paraCampo(data) : ''} onChange={(e) => { if (e.target.value) { setData(doCampo(e.target.value)); setErro(null); } }}
          className="mt-2 w-full rounded-lg border border-purple-700/30 bg-[#2a1245] px-2 py-1.5 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        {data && <p className="mt-1 text-[11px] text-neutral-400">{PROXIMA_ACAO_LABELS[tipo]} · {dataLegivel(data)}</p>}
        {erro && <p className="mt-1 text-[11px] text-red-300">{erro}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => fechar(null)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-400 hover:text-neutral-200">Cancelar</button>
          <button type="button" onClick={confirmar} className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-bold text-[#1a0a2e] hover:bg-emerald-400">Salvar</button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return { pedirProximoPasso, janelaProximoPasso };
}
