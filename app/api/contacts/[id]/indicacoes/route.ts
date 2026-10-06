import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { chaveNome, PERFIS, EmpresaIndicada } from '@/lib/indicacoes/osm';
import { contexto, ContatoReferencia } from '@/lib/indicacoes/contexto';
import { salvarComoContato, EmpresaParaSalvar } from '@/lib/indicacoes/salvar';

// GET  /api/contacts/:id/indicacoes?perfil=industria        -> busca (demora ate 1 min)
// GET  /api/contacts/:id/indicacoes?perfil=...&cache=1      -> so o que ja foi garimpado (instantaneo)
// POST /api/contacts/:id/indicacoes                          -> traz as escolhidas pro funil
//
// O garimpo e lento porque depende de servidores publicos doados. Por isso o
// resultado fica guardado por 7 dias em ai_analysis_cache: quem abrir depois
// — inclusive outro vendedor da mesma cidade — recebe na hora.

export const maxDuration = 60;


type Contato = ContatoReferencia;

// tira quem ja esta no CRM e ordena por quem da pra trabalhar agora
async function prepararLista(
  admin: ReturnType<typeof getAdminClient>,
  contato: Contato,
  achadas: EmpresaIndicada[]
) {
  const { data: existentes } = await admin
    .from('contacts')
    .select('name, company')
    .eq('organization_id', contato.organization_id)
    .limit(5000);

  const jaTem = new Set<string>();
  for (const c of existentes || []) {
    if (c.name) jaTem.add(chaveNome(c.name));
    if (c.company) jaTem.add(chaveNome(c.company));
  }

  const novas = achadas.filter((e) => !jaTem.has(chaveNome(e.nome)));
  novas.sort((a, b) => {
    const pa = (a.telefone ? 2 : 0) + (a.site ? 1 : 0);
    const pb = (b.telefone ? 2 : 0) + (b.site ? 1 : 0);
    return pb - pa || a.nome.localeCompare(b.nome);
  });

  return {
    empresas: novas.slice(0, 60),
    perfis: Object.entries(PERFIS).map(([k, v]) => ({ id: k, rotulo: v.rotulo })),
    resumo: {
      encontradas: achadas.length,
      ja_no_crm: achadas.length - novas.length,
      novas: novas.length,
      com_telefone: novas.filter((e) => e.telefone).length,
    },
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await contexto(id);
    if (ctx.erro) return ctx.erro;
    const { admin, contato } = ctx;

    const perfis = Object.entries(PERFIS).map(([k, v]) => ({ id: k, rotulo: v.rotulo }));

    if (!contato.cidade) {
      return NextResponse.json({
        erro: 'O mapa gratuito precisa da cidade. Use "Completar cadastro pela Receita" acima (acho a cidade pelo nome) ou "Buscar com IA".',
        empresas: [], perfis,
      });
    }

    const perfil = request.nextUrl.searchParams.get('perfil') || 'tudo';
    const soCache = request.nextUrl.searchParams.get('cache') === '1';
    const chave = `${contato.cidade.toLowerCase()}|${contato.estado || ''}|${perfil}`;

    // 1) o que ja foi garimpado antes volta na hora
    const { data: cache } = await admin
      .from('ai_analysis_cache')
      .select('result, created_at')
      .eq('organization_id', contato.organization_id)
      .eq('analysis_type', 'INDICACOES_OSM')
      .eq('cache_key', chave)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cache?.result) {
      const guardadas = ((cache.result as { empresas?: EmpresaIndicada[] }).empresas) || [];
      const lista = await prepararLista(admin, contato, guardadas);
      const raio = (cache.result as { raioKm?: number | null }).raioKm ?? null;
      return NextResponse.json({ ...lista, perfil, raioKm: raio, cacheado: true, buscadoEm: cache.created_at });
    }

    // Nao garimpa aqui. O caminho anterior rodava a busca dentro da requisicao
    // que o vendedor esperava e a funcao morria com 504 antes do mapa responder.
    // Quem garimpa agora e /api/cron/garimpar, em segundo plano. Esta rota so le.
    // Devolve a ultima falha do robo nesta cidade: sem isso o vendedor via
    // "na fila" para sempre e ninguem sabia se o robo tinha sequer tentado.
    const { data: falha } = await admin
      .from('ai_analysis_cache')
      .select('result, created_at, expires_at')
      .eq('organization_id', contato.organization_id)
      .eq('analysis_type', 'INDICACOES_OSM_FALHA')
      .eq('cache_key', chave)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const ultimaTentativa = falha
      ? { quando: falha.created_at, erro: (falha.result as { erro?: string }).erro || null, proximaApos: falha.expires_at }
      : null;
    console.log('[indicacoes GET] sem cache', JSON.stringify({ chave, ultimaTentativa }));

    return NextResponse.json({ pendente: true, empresas: [], perfis, perfil, cidade: contato.cidade, chave, ultimaTentativa });
  } catch (e) {
    console.error('[indicacoes GET]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await contexto(id);
    if (ctx.erro) return ctx.erro;
    const { admin, contato, profile } = ctx;

    const body = await request.json().catch(() => ({}));

    // "Jogar pro funil": as indicacoes da IA ja estao salvas como rascunho atribuido
    // a quem buscou; aqui so saem do rascunho e entram no funil (sem criar de novo)
    if (Array.isArray(body?.contatoIds)) {
      const ids = (body.contatoIds as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 50);
      if (!ids.length) return NextResponse.json({ erro: 'Nenhuma empresa selecionada.' }, { status: 400 });
      const { data, error } = await admin.from('contacts')
        .update({ is_draft: false, updated_at: new Date().toISOString() })
        .eq('organization_id', contato.organization_id).eq('is_draft', true).eq('origem', 'INDICACAO')
        .in('id', ids).select('id');
      if (error) {
        console.error('[indicacoes POST] jogar pro funil', error.message);
        return NextResponse.json({ erro: 'Não consegui jogar pro funil.' }, { status: 500 });
      }
      return NextResponse.json({ criados: data?.length || 0, duplicados: [] });
    }

    const escolhidas: EmpresaParaSalvar[] = Array.isArray(body?.empresas) ? body.empresas : [];
    if (escolhidas.length === 0) {
      return NextResponse.json({ erro: 'Nenhuma empresa selecionada.' }, { status: 400 });
    }

    let criados = 0;
    const duplicados: string[] = [];

    // o banco tem indice unico de telefone/email por organizacao: insere uma a uma
    // pra uma duplicata nao derrubar o lote inteiro
    for (const e of escolhidas.slice(0, 50)) {
      const r = await salvarComoContato(admin, {
        organizationId: contato.organization_id, userId: profile.user_id, referencia: contato, empresa: e, rascunho: false,
      });
      if (r.id) criados++;
      else duplicados.push(e.nome);
    }

    return NextResponse.json({ criados, duplicados });
  } catch (e) {
    console.error('[indicacoes POST]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
