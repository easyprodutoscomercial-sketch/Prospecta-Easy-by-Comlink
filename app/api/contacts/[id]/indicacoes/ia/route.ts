import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { contexto, ContatoReferencia } from '@/lib/indicacoes/contexto';
import {
  MODELO, ESTIMATIVA_INICIAL_REAIS, chaveIA, montarPedidoCnpj, iniciarBusca, consultarBusca, cancelarBusca,
  custoEmReais, MAX_PESQUISAS_CNPJ, DadosOficiais, EmpresaIA,
} from '@/lib/indicacoes/ia';
import { buscarDadosReceita, cnpjValido } from '@/lib/receita/cnpj';
import { getContactCoords } from '@/lib/data/brazil-cities-coords';
import { hasFullVisibility } from '@/lib/utils/roles';
import { buscasPermitidas } from '@/lib/indicacoes/permissao';
import {
  type Admin, type MetaJob, AGUARDANDO, paraOficiais, completarCadastro, parecidosNoCrm, situacaoNoFunil,
  lerJob, acompanhar, iniciarRodada, iniciarRodadaUm, finalizar,
} from '@/lib/indicacoes/motor';
import type { UserRole } from '@/lib/types';

// GET    /api/contacts/:id/indicacoes/ia          -> custo estimado, buscas que restam hoje e resultado guardado
// GET    /api/contacts/:id/indicacoes/ia?job=ID   -> andamento; devolve as empresas achadas ATE AGORA
// POST   /api/contacts/:id/indicacoes/ia          -> inicia a busca ({ confirmado: true } obrigatorio)
// DELETE /api/contacts/:id/indicacoes/ia?job=ID   -> para a busca e fica com o que ja achou
//
// A busca roda em RODADAS de 2 pedidos ao mesmo tempo (o motor fica em lib/indicacoes/motor.ts):
// cada rodada salva o que achou e dispara a proxima. A tela vai enchendo, o consultor pode
// parar quando quiser, e ao chegar em 8 empresas boas encerra sozinha. Se a janela fechar,
// a busca continua (empurrada pelas outras telas abertas do CRM).
// Cada pedido roda em segundo plano na OpenAI (a funcao da Vercel morre aos 60s).
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

export const maxDuration = 60; // processar uma rodada dupla (Receita + rascunhos) pode passar de 30s
const HORAS_REGISTRO_JOB = 24;

// Regra do dono (02/10): so contato APONTADO pode ter busca com IA. Vendedor so busca
// nos apontados pra ele (nao gasta a cota no cliente do colega); admin/gerente em qualquer apontado.
// Regra do dono (06/10): so busca quem o admin liberou em Admin > Usuarios (inclusive o admin).
function bloqueioDeBusca(c: ContatoReferencia, profile: { user_id: string; role: string }, limiteDia: number) {
  if (limiteDia <= 0) return 'Você não tem permissão para buscar indicações com IA. Peça ao administrador para liberar.';
  // Regra do dono (06/10): busca com IA so na coluna Novo; rever busca antiga continua liberado
  if (c.status !== 'NOVO') return 'A busca com IA é só para contatos na coluna Novo. As buscas já feitas continuam abaixo para rever.';
  if (!c.assigned_to_user_id) return 'Aponte este contato para alguém antes de buscar indicações com IA.';
  if (!hasFullVisibility(profile.role as UserRole) && c.assigned_to_user_id !== profile.user_id) {
    return 'Só quem está apontado neste contato pode buscar indicações com IA.';
  }
  return null;
}

function alvoDaBusca(c: ContatoReferencia) {
  return c.segmento?.trim() || c.company?.trim() || c.name;
}

function inicioDoDiaSP() {
  // meia-noite de Sao Paulo (UTC-3, sem horario de verao desde 2019)
  const agora = new Date(Date.now() - 3 * 36e5);
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 3)).toISOString();
}

// Regra do dono (06/10): administrador busca sem limite ("sou o super adm, ilimitado
// pra mim"). Vendedor, gerente etc. seguem o limite liberado em Admin > Usuarios.
const SEM_LIMITE = 9999;

