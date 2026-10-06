import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { todasPermissoes, gravarPermissao, MAX_BUSCAS_DIA } from '@/lib/indicacoes/permissao';

// GET /api/indicacoes/permissoes -> { [user_id]: buscas por dia } (so admin)
// PUT /api/indicacoes/permissoes { user_id, buscas_dia } -> libera/bloqueia a busca com IA (so admin)
// Cada busca custa dinheiro na OpenAI: so o admin decide quem gasta e quanto.

async function soAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'Nao autorizado' }, { status: 401 }) };
  const profile = await ensureProfile(supabase, user);
  if (!profile) return { erro: NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 }) };
  if (profile.role !== 'admin') {
    return { erro: NextResponse.json({ error: 'Só o administrador pode liberar a busca com IA.' }, { status: 403 }) };
  }
  return { profile, admin: getAdminClient() };
}

export async function GET() {
  try {
    const ctx = await soAdmin();
    if (ctx.erro) return ctx.erro;
    return NextResponse.json(await todasPermissoes(ctx.admin, ctx.profile.organization_id));
  } catch (e) {
    console.error('[indicacoes permissoes GET]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await soAdmin();
    if (ctx.erro) return ctx.erro;
    const { admin, profile } = ctx;

    const body = await request.json().catch(() => ({}));
    const userId = typeof body?.user_id === 'string' ? body.user_id : '';
    const buscas = Number(body?.buscas_dia);
    if (!userId || !Number.isInteger(buscas) || buscas < 0 || buscas > MAX_BUSCAS_DIA) {
      return NextResponse.json({ error: `Informe um número de 0 a ${MAX_BUSCAS_DIA}.` }, { status: 400 });
    }

    // o usuario tem que ser desta empresa
    const { data: alvo } = await admin.from('profiles').select('user_id, name')
      .eq('organization_id', profile.organization_id).eq('user_id', userId).maybeSingle();
    if (!alvo) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    const erro = await gravarPermissao(admin, profile.organization_id, userId, buscas, profile.user_id);
    if (erro) return NextResponse.json({ error: erro }, { status: 500 });

    console.log('[indicacoes permissoes]', JSON.stringify({ por: profile.user_id, usuario: userId, nome: alvo.name, buscas_dia: buscas }));
    return NextResponse.json({ user_id: userId, buscas_dia: buscas });
  } catch (e) {
    console.error('[indicacoes permissoes PUT]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
