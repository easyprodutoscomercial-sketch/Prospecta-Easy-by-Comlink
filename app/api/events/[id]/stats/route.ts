import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/events/[id]/stats — event dashboard stats with daily breakdown
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

    // Get event for date range
    const { data: event } = await admin
      .from('events')
      .select('start_date, end_date')
      .eq('id', id)
      .single();

    // Get all booths
    const { data: booths } = await admin
      .from('event_booths')
      .select('id, status')
      .eq('event_id', id)
      .eq('organization_id', profile.organization_id);

    const totalBooths = (booths || []).length;
    const visitedBooths = (booths || []).filter((b: any) => b.status === 'VISITADO').length;
    const pendingBooths = totalBooths - visitedBooths;

    // Get all visits with booth info
    const { data: visits } = await admin
      .from('booth_visits')
      .select('id, user_id, user_name, visited_at, prospect_type, contact_name, contact_id, booth_id, event_booths(company_name)')
      .eq('event_id', id)
      .eq('organization_id', profile.organization_id)
      .order('visited_at', { ascending: true });

    // Busca contatos ATIVOS do evento (nao-draft + nao-descartados) ANTES das
    // agregacoes pra que numeros do Dashboard batam com a aba Contatos e com o
    // ranking de vendedores. Antes esse endpoint contava visitas/leads brutos
    // incluindo rascunhos abandonados — vendedor via 600 leads no Dashboard
    // mas 480 na aba Contatos. Agora ambos contam o mesmo conjunto.
    const { data: eventContactsActive } = await admin
      .from('contacts')
      .select('id, created_by_user_id, created_at')
      .eq('organization_id', profile.organization_id)
      .eq('event_id', id)
      .eq('is_draft', false)
      .eq('inexistente', false);

    const activeContactIds = new Set((eventContactsActive || []).map((c: any) => c.id));

    // visits "ativas" = sem contact_id (visita exploratoria sem captura) OU
    // com contact_id que ainda esta ativo (nao virou rascunho/descartado).
    const visitsActive = (visits || []).filter((v: any) =>
      !v.contact_id || activeContactIds.has(v.contact_id)
    );

    // Per-user stats
    const userStats: Record<string, { user_name: string; count: number }> = {};
    visitsActive.forEach((v: any) => {
      if (!userStats[v.user_id]) {
        userStats[v.user_id] = { user_name: v.user_name, count: 0 };
      }
      userStats[v.user_id].count++;
    });

    const byUser = Object.entries(userStats)
      .map(([user_id, data]) => ({ user_id, ...data }))
      .sort((a, b) => b.count - a.count);

    // Build all event days (start_date to end_date)
    const eventDays: string[] = [];
    if (event) {
      const start = new Date(event.start_date + 'T12:00:00');
      const end = new Date(event.end_date + 'T12:00:00');
      const cursor = new Date(start);
      while (cursor <= end) {
        eventDays.push(cursor.toISOString().split('T')[0]);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // Per-day detailed stats
    const dayMap: Record<string, {
      visits: number;
      unique_booths: Set<string>;
      by_user: Record<string, { user_name: string; count: number }>;
      by_type: Record<string, number>;
      first_visit: string | null;
      last_visit: string | null;
    }> = {};

    // Initialize all event days
    eventDays.forEach((day) => {
      dayMap[day] = {
        visits: 0,
        unique_booths: new Set(),
        by_user: {},
        by_type: {},
        first_visit: null,
        last_visit: null,
      };
    });

    visitsActive.forEach((v: any) => {
      const day = v.visited_at.split('T')[0];
      if (!dayMap[day]) {
        dayMap[day] = {
          visits: 0,
          unique_booths: new Set(),
          by_user: {},
          by_type: {},
          first_visit: null,
          last_visit: null,
        };
      }
      const d = dayMap[day];
      d.visits++;
      d.unique_booths.add(v.booth_id);

      // Track first/last visit time
      const time = v.visited_at;
      if (!d.first_visit || time < d.first_visit) d.first_visit = time;
      if (!d.last_visit || time > d.last_visit) d.last_visit = time;

      // By user per day
      if (!d.by_user[v.user_id]) {
        d.by_user[v.user_id] = { user_name: v.user_name, count: 0 };
      }
      d.by_user[v.user_id].count++;

      // By type per day
      d.by_type[v.prospect_type] = (d.by_type[v.prospect_type] || 0) + 1;
    });

    // Convert to serializable format
    const dailyDetails = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data], idx) => {
        const usersArr = Object.entries(data.by_user)
          .map(([user_id, info]) => ({ user_id, ...info }))
          .sort((a, b) => b.count - a.count);

        // Compute active hours
        let activeHours = 0;
        if (data.first_visit && data.last_visit) {
          const diffMs = new Date(data.last_visit).getTime() - new Date(data.first_visit).getTime();
          activeHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
        }

        return {
          date,
          day_number: idx + 1,
          visits: data.visits,
          unique_booths: data.unique_booths.size,
          by_user: usersArr,
          by_type: data.by_type,
          first_visit: data.first_visit,
          last_visit: data.last_visit,
          active_hours: activeHours,
          avg_per_hour: activeHours > 0 ? Math.round((data.visits / activeHours) * 10) / 10 : 0,
        };
      });

    // Cumulative progress per day
    let cumulativeVisited = 0;
    const visitedBoothsPerDay = new Set<string>();
    const cumulativeByDay = dailyDetails.map((day) => {
      // Count new unique booths visited on this day
      visitsActive.forEach((v: any) => {
        if (v.visited_at.startsWith(day.date)) {
          visitedBoothsPerDay.add(v.booth_id);
        }
      });
      return {
        date: day.date,
        cumulative_booths: visitedBoothsPerDay.size,
        cumulative_pct: totalBooths > 0 ? Math.round((visitedBoothsPerDay.size / totalBooths) * 100) : 0,
      };
    });

    // By prospect type (global)
    const byType: Record<string, number> = {};
    visitsActive.forEach((v: any) => {
      byType[v.prospect_type] = (byType[v.prospect_type] || 0) + 1;
    });

    // Overall averages
    const daysWithVisits = dailyDetails.filter((d) => d.visits > 0).length;
    const totalVisits = visitsActive.length;

    // Leads avulsos = contatos ATIVOS com event_id deste evento MAS sem booth_visit.
    // Reusa eventContactsActive (ja filtrado por is_draft=false + inexistente=false)
    // pra que o numero bata com a aba Contatos.
    const visitContactIds = new Set<string>();
    visitsActive.forEach((v: any) => {
      if (v.contact_id) visitContactIds.add(v.contact_id);
    });

    const walkInContacts = (eventContactsActive || []).filter((c: any) => !visitContactIds.has(c.id));
    const totalWalkIns = walkInContacts.length;

    // Walk-ins por vendedor (pra futuro breakdown)
    const walkInsByUser: Record<string, number> = {};
    walkInContacts.forEach((c: any) => {
      const uid = c.created_by_user_id || 'unknown';
      walkInsByUser[uid] = (walkInsByUser[uid] || 0) + 1;
    });

    return NextResponse.json({
      total_booths: totalBooths,
      visited_booths: visitedBooths,
      pending_booths: pendingBooths,
      progress_pct: totalBooths > 0 ? Math.round((visitedBooths / totalBooths) * 100) : 0,
      total_visits: totalVisits,
      total_walk_ins: totalWalkIns,
      total_leads_event: totalVisits + totalWalkIns,
      total_event_days: eventDays.length,
      days_with_visits: daysWithVisits,
      avg_visits_per_day: daysWithVisits > 0 ? Math.round(totalVisits / daysWithVisits) : 0,
      by_user: byUser,
      walk_ins_by_user: walkInsByUser,
      by_day: dailyDetails,
      cumulative_by_day: cumulativeByDay,
      by_type: byType,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