async function painel(admin: Admin, orgId: string, userId: string, role: string) {
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
  // so buscas do motor atual (06/10: rodadas em dupla, ~R$0,60): as antigas (R$1,15-1,35)
  // e as do gpt-5 (R$2,61) inflariam a estimativa
  const custos = (usos || [])
    .filter((u) => (u.result as { modelo?: string; versao?: number }).modelo === MODELO && (u.result as { versao?: number }).versao === 2)
    .map((u) => Number((u.result as { custo_reais?: number }).custo_reais)).filter((n) => n > 0);
  const media = custos.length ? custos.reduce((a, b) => a + b, 0) / custos.length : ESTIMATIVA_INICIAL_REAIS;
  const ilimitado = role === 'admin';
  const limite = ilimitado ? SEM_LIMITE : limiteDia;
  return {
    custoEstimado: Math.ceil(media * 100) / 100,
    estimativaBaseadaEm: custos.length, // 0 = ainda e a estimativa inicial
    restantesHoje: Math.max(0, limite - (hoje || 0)),
    limiteDia: limite,
    ilimitado,
  };
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


    const chave = chaveIA(contato.id);
    // todas as buscas ja feitas para este cliente (o dono quer rever qualquer uma, quando quiser)
    const [info, { data: buscas }, { data: andamento }] = await Promise.all([
      painel(admin, orgId, profile.user_id, profile.role),
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
      semCidade: !contato.cidade, // a busca acha o CNPJ pelo nome e o vendedor confirma
      semCnpj: !contato.cnpj || !cnpjValido(contato.cnpj), // mostra o botao "Completar cadastro pela Receita"
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
    const info = await painel(admin, orgId, profile.user_id, profile.role);
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

    // ja tem CNPJ: completa o cadastro com a Receita antes (sem custo de IA)
    let ref = contato;
    let receita: DadosOficiais | null = null;
    let cadastro: string[] = [];
    if (contato.cnpj && cnpjValido(contato.cnpj)) {
      const d = await Promise.race([
        buscarDadosReceita(contato.cnpj).catch(() => null),
        new Promise<null>((r) => setTimeout(() => r(null), 8000)),
      ]);
      if (d) {
        receita = paraOficiais(d);
        ({ contato: ref, cadastro } = await completarCadastro(admin, contato, d));
      }
    }
    // sem CNPJ valido: primeiro acha o CNPJ do proprio cliente (rodada zero)
    const rodadaZero = !ref.cnpj || !cnpjValido(ref.cnpj);
    if (!rodadaZero && !ref.cidade) {
      return NextResponse.json({ erro: 'A Receita não respondeu e o contato não tem cidade. Preencha a cidade ou tente de novo em um minuto.' }, { status: 503 });
    }
    const parecidos = await parecidosNoCrm(admin, ref);
    const base: MetaJob = {
      chave, contato_id: contato.id, user_id: profile.user_id, alvo, custo_mostrado: body.custoMostrado ?? null,
      rodada: rodadaZero ? 0 : 1, respostas: [], passo: 0, processando: null, empresas: [], custo_reais: 0, pesquisas: 0,
      receita, parecidos, inicio: new Date().toISOString(), cadastro,
    };
    let respostas: string[];
    if (rodadaZero) {
      const { instrucoes, pedido } = montarPedidoCnpj(ref);
      respostas = [(await iniciarBusca(instrucoes, pedido, { maxPesquisas: MAX_PESQUISAS_CNPJ })).id];
    } else {
      respostas = await iniciarRodada(admin, ref, base, 1);
    }
    const job = randomUUID();
    const meta: MetaJob = { ...base, respostas };

    console.log('[indicacoes IA] iniciada', JSON.stringify({
      job, respostas, chave, user: profile.user_id, custoMostrado: body.custoMostrado,
      usouReceita: !!receita, rodadaZero, semCidade: !ref.cidade, cadastro, parecidos: parecidos.length,
    }));
    await admin.from('ai_analysis_cache').insert({
      organization_id: orgId,
      analysis_type: 'INDICACOES_IA_JOB',
      cache_key: job,
      result: meta,
      expires_at: new Date(Date.now() + HORAS_REGISTRO_JOB * 36e5).toISOString(),
    });

    return NextResponse.json({ job, cadastro });
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
    const pedidos = meta.respostas || (meta.resposta ? [meta.resposta.replace(/^processando:/, '')] : []);
    await Promise.all(pedidos.map(cancelarBusca));
    // os pedidos cancelados podem ja ter gasto: soma o que a OpenAI informar
    for (const id of pedidos) {
      try {
        const r = await consultarBusca(id);
        custo += custoEmReais(r.usage, (r.output || []).filter((o: { type?: string }) => o?.type === 'web_search_call').length);
      } catch { /* sem informacao de uso (ou nao era pedido da OpenAI) */ }
    }

    console.log('[indicacoes IA] parada pelo consultor', JSON.stringify({ job, rodada: meta.rodada, empresas: meta.empresas?.length || 0 }));
    return finalizar(admin, contato, job, { ...meta, custo_reais: custo }, 'parada');
  } catch (e) {
    console.error('[indicacoes IA DELETE]', e);
    return NextResponse.json({ erro: 'Não consegui parar a busca.' }, { status: 500 });
  }
}

// PATCH /api/contacts/:id/indicacoes/ia?job=ID { confirmar: true|false }
// Resposta do vendedor a "Achamos esta empresa — é o seu cliente?" (contato sem cidade).
// Sim: completa o cadastro com a Receita e segue a busca. Nao: encerra sem gravar nada.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await contexto(id);
    if (ctx.erro) return ctx.erro;
    const { admin, contato, profile } = ctx;
    const orgId = contato.organization_id;
    const job = request.nextUrl.searchParams.get('job');
    const body = await request.json().catch(() => ({}));
    if (!job || typeof body?.confirmar !== 'boolean') {
      return NextResponse.json({ erro: 'job e confirmar obrigatorios' }, { status: 400 });
    }

    const registro = await lerJob(admin, orgId, job);
    if (!registro) return NextResponse.json({ status: 'finalizada-em-outra-aba' });
    const meta = registro.meta;
    if (meta.user_id !== profile.user_id && !hasFullVisibility(profile.role as UserRole)) {
      return NextResponse.json({ erro: 'Só quem iniciou a busca pode confirmar a empresa.' }, { status: 403 });
    }
    if (!meta.aguardando) return NextResponse.json({ status: 'pesquisando', rodada: meta.rodada ?? 1 });

    if (!body.confirmar) {
      console.log('[indicacoes IA] vendedor disse que o CNPJ nao e do cliente', JSON.stringify({ job, cnpj: meta.aguardando.cnpj }));
      return finalizar(admin, contato, job, meta, 'cnpj recusado',
        'Ok, nada foi gravado no cadastro. Preencha a cidade ou o CNPJ certo na ficha e busque de novo.');
    }

    // trava: so um clique processa (duplo clique nao dispara duas rodadas)
    const passo = meta.passo ?? 0;
    const { data: travado } = await admin.from('ai_analysis_cache')
      .update({ result: { ...meta, passo: passo + 1, resposta: `processando:${AGUARDANDO}` } })
      .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB').eq('cache_key', job)
      .eq('result->>passo', String(passo)).select('id');
    if (!travado?.length) return NextResponse.json({ status: 'pesquisando', rodada: 1 });
    meta.passo = passo + 1;

    const dados = await Promise.race([
      buscarDadosReceita(meta.aguardando.cnpj).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 10000)),
    ]);
    if (!dados) {
      // devolve a pergunta pro vendedor tentar de novo
      await admin.from('ai_analysis_cache').update({ result: { ...meta, resposta: AGUARDANDO } }) // passo ja subiu: a proxima tentativa trava de novo
        .eq('organization_id', orgId).eq('analysis_type', 'INDICACOES_IA_JOB').eq('cache_key', job);
      return NextResponse.json({ erro: 'A Receita não respondeu agora. Clique em "Sim" de novo em alguns segundos.' }, { status: 503 });
    }

    const { contato: ref, cadastro } = await completarCadastro(admin, contato, dados);
    console.log('[indicacoes IA] vendedor confirmou o CNPJ', JSON.stringify({ job, cnpj: meta.aguardando.cnpj, cadastro, cidade: ref.cidade }));
    const segundos = Math.round((Date.now() - new Date(meta.inicio || registro.criadoEm).getTime()) / 1000);
    return iniciarRodadaUm(admin, ref, job, { ...meta, cadastro: [...(meta.cadastro || []), ...cadastro] }, dados, segundos, null);
  } catch (e) {
    console.error('[indicacoes IA PATCH]', e);
    return NextResponse.json({ erro: 'Não consegui seguir a busca. Tente de novo.' }, { status: 500 });
  }
}

