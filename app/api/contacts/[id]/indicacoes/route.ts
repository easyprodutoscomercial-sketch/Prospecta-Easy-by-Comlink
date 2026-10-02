import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { garimpar, chaveNome, PERFIS, EmpresaIndicada } from '@/lib/indicacoes/osm';

// GET  /api/contacts/:id/indicacoes?perfil=industria
//   Acha empresas parecidas na MESMA CIDADE do contato, tirando as que ja estao no CRM.
// POST /api/contacts/:id/indicacoes
//   Traz as escolhidas pro funil: viram contatos em "Novo", apontados pra quem clicou.

// O Overpass e lento (chega a 40s). Sem isso a funcao morre antes de responder.
export const maxDuration = 60;

const PIPELINE_PADRAO = 'ca0488f4-ae6d-4ce7-bc34-0afeeeb4a521';
const ETAPA_NOVO = '66e2a4dc-b694-42f9-9d3e-0674c0d9e31e';

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
  return { admin, contato, profile };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await contexto(id);
    if (ctx.erro) return ctx.erro;
    const { admin, contato } = ctx;

    if (!contato.cidade) {
      return NextResponse.json({
        erro: 'Este contato não tem cidade cadastrada. Preencha a cidade para eu buscar indicações na região dele.',
        empresas: [],
      });
    }

    const perfil = request.nextUrl.searchParams.get('perfil') || 'industria';

    let achadas: EmpresaIndicada[];
    let regiao = '';
    try {
      const r = await garimpar(contato.cidade, contato.estado, perfil);
      achadas = r.empresas;
      regiao = r.regiao;
    } catch (e) {
      return NextResponse.json({
        erro: e instanceof Error ? e.message : 'Falha ao consultar o mapa.',
        empresas: [],
      });
    }

    // tira quem ja esta no CRM (compara nome do contato e nome da empresa)
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

    // quem tem telefone ou site primeiro: da pra trabalhar na hora
    novas.sort((a, b) => {
      const pa = (a.telefone ? 2 : 0) + (a.site ? 1 : 0);
      const pb = (b.telefone ? 2 : 0) + (b.site ? 1 : 0);
      return pb - pa || a.nome.localeCompare(b.nome);
    });

    return NextResponse.json({
      empresas: novas.slice(0, 60),
      regiao,
      perfil,
      perfis: Object.entries(PERFIS).map(([k, v]) => ({ id: k, rotulo: v.rotulo })),
      resumo: {
        encontradas: achadas.length,
        ja_no_crm: achadas.length - novas.length,
        novas: novas.length,
        com_telefone: novas.filter((e) => e.telefone).length,
      },
    });
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
    const linhas = escolhidas.slice(0, 50).map((e) => ({
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
      assigned_to_user_id: profile.user_id, // quem pediu a indicacao fica com ela
      created_by_user_id: profile.user_id,
      origem: 'INDICACAO',
      notes: `Indicação a partir de ${contato.name}${contato.company ? ` (${contato.company})` : ''}. Fonte: OpenStreetMap.`,
      is_draft: false,
      updated_at: agora,
    }));

    // o banco tem indice unico de telefone e email por organizacao:
    // se o telefone ja existir, aquela linha falha. Insere uma a uma pra
    // nao perder o lote inteiro por causa de uma duplicata.
    let criados = 0;
    const duplicados: string[] = [];
    for (const linha of linhas) {
      const { error } = await admin.from('contacts').insert(linha);
      if (error) duplicados.push(linha.name);
      else criados++;
    }

    return NextResponse.json({ criados, duplicados });
  } catch (e) {
    console.error('[indicacoes POST]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
