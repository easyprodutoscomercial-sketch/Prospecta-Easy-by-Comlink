'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DadosReceita } from '@/lib/receita/cnpj';

interface Props {
  contactId: string;
  temCnpj: boolean;
  empresa?: string | null;
  nome?: string | null;
}

interface Resposta {
  dados: DadosReceita | null;
  atualizados?: string[];
  sem_cnpj?: boolean;
  erro?: string;
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-purple-300/80 font-semibold mb-0.5">{rotulo}</p>
      {valor ? (
        <p className="text-sm font-medium text-neutral-100 break-words">{valor}</p>
      ) : (
        <p className="text-sm text-neutral-600 italic">Nao informado</p>
      )}
    </div>
  );
}

function data(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
}

function moeda(v: number | null) {
  if (v == null) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ContactReceita({ contactId, temCnpj, empresa, nome }: Props) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(temCnpj);
  const [resp, setResp] = useState<Resposta | null>(null);
  const [cnpjDigitado, setCnpjDigitado] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroCampo, setErroCampo] = useState<string | null>(null);

  const temCnpjAgora = temCnpj || Boolean(resp?.dados);

  // o vendedor informa o CNPJ: salva no contato e ja consulta a Receita
  async function enviarCnpj(e: React.FormEvent) {
    e.preventDefault();
    const digitos = cnpjDigitado.replace(/\D/g, '');
    if (digitos.length !== 14) {
      setErroCampo('O CNPJ tem 14 digitos. Faltam ' + (14 - digitos.length) + '.');
      return;
    }
    setErroCampo(null);
    setSalvando(true);
    try {
      const r = await fetch(`/api/contacts/${contactId}/receita`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: digitos }),
      });
      const json: Resposta = await r.json();
      if (!r.ok || (json.erro && !json.dados)) {
        setErroCampo(json.erro || 'Nao consegui consultar esse CNPJ.');
        return;
      }
      setResp(json);
      router.refresh();
    } catch {
      setErroCampo('Falha de conexao. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  useEffect(() => {
    if (!temCnpj) return;
    let ativo = true;
    setCarregando(true);
    fetch(`/api/contacts/${contactId}/receita`)
      .then((r) => r.json())
      .then((json: Resposta) => {
        if (!ativo) return;
        setResp(json);
        // se algum campo vazio foi preenchido, recarrega a pagina pra mostrar os valores novos
        if (json.atualizados && json.atualizados.length > 0) router.refresh();
      })
      .catch(() => ativo && setResp({ dados: null, erro: 'Nao consegui consultar a Receita agora.' }))
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [contactId, temCnpj, router]);

  const cabecalho = (
    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Dados da Receita</p>
  );

  if (!temCnpjAgora) {
    const busca = encodeURIComponent(`${empresa || nome || ''} CNPJ`.trim());
    return (
      <div className="pb-5 border-b border-purple-800/30">
        {cabecalho}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2.5">
            <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-200">Vendedor: falta o CNPJ deste contato</p>
              <p className="text-xs text-amber-100/80 mt-1 leading-relaxed">
                Busque o CNPJ da empresa e cadastre aqui. O sistema consulta a Receita Federal na hora e
                completa sozinho endereco, cidade, CEP, telefone e <strong>o nome e o cargo do socio que decide</strong>.
                Nada do que voce ja digitou e alterado.
              </p>

              <form onSubmit={enviarCnpj} className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={cnpjDigitado}
                  onChange={(e) => setCnpjDigitado(e.target.value)}
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  disabled={salvando}
                  className="flex-1 min-w-[180px] px-3 py-1.5 rounded-md bg-[#1a0b2e] border border-amber-500/30 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-amber-400/60 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-3 py-1.5 rounded-md bg-amber-500/90 hover:bg-amber-400 text-[#1a0b2e] text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-wait"
                >
                  {salvando ? 'Consultando...' : 'Buscar na Receita'}
                </button>
              </form>

              {erroCampo && <p className="mt-2 text-xs text-red-300">{erroCampo}</p>}

              {(empresa || nome) && (
                <a
                  href={`https://www.google.com/search?q=${busca}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2.5 text-xs text-amber-300/90 hover:text-amber-200 underline underline-offset-2"
                >
                  Nao sabe o CNPJ? Procurar &quot;{(empresa || nome || '').slice(0, 30)}&quot; no Google
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="pb-5 border-b border-purple-800/30">
        {cabecalho}
        <div className="flex items-center gap-2 text-sm text-purple-300/70">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-purple-400/40 border-t-purple-300 animate-spin" />
          Consultando a Receita Federal...
        </div>
      </div>
    );
  }

  const d = resp?.dados;

  if (!d) {
    return (
      <div className="pb-5 border-b border-purple-800/30">
        {cabecalho}
        <p className="text-sm text-amber-400/90">{resp?.erro || 'Sem dados da Receita para este CNPJ.'}</p>
      </div>
    );
  }

  const ativa = /ativa/i.test(d.situacao || '');
  const socios = d.socios.slice(0, 6);

  return (
    <div className="pb-5 border-b border-purple-800/30">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Dados da Receita</p>
        <div className="flex items-center gap-2">
          {d.situacao && (
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${ativa ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
              {d.situacao}
            </span>
          )}
          <span className="text-[10px] text-neutral-500">via {d.fonte}</span>
        </div>
      </div>

      {resp?.atualizados && resp.atualizados.length > 0 && (
        <p className="mb-3 text-xs text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-1.5">
          Preenchido automaticamente: {resp.atualizados.join(', ')}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Linha rotulo="Razao Social" valor={d.razao_social} /></div>
        <Linha rotulo="Nome Fantasia" valor={d.nome_fantasia} />
        <Linha rotulo="Matriz / Filial" valor={d.matriz_filial} />
        <Linha rotulo="Abertura" valor={data(d.data_abertura)} />
        <Linha rotulo="Porte" valor={d.porte} />
        <Linha rotulo="Capital Social" valor={moeda(d.capital_social)} />
        <Linha rotulo="Natureza Juridica" valor={d.natureza_juridica} />
        <Linha rotulo="Simples Nacional" valor={d.simples == null ? null : d.simples ? 'Optante' : 'Nao optante'} />
        <Linha rotulo="MEI" valor={d.mei == null ? null : d.mei ? 'Sim' : 'Nao'} />
        <div className="sm:col-span-2"><Linha rotulo="Atividade Principal (CNAE)" valor={d.cnae_principal} /></div>
        <div className="sm:col-span-2"><Linha rotulo="Endereco na Receita" valor={[d.endereco_completo, d.municipio, d.uf, d.cep].filter(Boolean).join(' - ') || null} /></div>
        <Linha rotulo="Telefone na Receita" valor={d.telefone} />
        <Linha rotulo="Email na Receita" valor={d.email} />
      </div>

      {socios.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-purple-300/80 font-semibold mb-2">Quadro Societario ({d.socios.length})</p>
          <div className="space-y-1.5">
            {socios.map((s, i) => (
              <div key={i} className="flex items-start justify-between gap-3 px-2.5 py-1.5 rounded-md bg-[#2a1245]/60 border border-purple-800/30">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-100 truncate">{s.nome}</p>
                  {s.qualificacao && <p className="text-xs text-purple-300/70">{s.qualificacao}</p>}
                </div>
                {s.entrada && <span className="text-[10px] text-neutral-500 shrink-0 mt-0.5">desde {data(s.entrada)}</span>}
              </div>
            ))}
            {d.socios.length > socios.length && (
              <p className="text-xs text-neutral-500 italic">+ {d.socios.length - socios.length} socio(s)</p>
            )}
          </div>
        </div>
      )}

      {d.cnaes_secundarios.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-purple-300/80 font-semibold mb-1.5">Atividades Secundarias</p>
          <ul className="space-y-0.5">
            {d.cnaes_secundarios.map((c, i) => (
              <li key={i} className="text-xs text-neutral-400">• {c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
