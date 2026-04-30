import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/events/[id]/report-data
// Retorna dados agregados completos para o relatório executivo do evento.
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
    const { data: event, error: eventErr } = await admin
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (eventErr || !event) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    // Stands
    const { data: booths } = await admin
      .from('event_booths')
      .select('*')
      .eq('event_id', id)
      .eq('organization_id', profile.organization_id);

    // Visitas — filtradas por contato ATIVO pra bater com /sellers e aba Contatos.
    // Mantem visitas sem contact_id (exploratoria sem captura).
    const { data: visitsRaw } = await admin
      .from('booth_visits')
      .select('*')
      .eq('event_id', id)
      .eq('organization_id', profile.organization_id)
      .order('visited_at', { ascending: true });

    const { data: activeContactsForReport } = await admin
      .from('contacts')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('event_id', id)
      .eq('is_draft', false)
      .eq('inexistente', false);
    const activeContactIdsReport = new Set((activeContactsForReport || []).map((c: any) => c.id));

    const visits = (visitsRaw || []).filter((v: any) =>
      !v.contact_id || activeContactIdsReport.has(v.contact_id)
    );

    // Organização (para cabeçalho)
    const { data: org } = await admin
      .from('organizations')
      .select('name, logo_url')
      .eq('id', profile.organization_id)
      .single();

    const boothsList = booths || [];
    const visitsList = visits || [];
    const totalBooths = boothsList.length;
    const visitedBooths = boothsList.filter((b: any) => b.status === 'VISITADO').length;
    const pendingBooths = totalBooths - visitedBooths;
    const progressPct = totalBooths > 0 ? Math.round((visitedBooths / totalBooths) * 100) : 0;

    // Mapa de stands por id
    const boothById: Record<string, any> = {};
    boothsList.forEach((b: any) => { boothById[b.id] = b; });

    // ----- Por usuário
    const userMap: Record<string, { user_name: string; count: number; unique_booths: Set<string>; by_type: Record<string, number> }> = {};
    visitsList.forEach((v: any) => {
      if (!userMap[v.user_id]) {
        userMap[v.user_id] = { user_name: v.user_name, count: 0, unique_booths: new Set(), by_type: {} };
      }
      userMap[v.user_id].count++;
      userMap[v.user_id].unique_booths.add(v.booth_id);
      userMap[v.user_id].by_type[v.prospect_type] = (userMap[v.user_id].by_type[v.prospect_type] || 0) + 1;
    });
    const byUser = Object.entries(userMap)
      .map(([user_id, d]) => ({
        user_id,
        user_name: d.user_name,
        visits: d.count,
        unique_booths: d.unique_booths.size,
        by_type: d.by_type,
      }))
      .sort((a, b) => b.visits - a.visits);

    // ----- Por setor
    const sectorMap: Record<string, { total: number; visited: number }> = {};
    boothsList.forEach((b: any) => {
      const key = b.sector || 'Sem setor';
      if (!sectorMap[key]) sectorMap[key] = { total: 0, visited: 0 };
      sectorMap[key].total++;
      if (b.status === 'VISITADO') sectorMap[key].visited++;
    });
    const bySector = Object.entries(sectorMap)
      .map(([sector, d]) => ({
        sector,
        total: d.total,
        visited: d.visited,
        pending: d.total - d.visited,
        coverage_pct: d.total > 0 ? Math.round((d.visited / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.coverage_pct - a.coverage_pct);

    // ----- Por tipo de prospect
    const byType: Record<string, number> = {};
    visitsList.forEach((v: any) => {
      byType[v.prospect_type] = (byType[v.prospect_type] || 0) + 1;
    });

    // ----- Por dia (com detalhes)
    const eventDays: string[] = [];
    const start = new Date(event.start_date + 'T12:00:00');
    const end = new Date(event.end_date + 'T12:00:00');
    const cursor = new Date(start);
    while (cursor <= end) {
      eventDays.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
    }

    const dayMap: Record<string, {
      visits: number;
      unique_booths: Set<string>;
      by_user: Record<string, { user_name: string; count: number }>;
      by_type: Record<string, number>;
      first_visit: string | null;
      last_visit: string | null;
    }> = {};
    eventDays.forEach((day) => {
      dayMap[day] = { visits: 0, unique_booths: new Set(), by_user: {}, by_type: {}, first_visit: null, last_visit: null };
    });
    visitsList.forEach((v: any) => {
      const day = v.visited_at.split('T')[0];
      if (!dayMap[day]) {
        dayMap[day] = { visits: 0, unique_booths: new Set(), by_user: {}, by_type: {}, first_visit: null, last_visit: null };
      }
      const d = dayMap[day];
      d.visits++;
      d.unique_booths.add(v.booth_id);
      if (!d.first_visit || v.visited_at < d.first_visit) d.first_visit = v.visited_at;
      if (!d.last_visit || v.visited_at > d.last_visit) d.last_visit = v.visited_at;
      if (!d.by_user[v.user_id]) d.by_user[v.user_id] = { user_name: v.user_name, count: 0 };
      d.by_user[v.user_id].count++;
      d.by_type[v.prospect_type] = (d.by_type[v.prospect_type] || 0) + 1;
    });
    const byDay = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data], idx) => {
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
          by_user: Object.entries(data.by_user)
            .map(([user_id, info]) => ({ user_id, ...info }))
            .sort((a, b) => b.count - a.count),
          by_type: data.by_type,
          first_visit: data.first_visit,
          last_visit: data.last_visit,
          active_hours: activeHours,
          avg_per_hour: activeHours > 0 ? Math.round((data.visits / activeHours) * 10) / 10 : 0,
        };
      });

    // ----- Top empresas (mais visitadas / únicas)
    const visitedCompanies = boothsList
      .filter((b: any) => b.status === 'VISITADO')
      .map((b: any) => ({
        id: b.id,
        company_name: b.company_name,
        booth_number: b.booth_number,
        sector: b.sector,
      }));

    // ----- Lista completa de visitas (enriquecida com dados do stand)
    const visitsDetailed = visitsList.map((v: any) => {
      const booth = boothById[v.booth_id];
      return {
        id: v.id,
        booth_id: v.booth_id,
        company_name: booth?.company_name || null,
        booth_number: booth?.booth_number || null,
        sector: booth?.sector || null,
        user_id: v.user_id,
        user_name: v.user_name,
        visited_at: v.visited_at,
        photo_facade_url: v.photo_facade_url,
        photo_contact_url: v.photo_contact_url,
        contact_name: v.contact_name,
        contact_role: v.contact_role,
        prospect_type: v.prospect_type,
        notes: v.notes,
        contact_id: v.contact_id,
      };
    });

    // ----- Stands pendentes (lista para follow-up)
    const pendingList = boothsList
      .filter((b: any) => b.status !== 'VISITADO')
      .map((b: any) => ({
        id: b.id,
        company_name: b.company_name,
        booth_number: b.booth_number,
        sector: b.sector,
      }))
      .sort((a: any, b: any) => (a.sector || '').localeCompare(b.sector || '') || (a.booth_number || '').localeCompare(b.booth_number || ''));

    // ----- Fotos (agregado)
    const photos = visitsList
      .flatMap((v: any) => {
        const booth = boothById[v.booth_id];
        const arr: any[] = [];
        if (v.photo_facade_url) {
          arr.push({
            url: v.photo_facade_url,
            kind: 'facade',
            company_name: booth?.company_name || null,
            booth_number: booth?.booth_number || null,
            user_name: v.user_name,
            visited_at: v.visited_at,
          });
        }
        if (v.photo_contact_url) {
          arr.push({
            url: v.photo_contact_url,
            kind: 'contact',
            company_name: booth?.company_name || null,
            booth_number: booth?.booth_number || null,
            user_name: v.user_name,
            visited_at: v.visited_at,
          });
        }
        return arr;
      });

    // Média de visitas por dia (apenas dias com atividade)
    const daysWithVisits = byDay.filter((d) => d.visits > 0).length;
    const totalVisits = visitsList.length;
    const avgVisitsPerDay = daysWithVisits > 0 ? Math.round(totalVisits / daysWithVisits) : 0;

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      event,
      organization: org || null,
      summary: {
        total_booths: totalBooths,
        visited_booths: visitedBooths,
        pending_booths: pendingBooths,
        progress_pct: progressPct,
        total_visits: totalVisits,
        total_event_days: eventDays.length,
        days_with_visits: daysWithVisits,
        avg_visits_per_day: avgVisitsPerDay,
        total_photos: photos.length,
        unique_companies_visited: visitedCompanies.length,
        by_type: byType,
      },
      by_user: byUser,
      by_sector: bySector,
      by_day: byDay,
      visited_companies: visitedCompanies,
      pending_list: pendingList,
      visits: visitsDetailed,
      photos,
    });
  } catch (error: any) {
    console.error('[report-data] error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao gerar relatório' }, { status: 500 });
  }
}
