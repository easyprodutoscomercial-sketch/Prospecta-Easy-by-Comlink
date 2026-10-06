import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { contexto, ContatoReferencia } from '@/lib/indicacoes/contexto';
import {
  MODELO, DIAS_CACHE_IA, MIN_EMPRESAS, MAX_EMPRESAS, ESTIMATIVA_INICIAL_REAIS, POR_RODADA, MAX_RODADAS,
  EmpresaIA, DadosOficiais, chaveIA, montarPedido, iniciarBusca, consultarBusca, cancelarBusca, lerResposta, custoEmReais,
  montarPedidoCnpj, lerCnpj, MAX_PESQUISAS_CNPJ,
} from '@/lib/indicacoes/ia';
import { normalizeCNPJ, normalizeName, normalizePhone } from '@/lib/utils/normalize';
import { buscarDadosReceita, cnpjValido, formatarCnpj } from '@/lib/receita/cnpj';
import { filtrarPorPorte } from '@/lib/indicacoes/porte';
import { salvarComoContato } from '@/lib/indicacoes/salvar';
import { getContactCoords } from '@/lib/data/brazil-cities-coords';
import { hasFullVisibility } from '@/lib/utils/roles';
import { buscasPermitidas } from '@/lib/indicacoes/permissao';
import type { UserRole } from '@/lib/types';

// GET    /api/contacts/:id/indicacoes/ia          -> custo estimado, buscas que restam hoje e resultado guardado
// GET    /api/contacts/:id/indicacoes/ia?job=ID   -> andamento; devolve as empresas achadas ATE AGORA
// POST   /api/contacts/:id/indicacoes/ia          -> inicia a busca ({ confirmado: true } obrigatorio)
// DELETE /api/contacts/:id/indicacoes/ia?job=ID   -> para a busca e fica com o que ja achou
//
// A busca roda em RODADAS: cada uma pede poucas empresas novas por um angulo
// diferente, salva o que achou e dispara a proxima. Assim a tela vai enchendo,
// o consultor pode parar quando quiser, e ao chegar em 12 encerra sozinha.
// Cada rodada roda em segundo plano na OpenAI (a funcao da Vercel morre aos 60s).
//
// Toda empresa achada vira contato RASCUNHO atribuido a quem pagou a busca:
// fica salva no banco (nao se perde) mas fora do funil, ate alguem joga-la pro funil.
//
// Em ai_analysis_cache:
//   INDICACOES_IA      resultado final por cliente de referencia (equipe reve sem custo)
//   INDICACOES_IA_JOB  busca em andamento: rodada, resposta atual na OpenAI, empresas e custo acumulados
//   INDICACOES_IA_USO  uma linha por busca, com o custo real somado — base da estimativa e do limite diario
//
// Rodada ZERO (contato sem CNPJ): a IA acha o CNPJ do proprio cliente, a Receita
// confere (mesma cidade + nome) e ele e gravado no contato se o campo estiver vazio.
// Dai a busca usa a atividade oficial (CNAE) e o porte em vez de adivinhar pelo nome.

export const maxDuration = 30;
const MINUTOS_MAX_RODADA = 4;
const HORAS_REGISTRO_JOB = 24;

type Admin = ReturnType<typeof getAdminClient>;

type MetaJob = {
  chave: string; contato_id: string; user_id: string; alvo: string; custo_mostrado?: number | null;
  rodada?: number; resposta?: string; empresas?: EmpresaIA[]; custo_reais?: number; pesquisas?: number;
  receita?: DadosOficiais | null; parecidos?: string[]; inicio?: string; perfil?: string | null;
  vazias?: number; // rodadas seguidas sem empresa nova
  pequenas?: string[]; // descartadas pela Receita (micro/pequena/fechada): nao podem voltar
  cnpjCliente?: string | null; // CNPJ do cliente achado e confirmado na rodada zero
};

