import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ContatoReferencia, CAMPOS_CONTATO_REFERENCIA } from '@/lib/indicacoes/contexto';
import { preencherVazios, CAMPOS_PREENCHIVEIS_SELECT } from '@/lib/receita/preencher';
import { conferirCnpjDoCliente, resumoEmpresa, type EmpresaAchada } from '@/lib/receita/conferir';
import { carregarConhecidos, conhecidosPorNome, juntar, jaConhecida } from '@/lib/indicacoes/ja-no-crm';
import {
  MODELO, DIAS_CACHE_IA, MIN_EMPRESAS, MAX_EMPRESAS, POR_RODADA, PEDIDOS_POR_RODADA, MAX_RODADAS,
  EmpresaIA, DadosOficiais, montarPedido, iniciarBusca, consultarBusca, cancelarBusca, lerResposta, custoEmReais, lerCnpj,
} from '@/lib/indicacoes/ia';
import { normalizeCNPJ, normalizeName, normalizePhone } from '@/lib/utils/normalize';
import { cnpjValido, formatarCnpj, limparCnpj, type DadosReceita } from '@/lib/receita/cnpj';
import { filtrarPorPorte } from '@/lib/indicacoes/porte';
import { salvarComoContato } from '@/lib/indicacoes/salvar';
import { getContactCoords } from '@/lib/data/brazil-cities-coords';

// Motor da busca de indicacoes com IA (saiu da rota em 06/10 pra poder andar tambem
// sem a janela aberta — ver avancarBuscasParadas).
//
// Cada RODADA dispara 2 pedidos na OpenAI ao mesmo tempo, por angulos diferentes, e so e
// processada quando os dois terminam. Quem processa e quem conseguir a trava (campo
// "passo" do job): a janela do vendedor (perguntando a cada 4s) ou o empurrao automatico.
// Assim uma rodada nunca e salva nem cobrada duas vezes.

