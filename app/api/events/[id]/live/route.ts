import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/events/[id]/live — dados em tempo real para War Room e live presence
// Retorna: cobertura, ranking, visitas últimas 2h, "quem está ativo agora"
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const admin = getAdminClient();

    // Evento
    const { data: event } = await admin
      .from('events')
      .select('id, name, location, start_date, end_date')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    // Booths
    const { data: booths } = await admin
      .from('event_booths')
      .select('id, status, sector')
      .eq('event_id', id)
      .eq('organization_id', profile.organization_id);

    const boothsList = booths || [];
    const total = boothsList.length;
    const visited = boothsList.filter((b: any) => b.status === 'VISITADO').length;
    const pending = total - visited;
    const pct = total > 0 ? Math.round((visited / total) * 100) : 0;

    // Visitas — todas (pra ranking completo)
    const { data: visits } = await admin
      .from('booth_visits')
      .select('id, user_id, user_name, visited_at, booth_id, prospect_type, contact_name, contact_id')
      .eq('event_id', id)
      .eq('organization_id', profile.organization_id)
      .order('visited_at', { ascending: false });

    // Filtra visitas: descarta as vinculadas a contatos draft/inexistentes pra
    // que o ranking ao vivo bata com a aba Contatos e com /sellers. Mantem
    // visitas sem contact_id (visita exploratoria sem captura).
    const { data: activeContactsForLive } = await admin
      .from('contacts')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('event_id', id)
      .eq('is_draft', false)
      .eq('inexistente', false);
    const activeContactIdsLive = new Set((activeContactsForLive || []).map((c: any) => c.id));

    const visitsList = (visits || []).filter((v: any) =>
      !v.contact_id || activeContactIdsLive.has(v.contact_id)
    );
    const now = Date.now();
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const FIVE_MIN = 5 * 60 * 1000;

    // Ranking completo
    const userMap: Record<string, { user_name: string; total: number; last_2h: number; last_active: string | null }> = {};
    visitsList.forEach((v: any) => {
      if (!userMap[v.user_id]) {
        userMap[v.user_id] = { user_name: v.user_name, total: 0, last_2h: 0, last_active: null };
      }
      userMap[v.user_id].total++;
      const visitTime = new Date(v.visited_at).getTime();
      if (now - visitTime <= TWO_HOURS) userMap[v.user_id].last_2h++;
      if (!userMap[v.user_id].last_active || v.visited_at > userMap[v.user_id].last_active!) {
        userMap[v.user_id].last_active = v.visited_at;
      }
    });

    const ranking = Object.entries(userMap)
      .map(([user_id, d]) => ({ user_id, ...d }))
      .sort((a, b) => b.total - a.total);

    // Ativos agora (visitaram nos últimos 5 min)
    const activeNow = ranking
      .filter((u) => u.last_active && (now - new Date(u.last_active).getTime()) <= FIVE_MIN)
      .map((u) => ({ user_id: u.user_id, user_name: u.user_name, last_active: u.last_active! }));

    // Últimas 20 visitas (feed)
    const recent = visitsList.slice(0, 20).map((v: any) => ({
      id: v.id,
      user_name: v.user_name,
      booth_id: v.booth_id,
      visited_at: v.visited_at,
      prospect_type: v.prospect_type,
      contact_name: v.contact_name,
    }));

    // Visitas por booth_id recém (últimos 5 min) — pra piscar no mapa
    const recentBoothIds: Record<string, { user_name: string; visited_at: string }> = {};
    visitsList.forEach((v: any) => {
      const visitTime = new Date(v.visited_at).getTime();
      if (now - visitTime <= FIVE_MIN && !recentBoothIds[v.booth_id]) {
        recentBoothIds[v.booth_id] = { user_name: v.user_name, visited_at: v.visited_at };
      }
    });

    // Visitas nas últimas 2h
    const visits_last_2h = visitsList.filter((v: any) => {
      const t = new Date(v.visited_at).getTime();
      return now - t <= TWO_HOURS;
    }).length;

    // Ritmo — visitas nas últimas 1h
    const ONE_HOUR = 60 * 60 * 1000;
    const visits_last_1h = visitsList.filter((v: any) => {
      const t = new Date(v.visited_at).getTime();
      return now - t <= ONE_HOUR;
    }).length;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      event,
      summary: {
        total,
        visited,
        pending,
        pct,
        total_visits: visitsList.length,
        visits_last_1h,
        visits_last_2h,
      },
      ranking,
      active_now: activeNow,
      recent,
      recent_booth_ids: recentBoothIds,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
