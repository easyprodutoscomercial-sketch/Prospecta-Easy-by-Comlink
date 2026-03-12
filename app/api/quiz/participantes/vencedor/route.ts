import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextResponse } from 'next/server';

// GET /api/quiz/participantes/vencedor — Reveal winner (auth required)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();
    const orgId = profile.organization_id;

    // Get quiz config to know the exact value
    const { data: config } = await admin
      .from('quiz_configuracoes')
      .select('valor_exato')
      .eq('organization_id', orgId)
      .single();

    if (!config) {
      return NextResponse.json({ error: 'Quiz não configurado' }, { status: 404 });
    }

    const valorExato = config.valor_exato;

    // Get all participants ordered by closest guess
    const { data: participantes, error } = await admin
      .from('quiz_participantes')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });

    if (error || !participantes || participantes.length === 0) {
      return NextResponse.json({
        vencedor: null,
        message: 'Nenhum participante encontrado',
        valor_exato: valorExato,
        ranking: [],
      });
    }

    // Sort by distance to exact value, then by earliest participation
    const ranked = participantes
      .map((p: any) => ({
        ...p,
        diferenca: Math.abs(p.palpite - valorExato),
      }))
      .sort((a: any, b: any) => {
        if (a.diferenca !== b.diferenca) return a.diferenca - b.diferenca;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    const top10 = ranked.slice(0, 10);
    const vencedor = ranked[0];

    return NextResponse.json({
      vencedor,
      valor_exato: valorExato,
      total_participantes: participantes.length,
      ranking: top10,
    });
  } catch (error: any) {
    console.error('Error revealing winner:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