// Regra do dono (02/10): so contato APONTADO pode ter busca com IA. Vendedor so busca
// nos apontados pra ele (nao gasta a cota no cliente do colega); admin/gerente em qualquer apontado.
// Regra do dono (06/10): so busca quem o admin liberou em Admin > Usuarios (inclusive o admin).
function bloqueioDeBusca(c: ContatoReferencia, profile: { user_id: string; role: string }, limiteDia: number) {
  if (limiteDia <= 0) return 'Você não tem permissão para buscar indicações com IA. Peça ao administrador para liberar.';
  if (!c.assigned_to_user_id) return 'Aponte este contato para alguém antes de buscar indicações com IA.';
  if (!hasFullVisibility(profile.role as UserRole) && c.assigned_to_user_id !== profile.user_id) {
    return 'Só quem está apontado neste contato pode buscar indicações com IA.';
  }
  return null;
}

function alvoDaBusca(c: ContatoReferencia) {
  return c.segmento?.trim() || c.company?.trim() || c.name;
}

// Receita (CNAE e porte) e a pista mais forte de "empresa parecida", mas e servico
// externo: se demorar, a busca segue so com o cadastro.
async function dadosOficiais(cnpj: string | null): Promise<DadosOficiais | null> {
  if (!cnpj || !cnpjValido(cnpj)) return null;
  try {
    const d = await Promise.race([
      buscarDadosReceita(cnpj),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ]);
    return d ? { razao_social: d.razao_social, cnae_principal: d.cnae_principal, cnaes_secundarios: d.cnaes_secundarios, porte: d.porte } : null;
  } catch {
    return null;
  }
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const PALAVRAS_GENERICAS = new Set(['ltda', 'eireli', 'comercio', 'industria', 'servicos', 'maquinas', 'equipamentos',
  'empresa', 'brasil', 'distribuidora', 'de', 'da', 'do', 'dos', 'das', 'e', 'me', 'epp', 'sa', 'cia']);

// O CNPJ que a IA achou e mesmo deste cliente? Exige a MESMA cidade na Receita e
// uma palavra propria do nome (nao "ltda", "maquinas"...) na razao social ou fantasia.
// Sem isso, gravaria CNPJ de outra empresa no cadastro do cliente.
async function conferirCnpjDoCliente(c: ContatoReferencia, digitos: string) {
  try {
    const d = await Promise.race([buscarDadosReceita(digitos), new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
    if (!d) return { dados: null, motivo: 'Receita não respondeu' };
    const mesmaCidade = !!d.municipio && !!c.cidade && semAcento(d.municipio).trim() === semAcento(c.cidade).trim();
    const nomeReceita = semAcento(`${d.razao_social || ''} ${d.nome_fantasia || ''}`);
    const palavras = semAcento(`${c.company || ''} ${c.name}`).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !PALAVRAS_GENERICAS.has(w));
    const nomeBate = palavras.some((w) => nomeReceita.includes(w));
    if (!mesmaCidade) return { dados: null, motivo: `cidade na Receita é ${d.municipio}` };
    if (!nomeBate) return { dados: null, motivo: `nome na Receita é ${d.razao_social}` };
    return { dados: d, motivo: null };
  } catch (e) {
    return { dados: null, motivo: e instanceof Error ? e.message.slice(0, 80) : 'falhou' };
  }
}

// clientes que ja temos com o mesmo segmento: exemplo do cliente ideal pra IA
async function parecidosNoCrm(admin: Admin, c: ContatoReferencia) {
  if (!c.segmento) return [];
  const { data } = await admin.from('contacts').select('name, cidade')
    .eq('organization_id', c.organization_id).eq('is_draft', false)
    .ilike('segmento', c.segmento).neq('id', c.id).limit(5);
  return (data || []).map((x) => `${x.name}${x.cidade ? ` (${x.cidade})` : ''}`);
}

function inicioDoDiaSP() {
  // meia-noite de Sao Paulo (UTC-3, sem horario de verao desde 2019)
  const agora = new Date(Date.now() - 3 * 36e5);
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 3)).toISOString();
}