const MINUTOS_MAX_RODADA = 4;
// O pedido diz "ate 100 km", mas a IA as vezes ignora (teste de 06/10: Criciuma/SC numa busca
// de Sao Jose do Rio Preto). Confere pela cidade e descarta longe demais; cidade desconhecida passa.
const KM_MAXIMO = 200; // folga sobre os 100 km pedidos: Ribeirao Preto (~170 km de Rio Preto) ainda entra
function km(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180;
  const h = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const MS_TRAVA_VELHA = 90_000;

export type Admin = ReturnType<typeof getAdminClient>;

export type MetaJob = {
  chave: string; contato_id: string; user_id: string; alvo: string; custo_mostrado?: number | null;
  rodada?: number; // 0 = achando o CNPJ do cliente; 1..MAX_RODADAS = rodadas de indicacoes
  resposta?: string; // (buscas de antes de 06/10: um pedido so por rodada)
  respostas?: string[]; // pedidos da rodada atual na OpenAI (2 ao mesmo tempo)
  passo?: number; // sobe a cada rodada processada: e a trava que impede processar (e cobrar) duas vezes
  processando?: number | null; // quando alguem comecou a processar a rodada (trava velha > 90s e assumida)
  empresas?: EmpresaIA[]; custo_reais?: number; pesquisas?: number;
  receita?: DadosOficiais | null; parecidos?: string[]; inicio?: string; perfil?: string | null;
  vazias?: number; // rodadas seguidas sem empresa nova
  pequenas?: string[]; // descartadas pela Receita (micro/pequena/fechada): nao podem voltar
  jaNoCrm?: string[]; // devolvidas pela IA mas ja cadastradas: sairam da lista e nao podem voltar
  cnpjCliente?: string | null; // CNPJ do cliente achado e confirmado na rodada zero
  // contato SEM cidade: a busca pausa ate o vendedor confirmar que a empresa achada e o cliente
  aguardando?: EmpresaAchada | null;
  cadastro?: string[]; // campos do cadastro que a Receita preencheu
};

export const AGUARDANDO = 'aguardando-confirmacao';

export const paraOficiais = (d: DadosReceita): DadosOficiais =>
  ({ razao_social: d.razao_social, cnae_principal: d.cnae_principal, cnaes_secundarios: d.cnaes_secundarios, porte: d.porte });

// Regra do dono (06/10): achou o CNPJ do cliente -> completa o cadastro com a Receita
// (cidade, endereco, CEP, telefone...) ANTES de buscar as indicacoes. So campos vazios.
// Devolve o contato relido, ja com a cidade nova, e os campos preenchidos.
export async function completarCadastro(admin: Admin, contato: ContatoReferencia, dados: DadosReceita) {
  const { data: atual } = await admin.from('contacts').select(CAMPOS_PREENCHIVEIS_SELECT)
    .eq('id', contato.id).eq('organization_id', contato.organization_id).single();
  const registro = (atual || {}) as unknown as Record<string, unknown>;
  const digitos = limparCnpj(dados.cnpj);
  const temCnpj = !!limparCnpj(registro.cnpj as string | null);
  const extras: Record<string, string> = !temCnpj && digitos ? { cnpj: formatarCnpj(digitos), cnpj_digits: digitos } : {};
  const { atualizados, erro, avisos } = await preencherVazios(admin, registro, dados, extras);
  if (erro) console.warn('[indicacoes IA] nao completou o cadastro', contato.id, erro);
  const { data: novo } = await admin.from('contacts').select(CAMPOS_CONTATO_REFERENCIA)
    .eq('id', contato.id).eq('organization_id', contato.organization_id).single();
  // avisos (ex.: CNPJ ja em outro contato) vao junto, pro vendedor ver na tela
  const cadastro = [...atualizados, ...avisos];
  return { contato: (novo as unknown as ContatoReferencia) || contato, cadastro };
}

// clientes que ja temos com o mesmo segmento: exemplo do cliente ideal pra IA
export async function parecidosNoCrm(admin: Admin, c: ContatoReferencia) {
  if (!c.segmento) return [];
  const { data } = await admin.from('contacts').select('name, cidade')
    .eq('organization_id', c.organization_id).eq('is_draft', false)
    .ilike('segmento', c.segmento).neq('id', c.id).limit(5);
  return (data || []).map((x) => `${x.name}${x.cidade ? ` (${x.cidade})` : ''}`);
}

// marca quem ja esta no CRM (por CNPJ, telefone ou nome) em vez de esconder
async function marcarJaNoCrm(admin: Admin, orgId: string, empresas: EmpresaIA[]) {
  const cnpjs = empresas.map((e) => normalizeCNPJ(e.cnpj)).filter(Boolean) as string[];
  const fones = empresas.flatMap((e) => [normalizePhone(e.telefone), normalizePhone(e.whatsapp)]).filter(Boolean) as string[];
  const nomes = empresas.map((e) => normalizeName(e.nome)).filter(Boolean);

  const filtros = [
    cnpjs.length ? `cnpj_digits.in.(${cnpjs.join(',')})` : null,
    fones.length ? `phone_normalized.in.(${fones.join(',')})` : null,
    nomes.length ? `name_normalized.in.(${nomes.map((n) => `"${n.replace(/"/g, '')}"`).join(',')})` : null,
  ].filter(Boolean).join(',');
  if (!filtros) return empresas;

  const { data } = await admin.from('contacts')
    .select('name_normalized, phone_normalized, cnpj_digits')
    .eq('organization_id', orgId).or(filtros).limit(200);

  const ja = new Set<string>();
  for (const c of data || []) for (const v of [c.name_normalized, c.phone_normalized, c.cnpj_digits]) if (v) ja.add(v);
  return empresas.map((e) => ({
    ...e,
    jaNoCrm: [normalizeName(e.nome), normalizeCNPJ(e.cnpj), normalizePhone(e.telefone), normalizePhone(e.whatsapp)]
      .some((v) => v && ja.has(v)),
  }));
}

