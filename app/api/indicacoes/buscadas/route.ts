import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/indicacoes/buscadas -> { [contactId]: quantidade de empresas achadas pela IA }
// Uma chamada so pro kanban inteiro: o card mostra que aquele cliente ja teve busca.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const { data } = await getAdminClient().from('ai_analysis_cache')
      .select('cache_key, result, created_at')
      .eq('organization_id', profile.organization_id).eq('analysis_type', 'INDICACOES_IA')
      .like('cache_key', 'ia|contato|%')
      .order('created_at', { ascending: true }).limit(2000);

    // vale a busca mais recente de cada cliente (a ordem crescente deixa a ultima por cima)
    const mapa: Record<string, number> = {};
    for (const r of data || []) {
      const id = r.cache_key.slice('ia|contato|'.length, 'ia|contato|'.length + 36);
      mapa[id] = ((r.result as { empresas?: unknown[] }).empresas || []).length;
    }
    return NextResponse.json(mapa);
  } catch (e) {
    console.error('[indicacoes buscadas]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