async function painel(admin: Admin, orgId: string, userId: string) {
  const [{ data: usos }, { count: hoje }, limiteDia] = await Promise.all([
    admin.from('ai_analysis_cache').select('result')
      .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_USO')
      .order('created_at', { ascending: false }).limit(30),
    // limite e por usuario: conta so as buscas que ESTE usuario disparou hoje
    admin.from('ai_analysis_cache').select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).in('analysis_type', ['INDICACOES_IA_USO', 'INDICACOES_IA_JOB'])
      .eq('result->>user_id', userId)
      .gte('created_at', inicioDoDiaSP()),
    buscasPermitidas(admin, orgId, userId),
  ]);
  // so buscas do modelo atual: as do gpt-5 (R$2,61) inflariam a estimativa do mini
  const custos = (usos || [])
    .filter((u) => (u.result as { modelo?: string }).modelo === MODELO)
    .map((u) => Number((u.result as { custo_reais?: number }).custo_reais)).filter((n) => n > 0);
  const media = custos.length ? custos.reduce((a, b) => a + b, 0) / custos.length : ESTIMATIVA_INICIAL_REAIS;
  return {
    custoEstimado: Math.ceil(media * 100) / 100,
    estimativaBaseadaEm: custos.length, // 0 = ainda e a estimativa inicial
    restantesHoje: Math.max(0, limiteDia - (hoje || 0)),
    limiteDia,
  };
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
async function situacaoNoFunil(admin: Admin, orgId: string, empresas: EmpresaIA[]) {
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await contexto(id);
    if (ctx.erro) return ctx.erro;
    const { admin, contato, profile } = ctx;
    const orgId = contato.organization_id;

    const job = request.nextUrl.searchParams.get('job');
    if (job) return acompanhar(admin, contato, job);

    if (!contato.cidade) {
      return NextResponse.json({ erro: 'Este contato não tem cidade cadastrada. Preencha a cidade para buscar indicações.' });
    }

    const chave = chaveIA(contato.id);
    // todas as buscas ja feitas para este cliente (o dono quer rever qualquer uma, quando quiser)
    const [info, { data: buscas }, { data: andamento }] = await Promise.all([
      painel(admin, orgId, profile.user_id),
      admin.from('ai_analysis_cache').select('id, result, created_at')
        .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA').like('cache_key', `${chave}%`)
        .order('created_at', { ascending: false }).limit(30),
      admin.from('ai_analysis_cache').select('cache_key')
        .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB')
        .gt('expires_at', new Date().toISOString())
        .contains('result', { chave }).limit(1).maybeSingle(),
    ]);

    const escolhida = request.nextUrl.searchParams.get('busca');
    const guardado = (buscas || []).find((b) => b.id === escolhida) || (buscas || [])[0] || null;

    // quem fez cada busca e quanto custou (busca antiga sem esses dados busca no USO)
    type R = { empresas?: EmpresaIA[]; user_id?: string; custo_reais?: number };
    const semDono = (buscas || []).filter((b) => !(b.result as R).user_id).map((b) => b.created_at);
    const { data: usos } = semDono.length
      ? await admin.from('ai_analysis_cache').select('result, created_at')
          .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_USO').contains('result', { contato_id: contato.id })
      : { data: [] as { result: unknown; created_at: string }[] };
    const usoMaisProximo = (quando: string) => (usos || [])
      .map((u) => ({ r: u.result as { user_id?: string; custo_reais?: number }, d: Math.abs(new Date(u.created_at).getTime() - new Date(quando).getTime()) }))
      .sort((a, b) => a.d - b.d)[0]?.r;
    const linhas = (buscas || []).map((b) => {
      const r = b.result as R;
      const u = r.user_id ? r : usoMaisProximo(b.created_at);
      return { id: b.id, buscadoEm: b.created_at, empresas: (r.empresas || []).length, user_id: u?.user_id || null, custo: u?.custo_reais ?? null };
    });
    const ids = [...new Set(linhas.map((l) => l.user_id).filter(Boolean))] as string[];
    const { data: perfis } = ids.length
      ? await admin.from('profiles').select('user_id, name').in('user_id', ids)
      : { data: [] as { user_id: string; name: string }[] };
    const nomes = new Map((perfis || []).map((p) => [p.user_id, p.name]));
    const historico = linhas.map(({ user_id, ...l }) => ({ ...l, quem: (user_id && nomes.get(user_id)) || '—' }));

    // as empresas ja foram salvas como contato: vale o que ficou gravado (contatoId)
    const resultado = guardado
      ? { ...(guardado.result as Record<string, unknown>), buscadoEm: guardado.created_at,
          empresas: await situacaoNoFunil(admin, orgId, ((guardado.result as { empresas?: EmpresaIA[] }).empresas) || []) }
      : null;

    return NextResponse.json({
      ...info, chave, alvo: alvoDaBusca(contato), segmentoCadastrado: contato.segmento,
      // ponto de partida do aviao no mapa da busca
      origem: getContactCoords(contato.cidade, contato.estado), estado: contato.estado,
      bloqueio: bloqueioDeBusca(contato, profile, info.limiteDia),
      resultado: resultado && { ...resultado, id: guardado?.id }, historico, jobEmAndamento: andamento?.cache_key || null,
    });
  } catch (e) {
    console.error('[indicacoes IA GET]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await contexto(id);
    if (ctx.erro) return ctx.erro;
    const { admin, contato, profile } = ctx;
    const orgId = contato.organization_id;

    const body = await request.json().catch(() => ({}));
    // a tela so manda isto depois que o consultor viu o custo e confirmou
    if (body?.confirmado !== true) {
      return NextResponse.json({ erro: 'Confirme o custo antes de buscar.' }, { status: 400 });
    }
    if (!contato.cidade) {
      return NextResponse.json({ erro: 'Este contato não tem cidade cadastrada.' }, { status: 400 });
    }
    const info = await painel(admin, orgId, profile.user_id);
    const bloqueio = bloqueioDeBusca(contato, profile, info.limiteDia);
    if (bloqueio) return NextResponse.json({ erro: bloqueio }, { status: 403 });

    const alvo = alvoDaBusca(contato);
    const chave = chaveIA(contato.id);

    // clique duplo ou dois consultores no mesmo cliente: reaproveita a busca que ja esta rodando
    const { data: rodando } = await admin.from('ai_analysis_cache').select('cache_key')
      .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB')
      .gt('expires_at', new Date().toISOString())
      .contains('result', { chave }).limit(1).maybeSingle();
    if (rodando) return NextResponse.json({ job: rodando.cache_key, reaproveitada: true });

    if (info.restantesHoje <= 0) {
      return NextResponse.json({ erro: `Você já usou suas ${info.limiteDia} buscas de hoje. Amanhã libera de novo.` }, { status: 429 });
    }

    const [receita, parecidos] = await Promise.all([dadosOficiais(contato.cnpj), parecidosNoCrm(admin, contato)]);
    // sem CNPJ valido (ou Receita fora): primeiro acha o CNPJ do proprio cliente
    const rodadaZero = !contato.cnpj || !cnpjValido(contato.cnpj);
    const { instrucoes, pedido } = rodadaZero
      ? montarPedidoCnpj({ ...contato, cidade: contato.cidade })
      : montarPedido({ ...contato, cidade: contato.cidade }, receita, parecidos, { numero: 1, quantas: POR_RODADA, excluir: [] });
    const busca = await iniciarBusca(instrucoes, pedido, rodadaZero ? { maxPesquisas: MAX_PESQUISAS_CNPJ } : {});
    const job = randomUUID();

    console.log('[indicacoes IA] iniciada', JSON.stringify({
      job, resposta: busca.id, chave, user: profile.user_id, custoMostrado: body.custoMostrado,
      usouReceita: !!receita, rodadaZero, parecidos: parecidos.length, tamanhoPedido: pedido.length,
    }));

    const meta: MetaJob = {
      chave, contato_id: contato.id, user_id: profile.user_id, alvo, custo_mostrado: body.custoMostrado ?? null,
      rodada: rodadaZero ? 0 : 1, resposta: busca.id, empresas: [], custo_reais: 0, pesquisas: 0,
      receita, parecidos, inicio: new Date().toISOString(),
    };
    await admin.from('ai_analysis_cache').insert({
      organization_id: orgId,
      analysis_type: 'INDICACOES_IA_JOB',
      cache_key: job,
      result: meta,
      expires_at: new Date(Date.now() + HORAS_REGISTRO_JOB * 36e5).toISOString(),
    });

    return NextResponse.json({ job });
  } catch (e) {
    console.error('[indicacoes IA POST]', e);
    const msg = e instanceof Error ? e.message : '';
    return NextResponse.json({ erro: msg.startsWith('Chave') ? msg : 'Não consegui iniciar a busca. Tente de novo.' }, { status: 500 });
  }
}