// diz, pra cada empresa salva, se ainda e rascunho ou ja foi jogada pro funil
export async function situacaoNoFunil(admin: Admin, orgId: string, empresas: EmpresaIA[]) {
  const ids = empresas.map((e) => e.contatoId).filter(Boolean) as string[];
  if (!ids.length) return empresas;
  const { data } = await admin.from('contacts').select('id, is_draft')
    .eq('organization_id', orgId).in('id', ids);
  const estado = new Map((data || []).map((c) => [c.id, c.is_draft as boolean]));
  return empresas.map((e) => {
    if (!e.contatoId) return e;
    if (!estado.has(e.contatoId)) return { ...e, contatoId: null, apagado: true }; // alguem excluiu
    return { ...e, noFunil: estado.get(e.contatoId) === false };
  });
}

export async function lerJob(admin: Admin, orgId: string, job: string) {
  // o job precisa ser desta empresa: sem isso, qualquer um consultaria buscas alheias pelo id
  const { data } = await admin.from('ai_analysis_cache').select('result, created_at')
    .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB').eq('cache_key', job).maybeSingle();
  if (!data) return null;
  return { meta: data.result as MetaJob, criadoEm: data.created_at as string };
}


// tenta pegar a rodada pra processar: so um processo consegue (o "passo" sobe)
async function travar(admin: Admin, orgId: string, job: string, meta: MetaJob) {
  const passo = meta.passo ?? 0;
  const { data } = await admin.from('ai_analysis_cache')
    .update({ result: { ...meta, passo: passo + 1, processando: Date.now() } })
    .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB').eq('cache_key', job)
    .eq('result->>passo', String(passo))
    .select('id');
  return data?.length ? { ...meta, passo: passo + 1, processando: Date.now() } as MetaJob : null;
}

