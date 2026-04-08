import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/quiz/stats — Dashboard stats (auth required)
export async function GET(request: NextRequest) {
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
    const diaParam = request.nextUrl.searchParams.get('dia');

    const addDiaFilter = (query: any) => {
      if (diaParam) {
        return query.eq('dia_feira', parseInt(diaParam));
      }
      return query;
    };

    // Total participants
    let totalQuery = admin
      .from('quiz_participantes')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId);
    totalQuery = addDiaFilter(totalQuery);
    const { count: total } = await totalQuery;

    // Today's participants
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let hojeQuery = admin
      .from('quiz_participantes')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('created_at', todayStart.toISOString());
    hojeQuery = addDiaFilter(hojeQuery);
    const { count: hoje } = await hojeQuery;

    // Participants by hour (last 24h) for chart
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let chartQuery = admin
      .from('quiz_participantes')
      .select('created_at')
      .eq('organization_id', orgId)
      .gte('created_at', last24h.toISOString())
      .order('created_at', { ascending: true });
    chartQuery = addDiaFilter(chartQuery);
    const { data: recentParticipants } = await chartQuery;

    // Group by hour
    const porHora: Record<string, number> = {};
    (recentParticipants || []).forEach((p: any) => {
      const hour = new Date(p.created_at).toLocaleString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).replace(/:\d{2}$/, ':00');
      porHora[hour] = (porHora[hour] || 0) + 1;
    });

    const chartData = Object.entries(porHora).map(([hora, count]) => ({
      hora,
      participantes: count,
    }));

    // Last 10 participants
    let ultimosQuery = admin
      .from('quiz_participantes')
      .select('id, nome, empresa, telefone, palpite, created_at, dia_feira')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10);
    ultimosQuery = addDiaFilter(ultimosQuery);
    const { data: ultimos } = await ultimosQuery;

    // Average guess
    let guessQuery = admin
      .from('quiz_participantes')
      .select('palpite')
      .eq('organization_id', orgId);
    guessQuery = addDiaFilter(guessQuery);
    const { data: allGuesses } = await guessQuery;

    let mediaPalpite = 0;
    let menorPalpite = 0;
    let maiorPalpite = 0;
    if (allGuesses && allGuesses.length > 0) {
      const palpites = allGuesses.map((p: any) => p.palpite);
      mediaPalpite = Math.round(palpites.reduce((a: number, b: number) => a + b, 0) / palpites.length);
      menorPalpite = Math.min(...palpites);
      maiorPalpite = Math.max(...palpites);
    }

    return NextResponse.json({
      total: total || 0,
      hoje: hoje || 0,
      media_palpite: mediaPalpite,
      menor_palpite: menorPalpite,
      maior_palpite: maiorPalpite,
      chart_data: chartData,
      ultimos: ultimos || [],
    });
  } catch (error: any) {
    console.error('Error fetching quiz stats:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