// Botao "Parar busca": cancela a rodada atual e fica com o que ja foi achado e salvo.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await contexto(id);
    if (ctx.erro) return ctx.erro;
    const { admin, contato } = ctx;
    const job = request.nextUrl.searchParams.get('job');
    if (!job) return NextResponse.json({ erro: 'job obrigatorio' }, { status: 400 });

    const registro = await lerJob(admin, contato.organization_id, job);
    if (!registro) return NextResponse.json({ status: 'finalizada-em-outra-aba' });

    const meta = registro.meta;
    let custo = meta.custo_reais || 0;
    const resposta = (meta.resposta || job).replace(/^processando:/, '');
    await cancelarBusca(resposta);
    // a rodada cancelada pode ja ter gasto tokens: soma o que a OpenAI informar
    try {
      const r = await consultarBusca(resposta);
      custo += custoEmReais(r.usage, (r.output || []).filter((o: { type?: string }) => o?.type === 'web_search_call').length);
    } catch { /* sem informacao de uso */ }

    console.log('[indicacoes IA] parada pelo consultor', JSON.stringify({ job, rodada: meta.rodada, empresas: meta.empresas?.length || 0 }));
    return finalizar(admin, contato, job, { ...meta, custo_reais: custo }, 'parada');
  } catch (e) {
    console.error('[indicacoes IA DELETE]', e);
    return NextResponse.json({ erro: 'Não consegui parar a busca.' }, { status: 500 });
  }
}

