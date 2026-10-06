import { NextRequest, NextResponse } from 'next/server';
import { contexto } from '@/lib/indicacoes/contexto';
import { montarPedidoCnpj, iniciarBusca, consultarBusca, cancelarBusca, lerCnpj, custoEmReais, MAX_PESQUISAS_CNPJ } from '@/lib/indicacoes/ia';
import { buscasPermitidas } from '@/lib/indicacoes/permissao';
import { conferirCnpjDoCliente, resumoEmpresa } from '@/lib/receita/conferir';
import { cnpjValido } from '@/lib/receita/cnpj';

// Botao "Completar cadastro pela Receita" (pedido do dono em 06/10):
// POST /api/contacts/:id/receita/achar             -> a IA procura o CNPJ do cliente pelo nome (~R$0,07)
// GET  /api/contacts/:id/receita/achar?resposta=ID -> andamento; no fim devolve a empresa pra confirmar
// A confirmacao ("Sim, e o cliente") usa o POST /api/contacts/:id/receita com o CNPJ,
// que grava o CNPJ e preenche so os campos vazios.
// Nao gasta as buscas de indicacao do dia, mas so quem tem permissao de IA pode usar.

export const maxDuration = 30;
const TIPO = 'RECEITA_ACHAR';
const MINUTOS_MAX = 2;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await contexto(id);
    if (ctx.erro) return ctx.erro;
    const { admin, contato, profile } = ctx;

    if (await buscasPermitidas(admin, contato.organization_id, profile.user_id) <= 0) {
      return NextResponse.json({ erro: 'Você não tem permissão para usar a IA. Peça ao administrador para liberar.' }, { status: 403 });
    }
    if (contato.cnpj && cnpjValido(contato.cnpj)) {
      return NextResponse.json({ erro: 'Este contato já tem CNPJ. Use o botão de CNPJ na ficha para atualizar pela Receita.' }, { status: 400 });
    }

    const { instrucoes, pedido } = montarPedidoCnpj(contato);
    const busca = await iniciarBusca(instrucoes, pedido, { maxPesquisas: MAX_PESQUISAS_CNPJ });
    await admin.from('ai_analysis_cache').insert({
      organization_id: contato.organization_id,
      analysis_type: TIPO,
      cache_key: busca.id,
      result: { contato_id: contato.id, user_id: profile.user_id },
      expires_at: new Date(Date.now() + 365 * 864e5).toISOString(),
    });
    console.log('[receita achar] iniciada', JSON.stringify({ resposta: busca.id, contato: contato.id, user: profile.user_id, semCidade: !contato.cidade }));
    return NextResponse.json({ resposta: busca.id });
  } catch (e) {
    console.error('[receita achar POST]', e);
    return NextResponse.json({ erro: 'Não consegui começar a procurar. Tente de novo.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await contexto(id);
    if (ctx.erro) return ctx.erro;
    const { admin, contato } = ctx;
    const resposta = request.nextUrl.searchParams.get('resposta');
    if (!resposta) return NextResponse.json({ erro: 'resposta obrigatoria' }, { status: 400 });

    // a procura tem que ser deste contato e desta empresa
    const { data: registro } = await admin.from('ai_analysis_cache').select('id, result')
      .eq('organization_id', contato.organization_id).eq('analysis_type', TIPO).eq('cache_key', resposta)
      .maybeSingle();
    if (!registro || (registro.result as { contato_id?: string }).contato_id !== contato.id) {
      return NextResponse.json({ erro: 'Procura não encontrada' }, { status: 404 });
    }

    const r = await consultarBusca(resposta);
    if (r.status === 'queued' || r.status === 'in_progress') {
      if (Date.now() / 1000 - (r.created_at || 0) < MINUTOS_MAX * 60) return NextResponse.json({ status: 'procurando' });
      await cancelarBusca(resposta);
    }

    const achado = lerCnpj(r);
    const custo = custoEmReais(r.usage, achado.pesquisas);
    let resultado: { status: string; motivo?: string; empresa?: ReturnType<typeof resumoEmpresa> };
    if (!achado.cnpj || !cnpjValido(achado.cnpj)) {
      resultado = { status: 'nao_achou', motivo: 'A IA não achou o CNPJ desta empresa pelo nome.' };
    } else {
      const conf = await conferirCnpjDoCliente(contato, achado.cnpj);
      resultado = conf.dados
        ? { status: 'confirmar', empresa: resumoEmpresa(conf.dados) }
        : { status: 'nao_achou', motivo: `Achei o CNPJ ${achado.cnpj}, mas não confere com o cadastro (${conf.motivo}).` };
    }

    await admin.from('ai_analysis_cache')
      .update({ result: { ...(registro.result as object), custo_reais: custo, cnpj: achado.cnpj, status: resultado.status } })
      .eq('id', registro.id);
    console.log('[receita achar] terminou', JSON.stringify({ resposta, contato: contato.id, cnpj: achado.cnpj, fonte: achado.fonte, ...resultado, custo }));
    return NextResponse.json({ ...resultado, custo_reais: custo });
  } catch (e) {
    console.error('[receita achar GET]', e);
    return NextResponse.json({ erro: 'Não consegui consultar agora. Tente de novo.' }, { status: 500 });
  }
}
