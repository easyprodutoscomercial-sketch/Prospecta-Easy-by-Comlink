import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { garimpar, chaveNome, PERFIS, EmpresaIndicada } from '@/lib/indicacoes/osm';

// GET  /api/contacts/:id/indicacoes?perfil=industria        -> busca (demora ate 1 min)
// GET  /api/contacts/:id/indicacoes?perfil=...&cache=1      -> so o que ja foi garimpado (instantaneo)
// POST /api/contacts/:id/indicacoes                          -> traz as escolhidas pro funil
//
// O garimpo e lento porque depende de servidores publicos doados. Por isso o
// resultado fica guardado por 7 dias em ai_analysis_cache: quem abrir depois
// — inclusive outro vendedor da mesma cidade — recebe na hora.

export const maxDuration = 60;

const PIPELINE_PADRAO = 'ca0488f4-ae6d-4ce7-bc34-0afeeeb4a521';
const ETAPA_NOVO = '66e2a4dc-b694-42f9-9d3e-0674c0d9e31e';
const DIAS_CACHE = 7;

type Contato = {
  id: string; organization_id: string; name: string; company: string | null;
  cidade: string | null; estado: string | null; segmento: string | null; pipeline_id: string | null;
};

async function contexto(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'Nao autorizado' }, { status: 401 }) };

  const profile = await ensureProfile(supabase, user);
  if (!profile) return { erro: NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 }) };

  const admin = getAdminClient();
  const { data: contato } = await admin
    .from('contacts')
    .select('id, organization_id, name, company, cidade, estado, segmento, pipeline_id')
    .eq('id', id)
    .single();

  if (!contato) return { erro: NextResponse.json({ error: 'Contato nao encontrado' }, { status: 404 }) };
  if (contato.organization_id !== profile.organization_id) {
    return { erro: NextResponse.json({ error: 'Nao autorizado' }, { status: 403 }) };
  }
  return { admin, contato: contato as Contato, profile };
}

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
        erro: 'Este contato não tem cidade cadastrada. Preencha a cidade para eu buscar indicações na região dele.',
        empresas: [], perfis,
      });
    }

    const perfil = request.nextUrl.searchParams.get('perfil') || 'industria';
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
      return NextResponse.json({ ...lista, perfil, cacheado: true, buscadoEm: cache.created_at });
    }

    // 2) a tela pediu so o cache: responde que ainda nao tem e nao segura ninguem
    if (soCache) return NextResponse.json({ pendente: true, empresas: [], perfis, perfil });

    // 3) garimpo de verdade
    let achadas: EmpresaIndicada[] = [];
    try {
      const r = await garimpar(contato.cidade, contato.estado, perfil);
      achadas = r.empresas;
    } catch (e) {
      return NextResponse.json({
        erro: e instanceof Error ? e.message : 'Falha ao consultar o mapa.',
        empresas: [], perfis, perfil,
      });
    }

    // guarda por 7 dias: o proximo que abrir — inclusive outro vendedor — nao espera
    const expira = new Date(Date.now() + DIAS_CACHE * 864e5).toISOString();
    await admin.from('ai_analysis_cache').insert({
      organization_id: contato.organization_id,
      analysis_type: 'INDICACOES_OSM',
      cache_key: chave,
      result: { empresas: achadas, cidade: contato.cidade, estado: contato.estado, perfil },
      expires_at: expira,
    });

    const lista = await prepararLista(admin, contato, achadas);
    return NextResponse.json({ ...lista, perfil, cacheado: false });
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
    const escolhidas: EmpresaIndicada[] = Array.isArray(body?.empresas) ? body.empresas : [];
    if (escolhidas.length === 0) {
      return NextResponse.json({ erro: 'Nenhuma empresa selecionada.' }, { status: 400 });
    }

    const agora = new Date().toISOString();
    let criados = 0;
    const duplicados: string[] = [];

    // o banco tem indice unico de telefone/email por organizacao: insere uma a uma
    // pra uma duplicata nao derrubar o lote inteiro
    for (const e of escolhidas.slice(0, 50)) {
      const { error } = await admin.from('contacts').insert({
        organization_id: contato.organization_id,
        name: e.nome,
        company: e.nome,
        phone: e.telefone,
        website: e.site,
        endereco: e.endereco,
        cidade: e.cidade || contato.cidade,
        estado: contato.estado,
        status: 'NOVO',
        stage_id: ETAPA_NOVO,
        pipeline_id: contato.pipeline_id || PIPELINE_PADRAO,
        assigned_to_user_id: profile.user_id,
        created_by_user_id: profile.user_id,
        origem: 'INDICACAO',
        notes: `Indicação a partir de ${contato.name}${contato.company ? ` (${contato.company})` : ''}. Fonte: OpenStreetMap.`,
        is_draft: false,
        updated_at: agora,
      });
      if (error) duplicados.push(e.nome);
      else criados++;
    }

    return NextResponse.json({ criados, duplicados });
  } catch (e) {
    console.error('[indicacoes POST]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