async function lerJob(admin: Admin, orgId: string, job: string) {
  // o job precisa ser desta empresa: sem isso, qualquer um consultaria buscas alheias pelo id
  const { data } = await admin.from('ai_analysis_cache').select('result, created_at')
    .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB').eq('cache_key', job).maybeSingle();
  if (!data) return null;
  return { meta: data.result as MetaJob, criadoEm: data.created_at as string };
}

async function acompanhar(admin: Admin, contato: ContatoReferencia, job: string) {
  const orgId = contato.organization_id;
  const registro = await lerJob(admin, orgId, job);
  if (!registro) return NextResponse.json({ status: 'finalizada-em-outra-aba' });

  const meta = registro.meta;
  // busca antiga (antes das rodadas) guardava o id da OpenAI no proprio job
  const legado = meta.rodada == null;
  const rodada = meta.rodada ?? 1;
  const acumuladas = meta.empresas || [];
  const segundos = Math.round((Date.now() - new Date(meta.inicio || registro.criadoEm).getTime()) / 1000);
  const parcial = async () => NextResponse.json({
    status: 'pesquisando', segundos, rodada, maxRodadas: MAX_RODADAS, maximo: MAX_EMPRESAS,
    empresas: await situacaoNoFunil(admin, orgId, acumuladas), custo_ate_agora: meta.custo_reais || 0,
  });

  const resposta = meta.resposta || job;
  if (resposta.startsWith('processando:')) return parcial(); // outra aba esta salvando esta rodada

  const resp = await consultarBusca(resposta);
  if (resp.status === 'queued' || resp.status === 'in_progress') {
    const segRodada = Math.round(Date.now() / 1000 - (resp.created_at || 0));
    if (segRodada < MINUTOS_MAX_RODADA * 60) return parcial();
    await cancelarBusca(resposta); // rodada travada: segue com o que tem
  }

  // trava a rodada pra so uma aba processar (evita salvar e cobrar em dobro)
  const { data: travado } = await admin.from('ai_analysis_cache')
    .update({ result: { ...meta, resposta: `processando:${resposta}` } })
    .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB').eq('cache_key', job)
    .eq('result->>resposta', meta.resposta ?? null as unknown as string)
    .select('id');
  if (!legado && !travado?.length) return parcial();

  if (rodada === 0) return depoisDaRodadaZero(admin, contato, job, meta, resp, segundos);

  const lido = lerResposta(resp, contato.company || contato.name, [...acumuladas.map((e) => e.nome), ...(meta.pequenas || [])]);
  const custo = (meta.custo_reais || 0) + custoEmReais(resp.usage, lido.pesquisas);
  const pesquisas = (meta.pesquisas || 0) + lido.pesquisas;

  const porPorte = await filtrarPorPorte(lido.empresas);
  const pequenas = [...(meta.pequenas || []), ...porPorte.descartadas.map((d) => d.nome)];

  // salva cada empresa nova como rascunho atribuido a quem pagou a busca
  const marcadas = await marcarJaNoCrm(admin, orgId, porPorte.empresas);
  const novas: EmpresaIA[] = [];
  for (const e of marcadas.slice(0, MAX_EMPRESAS - acumuladas.length)) {
    if (e.jaNoCrm) { novas.push(e); continue; }
    const r = await salvarComoContato(admin, {
      organizationId: orgId, userId: meta.user_id, referencia: contato, empresa: e, rascunho: true,
    });
    // erro aqui quase sempre e o indice unico de telefone/e-mail: ja existe no CRM
    novas.push({ ...e, contatoId: r.id, jaNoCrm: !r.id });
  }
  const empresas = [...acumuladas, ...novas].map((e, i) => ({ ...e, osmId: `ia/${i}/${e.osmId.split('/').pop()}` }));

  console.log('[indicacoes IA] rodada', JSON.stringify({
    job, rodada, status: resp.status, pesquisas: lido.pesquisas, lidas: lido.lidas, novas: novas.length,
    salvas: novas.filter((e) => e.contatoId).length, descartadas: lido.descartadas, repetidas: lido.repetidas, pequenas: porPorte.descartadas,
    total: empresas.length, uso: resp.usage, custo_rodada: custo - (meta.custo_reais || 0), custo_total: custo,
  }));

  // nicho estreito: um angulo (ex.: sinonimos) pode vir vazio e o seguinte (cidades
  // vizinhas) render. No teste da Wortex a 2a rodada veio vazia e parar ali deixou 4 empresas.
  const vazias = novas.length === 0 ? (meta.vazias || 0) + 1 : 0;
  const novoMeta: MetaJob = { ...meta, empresas, custo_reais: custo, pesquisas, vazias, pequenas, perfil: meta.perfil || lido.segmentoPesquisado };
  const acabou = legado || resp.status !== 'completed' || empresas.length >= MAX_EMPRESAS
    || rodada >= MAX_RODADAS || vazias >= 2;

  if (acabou) {
    const motivo = empresas.length >= MAX_EMPRESAS ? 'completa'
      : resp.status !== 'completed' ? `rodada ${resp.status}` : vazias >= 2 ? 'sem novas' : 'rodadas esgotadas';
    return finalizar(admin, contato, job, novoMeta, motivo);
  }

  // proxima rodada, por outro angulo, pedindo so o que falta
  const { instrucoes, pedido } = montarPedido(
    { ...contato, cidade: contato.cidade || '' }, meta.receita, meta.parecidos || [],
    { numero: rodada + 1, quantas: Math.min(POR_RODADA, MAX_EMPRESAS - empresas.length), excluir: [...empresas.map((e) => e.nome), ...pequenas],
      perfilConfirmado: novoMeta.perfil }
  );
  const proxima = await iniciarBusca(instrucoes, pedido);
  const { data: seguiu } = await admin.from('ai_analysis_cache')
    .update({ result: { ...novoMeta, rodada: rodada + 1, resposta: proxima.id } })
    .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB').eq('cache_key', job)
    .select('id');
  if (!seguiu?.length) {
    // o consultor apertou "Parar" enquanto esta rodada era salva: nao deixa rodada orfa gastando
    await cancelarBusca(proxima.id);
  }

  return NextResponse.json({
    status: 'pesquisando', segundos, rodada: rodada + 1, maxRodadas: MAX_RODADAS, maximo: MAX_EMPRESAS,
    empresas: await situacaoNoFunil(admin, orgId, empresas), custo_ate_agora: custo,
  });
}

