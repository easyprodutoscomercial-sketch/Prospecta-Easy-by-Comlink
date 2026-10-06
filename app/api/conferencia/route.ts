import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureProfile } from '@/lib/ensure-profile';
import { canViewAuditLog } from '@/lib/utils/roles';
import type { UserRole } from '@/lib/types';
import { dataDoRelatorio } from '@/lib/conferencia/eml';
import { extrairRelatorio, MAX_CARACTERES } from '@/lib/conferencia/extrair';
import {
  conferir, criarIndice, type ContatoCRM, type InteracaoCRM, type LinhaRelatorio, type ReuniaoCRM,
} from '@/lib/conferencia/casar';

// Conferencia de relatorios diarios: o e-mail que o vendedor manda ao dono x o CRM.
//
// GET    /api/conferencia?dia=AAAA-MM-DD          -> conferencia do dia (refeita na hora, sem IA)
// POST   /api/conferencia                          -> le UM e-mail com IA e guarda a leitura
// DELETE /api/conferencia?dia=...&vendedor_id=...  -> apaga a leitura (vendedor errado, e-mail errado)
//
// Em ai_analysis_cache (nao ha acesso pra criar tabela):
//   CONFERENCIA_EMAIL    leitura da IA, uma por vendedor por dia (cache_key conf|dia|vendedor)
//   CONFERENCIA_USO      uma linha por leitura, com o custo: base do limite diario
//   CONFERENCIA_APELIDO  e-mail de remetente que nao e o do cadastro -> vendedor
//
// So a leitura fica guardada (nunca o e-mail bruto). A comparacao com o CRM e
// refeita a cada GET: se o vendedor lancar a ligacao depois, a tela ja mostra.
// Regras do dono (06/10): so admin/gerente; a tela so MOSTRA, nao lanca nada.

export const maxDuration = 60;

type Admin = ReturnType<typeof getAdminClient>;
const LIMITE_LEITURAS_DIA = 40;
const DEZ_ANOS = 3650 * 864e5;

async function autorizar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) };
  const profile = await ensureProfile(supabase, user);
  if (!profile || !canViewAuditLog(profile.role as UserRole)) {
    return { erro: NextResponse.json({ error: 'Só administrador ou gerente pode usar a conferência.' }, { status: 403 }) };
  }
  return { profile };
}

const chave = (dia: string, vendedorId: string) => `conf|${dia}|${vendedorId}`;
const diaValido = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function hojeSP() {
  return new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
}

function inicioDoDiaSP() {
  return `${hojeSP()}T03:00:00.000Z`;
}

function somaDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function usuarios(admin: Admin, orgId: string) {
  const { data } = await admin.from('profiles').select('user_id, name, email, role').eq('organization_id', orgId).order('name');
  return (data || []) as { user_id: string; name: string; email: string; role: string }[];
}

// todos os contatos da organizacao (3,8 mil hoje): o casamento de nomes e em memoria
async function todosContatos(admin: Admin, orgId: string) {
  const lista: ContatoCRM[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await admin.from('contacts')
      .select('id, name, company, status, assigned_to_user_id, proxima_acao_tipo, proxima_acao_data')
      .eq('organization_id', orgId).order('id').range(de, de + 999);
    if (error) throw error;
    lista.push(...((data || []) as ContatoCRM[]));
    if (!data || data.length < 1000) break;
  }
  return lista;
}