export async function acompanhar(admin: Admin, contato: ContatoReferencia, job: string) {
  const orgId = contato.organization_id;
  const registro = await lerJob(admin, orgId, job);
  if (!registro) return NextResponse.json({ status: 'finalizada-em-outra-aba' });

  const meta = registro.meta;
  const rodada = meta.rodada ?? 1;
  const acumuladas = meta.empresas || [];
  const segundos = Math.round((Date.now() - new Date(meta.inicio || registro.criadoEm).getTime()) / 1000);
  const parcial = async () => NextResponse.json({
    status: 'pesquisando', segundos, rodada, maxRodadas: MAX_RODADAS, maximo: MAX_EMPRESAS,
    empresas: await situacaoNoFunil(admin, orgId, acumuladas), custo_ate_agora: meta.custo_reais || 0,
  });

  if (meta.aguardando) {
    return NextResponse.json({ status: 'confirmar_cnpj', segundos, empresa: meta.aguardando, custo_ate_agora: meta.custo_reais || 0 });
  }
  // busca de antes de 06/10 (um pedido por rodada, sem trava nova): encerra com o que achou
  if (meta.passo == null) return finalizar(admin, contato, job, meta, 'versao anterior');
  // outro processo esta salvando esta rodada (trava recente)
  if (meta.processando && Date.now() - meta.processando < MS_TRAVA_VELHA) return parcial();

  const ids = meta.respostas || [];
  const resps = await Promise.all(ids.map((id) => consultarBusca(id)));
  const andando = resps.filter((r) => r.status === 'queued' || r.status === 'in_progress');
  if (andando.length) {
    const maisVelho = Math.max(...andando.map((r) => Math.round(Date.now() / 1000 - (r.created_at || 0))));
    if (maisVelho < MINUTOS_MAX_RODADA * 60) return parcial();
    await Promise.all(andando.map((r) => cancelarBusca(r.id))); // pedido travado: segue com o que tem
  }

  const travado = await travar(admin, orgId, job, meta);
  if (!travado) return parcial();

  if (rodada === 0) return depoisDaRodadaZero(admin, contato, job, travado, resps[0], segundos);

  // le os dois pedidos da rodada (o segundo ja sem repetir o que o primeiro trouxe)
  let custo = travado.custo_reais || 0;
  let pesquisas = travado.pesquisas || 0;
  const vistas = [...acumuladas.map((e) => e.nome), ...(travado.pequenas || []), ...(travado.jaNoCrm || [])];
  const lidas: EmpresaIA[] = [];
  const resumo: Record<string, unknown>[] = [];
  let perfil = travado.perfil || null;
  for (const resp of resps) {
    const lido = lerResposta(resp, contato.company || contato.name, [...vistas, ...lidas.map((e) => e.nome)]);
    custo += custoEmReais(resp.usage, lido.pesquisas);
    pesquisas += lido.pesquisas;
    lidas.push(...lido.empresas);
    perfil = perfil || lido.segmentoPesquisado;
    resumo.push({ status: resp.status, pesquisas: lido.pesquisas, lidas: lido.lidas, descartadas: lido.descartadas, repetidas: lido.repetidas, uso: resp.usage });
  }

  const origem = getContactCoords(contato.cidade, contato.estado);
  const longe: string[] = [];
  const perto = lidas.filter((e) => {
    const p = origem && e.cidade ? getContactCoords(e.cidade, e.estado || contato.estado) : null;
    if (origem && p && km(origem, p) > KM_MAXIMO) { longe.push(`${e.nome} (${e.cidade}, ${Math.round(km(origem, p))} km)`); return false; }
    return true;
  });
  const porPorte = await filtrarPorPorte(perto);
  const pequenas = [...(travado.pequenas || []), ...porPorte.descartadas.map((d) => d.nome), ...longe.map((l) => l.replace(/ \(.*$/, ''))];

  // regra do dono (06/10): quem ja esta no CRM sai da lista (nao ocupa vaga).
  // Confere contra os contatos da regiao (CNPJ, telefone, site, nome parecido) e a empresa toda (nome exato).
  const [conhecidos, porNome, marcadas] = await Promise.all([
    carregarConhecidos(admin, orgId, contato.cidade, contato.estado),
    conhecidosPorNome(admin, orgId, porPorte.empresas),
    marcarJaNoCrm(admin, orgId, porPorte.empresas),
  ]);
  const todosConhecidos = juntar(conhecidos, porNome);
  const jaNoCrm = [...(travado.jaNoCrm || [])];
  const foraPorCrm: string[] = [];
  const novas: EmpresaIA[] = [];
  for (const e of marcadas) {
    if (novas.length >= MAX_EMPRESAS - acumuladas.length) break;
    const porque = e.jaNoCrm ? 'nome' : jaConhecida(e, todosConhecidos);
    if (porque) { jaNoCrm.push(e.nome); foraPorCrm.push(`${e.nome} (${porque})`); continue; }
    // salva como rascunho atribuido a quem pagou a busca
    const r = await salvarComoContato(admin, {
      organizationId: orgId, userId: travado.user_id, referencia: contato, empresa: e, rascunho: true,
    });
    // erro aqui quase sempre e o indice unico de telefone/e-mail/CNPJ: ja existe no CRM
    if (!r.id) { jaNoCrm.push(e.nome); foraPorCrm.push(`${e.nome} (indice unico)`); continue; }
    // completa o rascunho com a Receita (telefone, e-mail, socio...) — so campos vazios, sem custo
    const d = porPorte.receita.get(e.nome);
    let completa = e;
    if (d) {
      const { data: reg } = await admin.from('contacts').select(CAMPOS_PREENCHIVEIS_SELECT).eq('id', r.id).single();
      const p = await preencherVazios(admin, (reg || {}) as unknown as Record<string, unknown>, d);
      if (p.atualizados.includes('Telefone')) completa = { ...completa, telefone: d.telefone };
      if (p.atualizados.includes('Email')) completa = { ...completa, email: d.email };
      if (p.atualizados.includes('Endereco')) completa = { ...completa, endereco: completa.endereco || d.endereco_completo };
    }
    novas.push({ ...completa, contatoId: r.id });
  }
  const empresas = [...acumuladas, ...novas].map((e, i) => ({ ...e, osmId: `ia/${i}/${e.osmId.split('/').pop()}` }));

  console.log('[indicacoes IA] rodada', JSON.stringify({
    job, rodada, pedidos: resumo, novas: novas.length, pequenas: porPorte.descartadas, longe, ja_no_crm: foraPorCrm,
    total: empresas.length, custo_rodada: custo - (travado.custo_reais || 0), custo_total: custo,
  }));

  // nicho estreito: um angulo pode vir vazio e o seguinte render; 2 rodadas vazias seguidas encerram
  const vazias = novas.length === 0 ? (travado.vazias || 0) + 1 : 0;
  const novoMeta: MetaJob = { ...travado, empresas, custo_reais: custo, pesquisas, vazias, pequenas, jaNoCrm, perfil };
  const falharam = resps.length > 0 && resps.every((r) => r.status !== 'completed');
  const acabou = falharam || empresas.length >= MAX_EMPRESAS || rodada >= MAX_RODADAS || vazias >= 2;

  if (acabou) {
    const motivo = empresas.length >= MAX_EMPRESAS ? 'completa'
      : falharam ? `rodada ${resps[0]?.status}` : vazias >= 2 ? 'sem novas' : 'rodadas esgotadas';
    return finalizar(admin, contato, job, novoMeta, motivo);
  }

  // proxima rodada: mais 2 pedidos por outros angulos, sem repetir ninguem
  const proximas = await iniciarRodada(admin, contato, novoMeta, rodada + 1, conhecidos.nomes);
  const { data: seguiu } = await admin.from('ai_analysis_cache')
    .update({ result: { ...novoMeta, rodada: rodada + 1, respostas: proximas, processando: null } })
    .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB').eq('cache_key', job)
    .select('id');
  // o consultor apertou "Parar" enquanto esta rodada era salva: nao deixa pedido orfao gastando
  if (!seguiu?.length) await Promise.all(proximas.map(cancelarBusca));

  return NextResponse.json({
    status: 'pesquisando', segundos, rodada: rodada + 1, maxRodadas: MAX_RODADAS, maximo: MAX_EMPRESAS,
    empresas: await situacaoNoFunil(admin, orgId, empresas), custo_ate_agora: custo,
  });
}

// dispara os 2 pedidos de uma rodada ao mesmo tempo (angulos 2n-1 e 2n)
export async function iniciarRodada(admin: Admin, contato: ContatoReferencia, meta: MetaJob, rodada: number, jaClientes?: string[]) {
  const nomesCrm = jaClientes ?? (await carregarConhecidos(admin, contato.organization_id, contato.cidade, contato.estado)).nomes;
  const excluir = [...(meta.empresas || []).map((e) => e.nome), ...(meta.pequenas || []), ...(meta.jaNoCrm || [])];
  // com a atividade oficial da Receita a IA nao gasta pesquisa conferindo o site do cliente
  const perfil = meta.perfil
    || (meta.receita?.cnae_principal ? `${meta.receita.cnae_principal}${contato.segmento ? ` — ${contato.segmento}` : ''}` : null);
  return Promise.all(Array.from({ length: PEDIDOS_POR_RODADA }, async (_, i) => {
    const { instrucoes, pedido } = montarPedido(
      { ...contato, cidade: contato.cidade || '' }, meta.receita, meta.parecidos || [],
      { numero: (rodada - 1) * PEDIDOS_POR_RODADA + i + 1, quantas: POR_RODADA, excluir, perfilConfirmado: perfil, jaClientes: nomesCrm }
    );
    return (await iniciarBusca(instrucoes, pedido, { contexto: 'low' })).id;
  }));
}

// Rodada zero terminou: confere o CNPJ achado na Receita.
// - contato COM cidade: confirmado (cidade + nome) -> completa o cadastro e dispara a rodada 1.
// - contato SEM cidade: confirmado pelo nome -> PAUSA e pergunta ao vendedor se e o cliente
//   (nome parecido engana: gravar cidade errada no cadastro e pior que deixar em branco).
//   Sem CNPJ confirmavel nao ha onde buscar: encerra pedindo a cidade.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function depoisDaRodadaZero(admin: Admin, contato: ContatoReferencia, job: string, meta: MetaJob, resp: any, segundos: number) {
  const orgId = contato.organization_id;
  const achado = lerCnpj(resp);
  const custo = (meta.custo_reais || 0) + custoEmReais(resp.usage, achado.pesquisas);
  const pesquisas = (meta.pesquisas || 0) + achado.pesquisas;
  let motivo: string | null = achado.cnpj ? null : 'IA não achou o CNPJ';
  let dados: DadosReceita | null = null;

  if (achado.cnpj && cnpjValido(achado.cnpj)) {
    const conf = await conferirCnpjDoCliente(contato, achado.cnpj);
    motivo = conf.motivo;
    dados = conf.dados;
  }

  console.log('[indicacoes IA] rodada zero (CNPJ do cliente)', JSON.stringify({
    job, achado: achado.cnpj, fonte: achado.fonte, confirmado: !!dados, semCidade: !contato.cidade, motivo,
    cnae: dados?.cnae_principal, porte: dados?.porte, pesquisas: achado.pesquisas, custo_rodada: custo - (meta.custo_reais || 0),
  }));

  if (!contato.cidade) {
    if (!dados) {
      return finalizar(admin, contato, job, { ...meta, custo_reais: custo, pesquisas }, 'sem cidade',
        `Não achei o CNPJ deste cliente pelo nome${motivo ? ` (${motivo})` : ''}. Preencha a cidade ou o CNPJ na ficha e busque de novo.`);
    }
    const empresa = resumoEmpresa(dados);
    await admin.from('ai_analysis_cache')
      .update({ result: { ...meta, custo_reais: custo, pesquisas, aguardando: empresa, respostas: [], resposta: AGUARDANDO, processando: null } })
      .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB').eq('cache_key', job);
    return NextResponse.json({ status: 'confirmar_cnpj', segundos, empresa, custo_ate_agora: custo });
  }

  let ref = contato;
  let cadastro: string[] = meta.cadastro || [];
  if (dados) ({ contato: ref, cadastro } = await completarCadastro(admin, contato, dados));
  return iniciarRodadaUm(admin, ref, job, { ...meta, custo_reais: custo, pesquisas, cadastro }, dados, segundos, motivo);
}