// Rodada zero terminou: confere o CNPJ achado, grava no contato e dispara a rodada 1
// ja com a atividade oficial e o porte da Receita.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function depoisDaRodadaZero(admin: Admin, contato: ContatoReferencia, job: string, meta: MetaJob, resp: any, segundos: number) {
  const orgId = contato.organization_id;
  const achado = lerCnpj(resp);
  const custo = (meta.custo_reais || 0) + custoEmReais(resp.usage, achado.pesquisas);
  let receita: DadosOficiais | null = null;
  let cnpjCliente: string | null = null;
  let motivo: string | null = achado.cnpj ? null : 'IA não achou o CNPJ';

  if (achado.cnpj && cnpjValido(achado.cnpj)) {
    const conf = await conferirCnpjDoCliente(contato, achado.cnpj);
    motivo = conf.motivo;
    if (conf.dados) {
      const d = conf.dados;
      receita = { razao_social: d.razao_social, cnae_principal: d.cnae_principal, cnaes_secundarios: d.cnaes_secundarios, porte: d.porte };
      cnpjCliente = formatarCnpj(achado.cnpj);
      // grava so se o CNPJ do contato ainda estiver vazio: nunca sobrescreve o que alguem digitou
      const { data: gravou } = await admin.from('contacts')
        .update({ cnpj: cnpjCliente, cnpj_digits: achado.cnpj, updated_at: new Date().toISOString() })
        .eq('id', contato.id).eq('organization_id', orgId).or('cnpj.is.null,cnpj.eq.')
        .select('id');
      if (!gravou?.length) motivo = 'CNPJ confirmado, mas o contato já tinha CNPJ: não sobrescrevi';
    }
  }

  console.log('[indicacoes IA] rodada zero (CNPJ do cliente)', JSON.stringify({
    job, achado: achado.cnpj, fonte: achado.fonte, confirmado: !!receita, motivo,
    cnae: receita?.cnae_principal, porte: receita?.porte, pesquisas: achado.pesquisas, custo_rodada: custo - (meta.custo_reais || 0),
  }));

  const novoMeta: MetaJob = { ...meta, receita, cnpjCliente, custo_reais: custo, pesquisas: (meta.pesquisas || 0) + achado.pesquisas };
  const { instrucoes, pedido } = montarPedido(
    { ...contato, cnpj: cnpjCliente || contato.cnpj, cidade: contato.cidade || '' }, receita, meta.parecidos || [],
    { numero: 1, quantas: POR_RODADA, excluir: [] }
  );
  const proxima = await iniciarBusca(instrucoes, pedido);
  const { data: seguiu } = await admin.from('ai_analysis_cache')
    .update({ result: { ...novoMeta, rodada: 1, resposta: proxima.id } })
    .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB').eq('cache_key', job)
    .select('id');
  if (!seguiu?.length) await cancelarBusca(proxima.id); // parado enquanto conferia

  return NextResponse.json({
    status: 'pesquisando', segundos, rodada: 1, maxRodadas: MAX_RODADAS, maximo: MAX_EMPRESAS,
    empresas: [], custo_ate_agora: custo, cnpjCliente, cnpjMotivo: motivo,
  });
}

async function finalizar(admin: Admin, contato: ContatoReferencia, job: string, meta: MetaJob, motivo: string) {
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
      rodadas: meta.rodada ?? 1, pesquisas: meta.pesquisas || 0, empresas: empresas.length,
      salvas: empresas.filter((e) => e.contatoId).length, custo_reais: custo, custo_mostrado: meta.custo_mostrado ?? null,
    },
    expires_at: new Date(Date.now() + 365 * 864e5).toISOString(),
  });

  console.log('[indicacoes IA] finalizada', JSON.stringify({ job, motivo, empresas: empresas.length, custo_reais: custo }));

  if (!empresas.length) {
    return NextResponse.json({
      status: 'falhou', custo_reais: custo,
      erro: motivo === 'parada' ? 'Busca parada antes de achar empresas.' : 'A IA não achou nenhuma empresa com fonte comprovada.',
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