type Leitura = {
  vendedor_id: string; dia: string; assunto: string; remetente: string | null; enviado_em: string | null;
  linhas: LinhaRelatorio[]; custo_reais: number; modelo: string; lido_por: string; lido_em: string;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await autorizar();
    if (!auth.profile) return auth.erro;
    const { profile } = auth;
    const admin = getAdminClient();
    const orgId = profile.organization_id;

    const { data: todas } = await admin.from('ai_analysis_cache').select('cache_key')
      .eq('organization_id', orgId).eq('analysis_type', 'CONFERENCIA_EMAIL')
      .order('created_at', { ascending: false }).limit(500);
    const dias = Array.from(new Set((todas || []).map((r) => r.cache_key.split('|')[1]).filter(diaValido)))
      .sort().reverse();

    const pedido = request.nextUrl.searchParams.get('dia');
    const dia = diaValido(pedido) ? pedido : dias[0] || hojeSP();
    const equipe = await usuarios(admin, orgId);

    const { data: linhasCache, error } = await admin.from('ai_analysis_cache').select('result')
      .eq('organization_id', orgId).eq('analysis_type', 'CONFERENCIA_EMAIL').like('cache_key', `conf|${dia}|%`);
    if (error) throw error;
    const leituras = (linhasCache || []).map((r) => r.result as Leitura);
    if (!leituras.length) return NextResponse.json({ dia, dias, vendedores: [], usuarios: equipe });

    // janela: o dia do relatorio inteiro ate 12h do dia seguinte (quem lanca de manha o que fez ontem)
    const inicio = `${dia}T03:00:00.000Z`;
    const fim = `${somaDias(dia, 1)}T15:00:00.000Z`;
    const vendedores = leituras.map((l) => l.vendedor_id);

    const [contatos, { data: ints, error: e1 }, { data: reun, error: e2 }] = await Promise.all([
      todosContatos(admin, orgId),
      admin.from('interactions').select('id, contact_id, type, outcome, happened_at, note, created_by_user_id')
        .eq('organization_id', orgId).in('created_by_user_id', vendedores)
        .gte('happened_at', inicio).lt('happened_at', fim).order('happened_at').limit(5000),
      admin.from('meetings').select('contact_id, meeting_at, status')
        .eq('organization_id', orgId).gte('meeting_at', `${somaDias(dia, -1)}T03:00:00.000Z`).limit(5000),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;

    const indice = criarIndice(contatos);
    const nomeDe = (id: string) => equipe.find((u) => u.user_id === id)?.name || 'Vendedor removido';
    const resultado = leituras
      .map((l) => ({
        vendedor_id: l.vendedor_id,
        vendedor_nome: nomeDe(l.vendedor_id),
        assunto: l.assunto,
        remetente: l.remetente,
        enviado_em: l.enviado_em,
        custo_reais: l.custo_reais,
        lido_em: l.lido_em,
        ...conferir({
          dia,
          vendedorId: l.vendedor_id,
          linhas: l.linhas,
          indice,
          interacoes: ((ints || []) as (InteracaoCRM & { created_by_user_id: string })[]).filter((i) => i.created_by_user_id === l.vendedor_id),
          reunioes: (reun || []) as ReuniaoCRM[],
        }),
      }))
      .sort((a, b) => a.vendedor_nome.localeCompare(b.vendedor_nome));

    return NextResponse.json({ dia, dias, vendedores: resultado, usuarios: equipe });
  } catch (e) {
    console.error('[conferencia GET]', e);
    return NextResponse.json({ error: 'Erro ao montar a conferência.' }, { status: 500 });
  }
}

const corpoPost = z.object({
  texto: z.string().trim().min(30, 'O e-mail está vazio ou curto demais.').max(MAX_CARACTERES, 'E-mail longo demais.'),
  assunto: z.string().max(500).default(''),
  remetente_email: z.string().max(200).nullable().optional(),
  remetente_nome: z.string().max(200).nullable().optional(),
  enviado_em: z.string().max(40).nullable().optional(),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  vendedor_id: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await autorizar();
    if (!auth.profile) return auth.erro;
    const { profile } = auth;
    const admin = getAdminClient();
    const orgId = profile.organization_id;

    const parse = corpoPost.safeParse(await request.json().catch(() => ({})));
    if (!parse.success) return NextResponse.json({ error: parse.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 });
    const b = parse.data;
    const remetente = b.remetente_email?.trim().toLowerCase() || null;
    const equipe = await usuarios(admin, orgId);

    // quem mandou: escolhido na tela > e-mail do cadastro > apelido guardado
    let vendedor = b.vendedor_id ? equipe.find((u) => u.user_id === b.vendedor_id) : undefined;
    if (b.vendedor_id && !vendedor) return NextResponse.json({ error: 'Vendedor não encontrado nesta empresa.' }, { status: 400 });
    if (!vendedor && remetente) vendedor = equipe.find((u) => (u.email || '').toLowerCase() === remetente);
    if (!vendedor && remetente) {
      const { data: apelido } = await admin.from('ai_analysis_cache').select('result')
        .eq('organization_id', orgId).eq('analysis_type', 'CONFERENCIA_APELIDO').eq('cache_key', remetente).maybeSingle();
      const id = (apelido?.result as { user_id?: string } | undefined)?.user_id;
      vendedor = equipe.find((u) => u.user_id === id);
    }
    if (!vendedor) {
      return NextResponse.json({
        precisa_vendedor: true,
        error: `Não achei vendedor com o e-mail ${remetente || '(sem remetente)'}. Escolha quem mandou.`,
        usuarios: equipe,
      }, { status: 422 });
    }

    // remetente diferente do cadastro: lembra pra proxima vez
    if (b.vendedor_id && remetente && (vendedor.email || '').toLowerCase() !== remetente) {
      await admin.from('ai_analysis_cache').delete()
        .eq('organization_id', orgId).eq('analysis_type', 'CONFERENCIA_APELIDO').eq('cache_key', remetente);
      await admin.from('ai_analysis_cache').insert({
        organization_id: orgId, analysis_type: 'CONFERENCIA_APELIDO', cache_key: remetente,
        result: { email: remetente, user_id: vendedor.user_id }, expires_at: new Date(Date.now() + DEZ_ANOS).toISOString(),
      });
    }

    const dia = b.dia || dataDoRelatorio(b.assunto, b.texto, b.enviado_em || null) || hojeSP();

    const { count } = await admin.from('ai_analysis_cache').select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('analysis_type', 'CONFERENCIA_USO').gte('created_at', inicioDoDiaSP());
    if ((count || 0) >= LIMITE_LEITURAS_DIA) {
      return NextResponse.json({ error: `Limite de ${LIMITE_LEITURAS_DIA} e-mails lidos por dia atingido. Amanhã libera de novo.` }, { status: 429 });
    }

    const ex = await extrairRelatorio(b.texto, dia, b.assunto);

    await admin.from('ai_analysis_cache').insert({
      organization_id: orgId, analysis_type: 'CONFERENCIA_USO', cache_key: chave(dia, vendedor.user_id),
      result: { user_id: profile.user_id, vendedor_id: vendedor.user_id, dia, custo_reais: ex.custo_reais, modelo: ex.modelo, empresas: ex.linhas.length },
      expires_at: new Date(Date.now() + DEZ_ANOS).toISOString(),
    });

    const leitura: Leitura = {
      vendedor_id: vendedor.user_id, dia, assunto: b.assunto, remetente, enviado_em: b.enviado_em || null,
      linhas: ex.linhas, custo_reais: ex.custo_reais, modelo: ex.modelo, lido_por: profile.user_id, lido_em: new Date().toISOString(),
    };
    // mandou de novo o mesmo dia do mesmo vendedor: a leitura nova substitui
    await admin.from('ai_analysis_cache').delete()
      .eq('organization_id', orgId).eq('analysis_type', 'CONFERENCIA_EMAIL').eq('cache_key', chave(dia, vendedor.user_id));
    const { error } = await admin.from('ai_analysis_cache').insert({
      organization_id: orgId, analysis_type: 'CONFERENCIA_EMAIL', cache_key: chave(dia, vendedor.user_id),
      result: leitura, expires_at: new Date(Date.now() + DEZ_ANOS).toISOString(),
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, dia, vendedor_id: vendedor.user_id, vendedor_nome: vendedor.name, empresas: ex.linhas.length, custo_reais: ex.custo_reais });
  } catch (e) {
    console.error('[conferencia POST]', e);
    const msg = e instanceof Error && /OpenAI|IA/.test(e.message) ? e.message : 'Erro ao ler o e-mail.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await autorizar();
    if (!auth.profile) return auth.erro;
    const { profile } = auth;
    const dia = request.nextUrl.searchParams.get('dia');
    const vendedorId = request.nextUrl.searchParams.get('vendedor_id');
    if (!diaValido(dia) || !vendedorId) return NextResponse.json({ error: 'Informe o dia e o vendedor.' }, { status: 400 });
    const { error } = await getAdminClient().from('ai_analysis_cache').delete()
      .eq('organization_id', profile.organization_id).eq('analysis_type', 'CONFERENCIA_EMAIL').eq('cache_key', chave(dia, vendedorId));
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[conferencia DELETE]', e);
    return NextResponse.json({ error: 'Erro ao apagar.' }, { status: 500 });
  }
}