// dispara a primeira rodada de indicacoes (depois do CNPJ conferido, ou sem ele)
export async function iniciarRodadaUm(
  admin: Admin, contato: ContatoReferencia, job: string, meta: MetaJob,
  dados: DadosReceita | null, segundos: number, motivo: string | null
) {
  const orgId = contato.organization_id;
  const receita = dados ? paraOficiais(dados) : meta.receita || null;
  const cnpjCliente = dados ? formatarCnpj(limparCnpj(dados.cnpj) as string) : null;
  const novoMeta: MetaJob = { ...meta, receita, cnpjCliente, aguardando: null };
  const respostas = await iniciarRodada(admin, { ...contato, cnpj: contato.cnpj || cnpjCliente }, novoMeta, 1);
  const { data: seguiu } = await admin.from('ai_analysis_cache')
    .update({ result: { ...novoMeta, rodada: 1, respostas, resposta: undefined, processando: null } })
    .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB').eq('cache_key', job)
    .select('id');
  if (!seguiu?.length) await Promise.all(respostas.map(cancelarBusca)); // parado enquanto conferia

  return NextResponse.json({
    status: 'pesquisando', segundos, rodada: 1, maxRodadas: MAX_RODADAS, maximo: MAX_EMPRESAS,
    empresas: [], custo_ate_agora: meta.custo_reais || 0, cnpjCliente, cnpjMotivo: motivo, cadastro: meta.cadastro || [],
  });
}

