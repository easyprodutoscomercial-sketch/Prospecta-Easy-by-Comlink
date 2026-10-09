import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { MODULOS, normalizarDesligados } from '@/lib/modulos/regras';
import { modulosDesligados, gravarDesligados } from '@/lib/modulos/servidor';

// GET /api/modulos -> { modulos: [...], desligados: [...] } (so admin)
// PUT /api/modulos { desligados: [...] } -> liga/desliga modulos da empresa (so admin)
// Desligar so esconde: nenhum dado e apagado.

async function soAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'Nao autorizado' }, { status: 401 }) };
  const profile = await ensureProfile(supabase, user);
  if (!profile) return { erro: NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 }) };
  if (profile.role !== 'admin') {
    return { erro: NextResponse.json({ error: 'Só o administrador liga ou desliga módulos.' }, { status: 403 }) };
  }
  return { profile };
}

export async function GET() {
  try {
    const ctx = await soAdmin();
    if (ctx.erro) return ctx.erro;
    const desligados = await modulosDesligados(ctx.profile.organization_id);
    return NextResponse.json({ modulos: MODULOS, desligados });
  } catch (e) {
    console.error('[modulos GET]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await soAdmin();
    if (ctx.erro) return ctx.erro;
    const { profile } = ctx;

    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body?.desligados)) {
      return NextResponse.json({ error: 'Envie a lista de módulos desligados.' }, { status: 400 });
    }
    const desligados = normalizarDesligados(body.desligados);

    const erro = await gravarDesligados(getAdminClient(), profile.organization_id, desligados, profile.user_id);
    if (erro) return NextResponse.json({ error: erro }, { status: 500 });

    console.log('[modulos]', JSON.stringify({ por: profile.user_id, desligados }));
    return NextResponse.json({ desligados });
  } catch (e) {
    console.error('[modulos PUT]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
