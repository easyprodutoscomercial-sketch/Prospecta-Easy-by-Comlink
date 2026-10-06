'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { lerEml, dataDoRelatorio } from '@/lib/conferencia/eml';
import type { LinhaConferida, NaoCitado, Placar, Situacao, Resultado } from '@/lib/conferencia/casar';
import { formatInteractionOutcome, formatInteractionType, formatStatus } from '@/lib/utils/labels';
import { montarCobranca } from '@/lib/conferencia/cobrar';

// Conferencia de relatorios diarios: o dono arrasta os e-mails que os
// vendedores mandam e ve o que foi dito x o que esta no CRM. So mostra:
// nao lanca nada (decisao do dono, 06/10/2026).

interface Usuario { user_id: string; name: string; email: string; role: string }
interface VendedorConferido {
  vendedor_id: string; vendedor_nome: string; assunto: string; remetente: string | null; enviado_em: string | null;
  custo_reais: number; lido_em: string; linhas: LinhaConferida[]; nao_citados: NaoCitado[]; placar: Placar;
}
interface Resposta { dia: string; dias: string[]; vendedores: VendedorConferido[]; usuarios: Usuario[] }

interface Envio {
  id: string;
  arquivo: string;
  estado: 'lendo' | 'ok' | 'erro' | 'escolher';
  mensagem: string;
  corpo?: Record<string, unknown>;
  vendedorEscolhido?: string;
}

const SITUACAO: Record<Situacao, { rotulo: string; icone: string; cor: string }> = {
  registrado: { rotulo: 'Registrado', icone: '✅', cor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  nao_registrado: { rotulo: 'Não registrou', icone: '⚠️', cor: 'text-red-300 bg-red-500/10 border-red-500/30' },
  varias_fichas: { rotulo: 'Várias fichas', icone: '👥', cor: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  provavel: { rotulo: 'Provável', icone: '❔', cor: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  nao_achado: { rotulo: 'Não está na base', icone: '❓', cor: 'text-purple-200 bg-purple-500/10 border-purple-500/30' },
};

const RESULTADO: Record<Resultado, string> = {
  sem_contato: 'Sem contato',
  falou: 'Falou',
  pediu_apresentacao: 'Pediu apresentação',
  reuniao_marcada: 'Reunião marcada',
  reuniao_realizada: 'Reunião feita',
  sem_interesse: 'Sem interesse',
  retornar: 'Retornar',
  outro: 'Outro',
};

const dataBR = (dia: string) => dia.split('-').reverse().join('/');
const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

// cada caractere = 1 byte (TextDecoder('latin1') troca os bytes 0x80-0x9F)
async function lerBinario(f: File) {
  const b = new Uint8Array(await f.arrayBuffer());
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 8192)));
  return s;
}

function corPct(pct: number) {
  if (pct >= 90) return 'text-emerald-400';
  if (pct >= 70) return 'text-amber-300';
  return 'text-red-400';
}