export async function finalizar(admin: Admin, contato: ContatoReferencia, job: string, meta: MetaJob, motivo: string, erroTexto?: string) {
  const orgId = contato.organization_id;
  // so quem conseguir apagar o job grava o resultado e o custo (evita cobrar duas vezes)
  const { data: apagado } = await admin.from('ai_analysis_cache').delete()
    .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB').eq('cache_key', job).select('id');
  if (!apagado?.length) return NextResponse.json({ status: 'finalizada-em-outra-aba' });

  const empresas = meta.empresas || [];
  const custo = Math.round((meta.custo_reais || 0) * 100) / 100;

  await admin.from('ai_analysis_cache').insert({
    organization_id: orgId,
    analysis_type: 'INDICACOES_IA_USO',
    cache_key: job,
    result: {
      chave: meta.chave, contato_id: contato.id, user_id: meta.user_id, modelo: MODELO, motivo,
      rodadas: meta.rodada ?? 1, versao: 2, pesquisas: meta.pesquisas || 0, empresas: empresas.length,
      salvas: empresas.filter((e) => e.contatoId).length, custo_reais: custo, custo_mostrado: meta.custo_mostrado ?? null,
    },
    expires_at: new Date(Date.now() + 365 * 864e5).toISOString(),
  });

  console.log('[indicacoes IA] finalizada', JSON.stringify({ job, motivo, empresas: empresas.length, custo_reais: custo }));

  if (!empresas.length) {
    return NextResponse.json({
      status: 'falhou', custo_reais: custo,
      erro: erroTexto || (motivo === 'parada' ? 'Busca parada antes de achar empresas.' : 'A IA não achou nenhuma empresa com fonte comprovada.'),
    });
  }

  await admin.from('ai_analysis_cache').insert({
    organization_id: orgId,
    analysis_type: 'INDICACOES_IA',
    cache_key: meta.chave,
    result: { empresas, alvo: meta.alvo, modelo: MODELO, motivo, user_id: meta.user_id, custo_reais: custo },
    // guardada pra sempre: o dono quer poder rever qualquer busca ja feita
    expires_at: new Date(Date.now() + DIAS_CACHE_IA * 864e5).toISOString(),
  });

  return NextResponse.json({
    status: 'pronta', motivo,
    empresas: await situacaoNoFunil(admin, orgId, empresas),
    custo_reais: custo,
    poucas: empresas.length < MIN_EMPRESAS,
    maximo: MAX_EMPRESAS,
  });
}