export default function ConferenciaPage() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [aberto, setAberto] = useState<Record<string, boolean>>({});
  // botao "Cobrar": mensagem pronta por vendedor (lib/conferencia/cobrar.ts), editavel antes de mandar
  const [cobranca, setCobranca] = useState<Record<string, { texto: string; pontos: number; estado: string | null }>>({});
  const [colar, setColar] = useState(false);
  const [texto, setTexto] = useState('');
  const [textoVendedor, setTextoVendedor] = useState('');
  const [textoDia, setTextoDia] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async (d?: string | null) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/conferencia${d ? `?dia=${d}` : ''}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ao carregar');
      setDados(j);
      setDia(j.dia);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const atualizar = (id: string, mudanca: Partial<Envio>) =>
    setEnvios((l) => l.map((e) => (e.id === id ? { ...e, ...mudanca } : e)));

  async function enviar(id: string, corpo: Record<string, unknown>) {
    atualizar(id, { estado: 'lendo', mensagem: 'A IA está lendo o e-mail (10 a 20 segundos)…', corpo });
    try {
      const r = await fetch('/api/conferencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json();
      if (r.status === 422 && j.precisa_vendedor) {
        atualizar(id, { estado: 'escolher', mensagem: j.error });
        return null;
      }
      if (!r.ok) throw new Error(j.error || 'Erro ao ler');
      atualizar(id, { estado: 'ok', mensagem: `${j.vendedor_nome}: ${j.empresas} empresas lidas (${dataBR(j.dia)}) · custo ${reais(j.custo_reais || 0)}` });
      return j.dia as string;
    } catch (e) {
      atualizar(id, { estado: 'erro', mensagem: e instanceof Error ? e.message : 'Erro ao ler' });
      return null;
    }
  }

  async function receberArquivos(lista: FileList | File[]) {
    const arquivos = Array.from(lista).filter((f) => /\.eml$/i.test(f.name));
    if (!arquivos.length) {
      setErro('Arraste arquivos .eml (no Outlook: arraste o e-mail para a área de trabalho ou use "Salvar como").');
      return;
    }
    setErro(null);
    const novos: Envio[] = arquivos.map((f, i) => ({ id: `${Date.now()}-${i}`, arquivo: f.name, estado: 'lendo', mensagem: 'Abrindo o arquivo…' }));
    setEnvios((l) => [...novos, ...l]);

    // 3 de cada vez: cada leitura leva 10-20s
    const fila = arquivos.map((f, i) => ({ f, id: novos[i].id }));
    const dias: string[] = [];
    const trabalhar = async () => {
      for (let item = fila.shift(); item; item = fila.shift()) {
        try {
          const e = lerEml(await lerBinario(item.f));
          if (!e.texto) throw new Error('Não achei texto neste e-mail.');
          const d = await enviar(item.id, {
            texto: e.texto, assunto: e.assunto, remetente_email: e.deEmail, remetente_nome: e.deNome,
            enviado_em: e.enviadoEm, dia: dataDoRelatorio(e.assunto, e.texto, e.enviadoEm),
          });
          if (d) dias.push(d);
        } catch (err) {
          atualizar(item.id, { estado: 'erro', mensagem: err instanceof Error ? err.message : 'Arquivo inválido' });
        }
      }
    };
    await Promise.all([trabalhar(), trabalhar(), trabalhar()]);
    if (dias.length) carregar(dias.sort().reverse()[0]);
  }

  async function reenviarComVendedor(envio: Envio) {
    if (!envio.corpo || !envio.vendedorEscolhido) return;
    const d = await enviar(envio.id, { ...envio.corpo, vendedor_id: envio.vendedorEscolhido });
    if (d) carregar(d);
  }

  async function enviarTexto() {
    if (!textoVendedor) { setErro('Escolha o vendedor do texto colado.'); return; }
    const id = `${Date.now()}-texto`;
    setEnvios((l) => [{ id, arquivo: 'Texto colado', estado: 'lendo', mensagem: '' }, ...l]);
    const d = await enviar(id, { texto, assunto: '', vendedor_id: textoVendedor, dia: textoDia || null });
    if (d) { setTexto(''); carregar(d); }
  }

  function abrirCobranca(v: VendedorConferido) {
    if (!dia) return;
    const { mensagem, pontos } = montarCobranca(v.vendedor_nome, dia, v.linhas, v.placar);
    setCobranca((m) => ({ ...m, [v.vendedor_id]: { texto: mensagem, pontos, estado: null } }));
    setAberto((a) => ({ ...a, [v.vendedor_id]: true }));
  }

  async function mandarNoCrm(v: VendedorConferido) {
    const c = cobranca[v.vendedor_id];
    if (!c || !dia) return;
    setCobranca((m) => ({ ...m, [v.vendedor_id]: { ...c, estado: 'enviando' } }));
    try {
      const r = await fetch('/api/conferencia/cobrar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendedor_id: v.vendedor_id, dia, mensagem: c.texto }),
      });
      const j = await r.json().catch(() => ({}));
      setCobranca((m) => ({ ...m, [v.vendedor_id]: { ...c, estado: r.ok ? 'enviada' : `erro:${j.error || 'Não consegui mandar.'}` } }));
    } catch {
      setCobranca((m) => ({ ...m, [v.vendedor_id]: { ...c, estado: 'erro:Não consegui mandar.' } }));
    }
  }

  async function apagar(v: VendedorConferido) {
    if (!dia || !confirm(`Apagar a leitura do e-mail de ${v.vendedor_nome} (${dataBR(dia)})? O CRM não muda.`)) return;
    await fetch(`/api/conferencia?dia=${dia}&vendedor_id=${v.vendedor_id}`, { method: 'DELETE' });
    carregar(dia);
  }

  async function exportar() {
    if (!dados || !dia) return;
    const XLSX = await import('xlsx');
    const linhas = dados.vendedores.flatMap((v) => [
      ...v.linhas.map((l) => ({
        Dia: dataBR(dia), Vendedor: v.vendedor_nome, Empresa: l.empresa, Pessoa: l.pessoa || '',
        'Disse no e-mail': RESULTADO[l.resultado], Resumo: l.resumo, 'No CRM': SITUACAO[l.situacao].rotulo,
        'Ficha no CRM': l.contato?.nome || l.candidatos.map((c) => c.nome).join(' / '),
        Alertas: l.detalhe_alerta || '', 'Próximo passo': l.proximo_passo || '',
      })),
      ...v.nao_citados.map((n) => ({
        Dia: dataBR(dia), Vendedor: v.vendedor_nome, Empresa: n.contato.nome, Pessoa: '',
        'Disse no e-mail': '(não citou)', Resumo: n.interacoes.map((i) => `${formatInteractionType(i.type)} ${i.outcome ? formatInteractionOutcome(i.outcome) : ''}`).join('; '),
        'No CRM': 'Registrou, mas não citou', 'Ficha no CRM': n.contato.nome, Alertas: '', 'Próximo passo': '',
      })),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Conferência');
    XLSX.writeFile(wb, `conferencia-${dia}.xlsx`);
  }

  const vendedores = dados?.vendedores || [];
  const reunioesFora = vendedores.reduce((s, v) => s + v.placar.reunioes_fora_agenda, 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin" className="text-purple-300/40 hover:text-purple-300/60 text-sm transition-colors">Admin</Link>
        <span className="text-purple-300/20">/</span>
        <span className="text-sm text-neutral-100">Conferência</span>
      </div>
      <h1 className="text-xl font-bold text-neutral-100">Conferência de relatórios</h1>
      <p className="text-sm text-purple-300/60 mb-6">
        Arraste os e-mails do dia. A IA separa empresa por empresa e o sistema confere com o que cada vendedor registrou no CRM.
      </p>

      {/* Entrada */}
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); receberArquivos(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          arrastando ? 'border-emerald-400 bg-emerald-500/10' : 'border-purple-700/40 bg-[#1e0f35] hover:border-purple-500/60'
        }`}
      >
        <p className="text-sm text-neutral-100 font-medium">Solte aqui os e-mails (.eml) ou clique para escolher</p>
        <p className="text-xs text-purple-300/50 mt-1">Pode mandar vários de uma vez. O e-mail é lido no seu navegador; só o texto vai para a IA.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".eml,message/rfc822"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) receberArquivos(e.target.files); e.target.value = ''; }}
        />
      </div>
      <button onClick={() => setColar((c) => !c)} className="mt-2 text-xs text-purple-300/60 hover:text-purple-200 underline">
        {colar ? 'Fechar' : 'Ou colar o texto do e-mail'}
      </button>
      {colar && (
        <div className="mt-2 bg-[#1e0f35] border border-purple-800/30 rounded-lg p-4 space-y-3">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
            placeholder="Cole aqui o texto do relatório"
            className="w-full bg-[#2a1245] border border-purple-700/30 rounded-lg p-3 text-sm text-neutral-100"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <select value={textoVendedor} onChange={(e) => setTextoVendedor(e.target.value)} className="bg-[#2a1245] border border-purple-700/30 rounded-lg px-3 py-2 text-sm text-neutral-100">
              <option value="">Quem mandou?</option>
              {(dados?.usuarios || []).map((u) => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
            </select>
            <input type="date" value={textoDia} onChange={(e) => setTextoDia(e.target.value)} className="bg-[#2a1245] border border-purple-700/30 rounded-lg px-3 py-2 text-sm text-neutral-100" />
            <button onClick={enviarTexto} disabled={texto.trim().length < 30} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 disabled:opacity-40">
              Ler texto
            </button>
          </div>
        </div>
      )}

      {envios.length > 0 && (
        <div className="mt-4 space-y-2">
          {envios.map((e) => (
            <div key={e.id} className="bg-[#1e0f35] border border-purple-800/30 rounded-lg px-4 py-2 text-sm flex flex-wrap items-center gap-2">
              <span>{e.estado === 'lendo' ? '⏳' : e.estado === 'ok' ? '✅' : e.estado === 'escolher' ? '👤' : '❌'}</span>
              <span className="text-neutral-200 truncate max-w-[16rem]">{e.arquivo}</span>
              <span className={e.estado === 'erro' ? 'text-red-400' : 'text-purple-300/70'}>{e.mensagem}</span>
              {e.estado === 'escolher' && (
                <span className="flex gap-2">
                  <select
                    value={e.vendedorEscolhido || ''}
                    onChange={(ev) => atualizar(e.id, { vendedorEscolhido: ev.target.value })}
                    className="bg-[#2a1245] border border-purple-700/30 rounded px-2 py-1 text-xs text-neutral-100"
                  >
                    <option value="">Quem mandou?</option>
                    {(dados?.usuarios || []).map((u) => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
                  </select>
                  <button onClick={() => reenviarComVendedor(e)} disabled={!e.vendedorEscolhido} className="px-3 py-1 bg-emerald-600 text-white text-xs rounded disabled:opacity-40">
                    Ler
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {erro && <div className="mt-4 bg-red-950/50 border border-red-800/40 text-red-400 text-sm rounded-lg px-4 py-3">{erro}</div>}

      {/* Dia */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-emerald-400">Dia</h2>
        <select
          value={dia || ''}
          onChange={(e) => carregar(e.target.value)}
          className="bg-[#2a1245] border border-purple-700/30 rounded-lg px-3 py-2 text-sm text-neutral-100"
        >
          {dia && !(dados?.dias || []).includes(dia) && <option value={dia}>{dataBR(dia)}</option>}
          {(dados?.dias || []).map((d) => <option key={d} value={d}>{dataBR(d)}</option>)}
        </select>
        <button onClick={() => carregar(dia)} className="text-xs text-purple-300/60 hover:text-purple-200 underline">Atualizar</button>
        {vendedores.length > 0 && (
          <button onClick={exportar} className="ml-auto px-3 py-2 bg-[#2a1245] border border-purple-700/30 text-neutral-100 text-sm rounded-lg hover:bg-purple-800/40">
            Exportar planilha
          </button>
        )}
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-5 h-5 border-2 border-purple-800/30 border-t-emerald-500 rounded-full" />
        </div>
      ) : vendedores.length === 0 ? (
        <p className="text-sm text-purple-300/40 py-10 text-center">Nenhum e-mail conferido neste dia.</p>
      ) : (
        <>
          {reunioesFora > 0 && (
            <div className="mt-4 bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm rounded-lg px-4 py-3">
              📅 {reunioesFora} {reunioesFora === 1 ? 'reunião prometida no e-mail não está' : 'reuniões prometidas nos e-mails não estão'} na agenda do CRM.
            </div>
          )}

          {/* Placar */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {vendedores.map((v) => (
              <button
                key={v.vendedor_id}
                onClick={() => {
                  setAberto((a) => ({ ...a, [v.vendedor_id]: true }));
                  document.getElementById(`v-${v.vendedor_id}`)?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-left bg-[#1e0f35] border border-purple-800/30 rounded-lg p-4 hover:border-purple-600/50"
              >
                <div className="text-sm text-neutral-100 font-medium truncate">{v.vendedor_nome}</div>
                <div className={`text-3xl font-bold ${corPct(v.placar.pct)}`}>{v.placar.pct}%</div>
                <div className="text-xs text-purple-300/60">{v.placar.registradas} de {v.placar.empresas} empresas registradas</div>
                <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                  {v.placar.nao_registradas > 0 && <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-300">{v.placar.nao_registradas} não registrou</span>}
                  {v.placar.duvida > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">{v.placar.duvida} a conferir</span>}
                  {v.placar.reunioes_marcadas > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">{v.placar.reunioes_marcadas} reunião marcada</span>}
                  {v.placar.reunioes_fora_agenda > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">📅 {v.placar.reunioes_fora_agenda} fora da agenda</span>}
                  {v.placar.nao_citados > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-200">🔍 {v.placar.nao_citados} não citou</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Detalhe por vendedor */}
          <div className="mt-6 space-y-4">
            {vendedores.map((v) => {
              const aberta = aberto[v.vendedor_id] ?? false;
              return (
                <div key={v.vendedor_id} id={`v-${v.vendedor_id}`} className="bg-[#1e0f35] border border-purple-800/30 rounded-lg overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-purple-800/20">
                    <button onClick={() => setAberto((a) => ({ ...a, [v.vendedor_id]: !aberta }))} className="flex-1 min-w-0 text-left">
                      <span className="text-sm font-medium text-neutral-100">{aberta ? '▾' : '▸'} {v.vendedor_nome}</span>
                      <span className="ml-2 text-xs text-purple-300/50 truncate">{v.assunto}</span>
                    </button>
                    <span className="text-xs text-purple-300/40">
                      {v.enviado_em ? `enviado ${hora(v.enviado_em)} · ` : ''}leitura {reais(v.custo_reais || 0)}
                    </span>
                    <button onClick={() => abrirCobranca(v)}
                      className="px-2.5 py-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs font-bold hover:bg-amber-500/20">
                      📋 Cobrar
                    </button>
                    <button onClick={() => apagar(v)} className="text-xs text-red-400/70 hover:text-red-300">Apagar leitura</button>
                  </div>
                  {cobranca[v.vendedor_id] && (() => {
                    const c = cobranca[v.vendedor_id];
                    return (
                      <div className="px-4 py-3 border-b border-purple-800/20 bg-amber-500/5">
                        <p className="text-xs text-amber-200/90 mb-1.5">
                          Mensagem pronta {c.pontos ? `com ${c.pontos} ajuste(s)` : '(sem ajustes: só elogio)'} — pode editar antes de mandar.
                        </p>
                        <textarea value={c.texto} onChange={(e) => setCobranca((m) => ({ ...m, [v.vendedor_id]: { ...c, texto: e.target.value, estado: null } }))}
                          rows={Math.min(14, c.texto.split('\n').length + 2)}
                          className="w-full rounded-lg border border-purple-700/30 bg-[#2a1245] px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button onClick={() => mandarNoCrm(v)} disabled={c.estado === 'enviando'}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 text-[#1a0a2e] text-xs font-bold hover:bg-amber-400 disabled:opacity-50">
                            {c.estado === 'enviando' ? 'Mandando...' : 'Mandar no CRM (sino + celular)'}
                          </button>
                          <a href={`https://wa.me/?text=${encodeURIComponent(c.texto)}`} target="_blank" rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 text-xs font-bold hover:bg-green-500/20">
                            Abrir no WhatsApp
                          </a>
                          <button onClick={() => { navigator.clipboard?.writeText(c.texto); setCobranca((m) => ({ ...m, [v.vendedor_id]: { ...c, estado: 'copiada' } })); }}
                            className="px-3 py-1.5 rounded-lg border border-purple-700/40 text-purple-200 text-xs font-semibold hover:bg-purple-800/30">
                            Copiar
                          </button>
                          <button onClick={() => setCobranca((m) => { const n = { ...m }; delete n[v.vendedor_id]; return n; })}
                            className="ml-auto text-xs text-neutral-500 hover:text-neutral-300">Fechar</button>
                          {c.estado === 'copiada' && <span className="text-xs text-emerald-300">copiada ✓</span>}
                          {c.estado === 'enviada' && <span className="text-xs text-emerald-300">mandada pro {v.vendedor_nome.split(' ')[0]} ✓ (aparece no sino e no aviso de cobrança dele)</span>}
                          {c.estado && c.estado.startsWith('erro:') && <span className="text-xs text-red-300">{c.estado.slice(5)}</span>}
                        </div>
                      </div>
                    );
                  })()}
                  {aberta && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-purple-300/50 border-b border-purple-800/20">
                            <th className="text-left py-2 px-3">No CRM</th>
                            <th className="text-left py-2 px-3">Empresa (e-mail)</th>
                            <th className="text-left py-2 px-3">Disse no e-mail</th>
                            <th className="text-left py-2 px-3">O que o CRM tem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {v.linhas.map((l, i) => {
                            const s = SITUACAO[l.situacao];
                            return (
                              <tr key={i} className="border-b border-purple-800/10 align-top">
                                <td className="py-2 px-3 whitespace-nowrap">
                                  <span className={`inline-block px-1.5 py-0.5 rounded border ${s.cor}`}>{s.icone} {s.rotulo}</span>
                                </td>
                                <td className="py-2 px-3 text-neutral-100">
                                  <div className="font-medium">{l.empresa}</div>
                                  {l.pessoa && <div className="text-purple-300/50">{l.pessoa}</div>}
                                </td>
                                <td className="py-2 px-3 text-neutral-300 max-w-sm">
                                  <span className="text-purple-200">{RESULTADO[l.resultado]}</span> · {l.resumo}
                                  {l.proximo_passo && <div className="text-purple-300/50">Próximo: {l.proximo_passo}{l.data_proximo_passo ? ` (${dataBR(l.data_proximo_passo)})` : ''}</div>}
                                </td>
                                <td className="py-2 px-3 text-neutral-300 max-w-sm">
                                  {l.contato ? (
                                    <Link href={`/contacts/${l.contato.id}`} className="text-emerald-300 hover:underline">{l.contato.nome}</Link>
                                  ) : l.candidatos.length ? (
                                    <div>
                                      <span className="text-purple-300/60">{l.situacao === 'provavel' ? 'Talvez:' : 'Fichas com esse nome:'} </span>
                                      {l.candidatos.map((c, k) => (
                                        <span key={c.id}>{k > 0 && ' / '}<Link href={`/contacts/${c.id}`} className="text-emerald-300 hover:underline">{c.nome}</Link></span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-purple-300/40">Nenhuma ficha com esse nome</span>
                                  )}
                                  {l.contato?.status && <span className="ml-1 text-purple-300/50">· {formatStatus(l.contato.status)}</span>}
                                  {l.interacoes.map((it) => (
                                    <div key={it.id} className="text-purple-300/60">
                                      {hora(it.happened_at)} {formatInteractionType(it.type)}{it.outcome ? ` · ${formatInteractionOutcome(it.outcome)}` : ''}
                                    </div>
                                  ))}
                                  {l.detalhe_alerta && <div className="mt-1 text-amber-300">⚠ {l.detalhe_alerta}</div>}
                                </td>
                              </tr>
                            );
                          })}
                          {v.nao_citados.map((n) => (
                            <tr key={n.contato.id} className="border-b border-purple-800/10 align-top bg-purple-500/5">
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className="inline-block px-1.5 py-0.5 rounded border text-purple-200 bg-purple-500/10 border-purple-500/30">🔍 Não citou</span>
                              </td>
                              <td className="py-2 px-3 text-purple-300/50">—</td>
                              <td className="py-2 px-3 text-purple-300/50">Não está no e-mail</td>
                              <td className="py-2 px-3 text-neutral-300">
                                <Link href={`/contacts/${n.contato.id}`} className="text-emerald-300 hover:underline">{n.contato.nome}</Link>
                                {n.interacoes.map((it) => (
                                  <div key={it.id} className="text-purple-300/60">
                                    {hora(it.happened_at)} {formatInteractionType(it.type)}{it.outcome ? ` · ${formatInteractionOutcome(it.outcome)}` : ''}
                                  </div>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