// Busca abandonada (vendedor fechou a janela no meio): antes ela parava de andar, ja paga
// e contando no limite do dia. Agora qualquer tela do CRM aberta empurra as buscas paradas
// (chamado depois da resposta de /api/notifications/count, que toda tela consulta a cada 30s).
// A trava do job garante que janela e empurrao nunca processam a mesma rodada.
let ultimoEmpurrao = 0;
export async function avancarBuscasParadas() {
  if (Date.now() - ultimoEmpurrao < 15_000) return;
  ultimoEmpurrao = Date.now();
  const admin = getAdminClient();
  const { data } = await admin.from('ai_analysis_cache').select('organization_id, cache_key, result')
    .eq('analysis_type', 'INDICACOES_IA_JOB').gt('expires_at', new Date().toISOString()).limit(5);
  for (const j of data || []) {
    const meta = j.result as MetaJob;
    if (meta.aguardando) continue; // esperando o vendedor confirmar a empresa: so ele pode seguir
    try {
      const { data: c } = await admin.from('contacts').select(CAMPOS_CONTATO_REFERENCIA)
        .eq('id', meta.contato_id).eq('organization_id', j.organization_id).single();
      if (c) await acompanhar(admin, c as unknown as ContatoReferencia, j.cache_key);
    } catch (e) {
      console.warn('[indicacoes IA] empurrao falhou', j.cache_key, e instanceof Error ? e.message : e);
    }
  }
}
