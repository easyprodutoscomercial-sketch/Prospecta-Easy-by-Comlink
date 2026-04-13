import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/events — list events for org
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const admin = getAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    let query = admin
      .from('events')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('start_date', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: events, error } = await query;
    if (error) throw error;

    // Get booth counts for each event
    const eventIds = (events || []).map((e: any) => e.id);
    if (eventIds.length > 0) {
      const { data: boothCounts } = await admin
        .from('event_booths')
        .select('event_id, status')
        .in('event_id', eventIds);

      const countsMap: Record<string, { total: number; visited: number }> = {};
      (boothCounts || []).forEach((b: any) => {
        if (!countsMap[b.event_id]) countsMap[b.event_id] = { total: 0, visited: 0 };
        countsMap[b.event_id].total++;
        if (b.status === 'VISITADO') countsMap[b.event_id].visited++;
      });

      (events || []).forEach((e: any) => {
        e.booth_count = countsMap[e.id]?.total || 0;
        e.visited_count = countsMap[e.id]?.visited || 0;
      });
    }

    return NextResponse.json({ events: events || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao buscar eventos' }, { status: 500 });
  }
}

// POST /api/events — create event
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const admin = getAdminClient();
    const body = await request.json();

    const { name, location, start_date, end_date, map_url, pipeline_id, stage_id, status } = body;

    if (!name || !start_date || !end_date) {
      return NextResponse.json({ error: 'Nome, data início e data fim são obrigatórios' }, { status: 400 });
    }

    const { data: event, error } = await admin
      .from('events')
      .insert({
        organization_id: profile.organization_id,
        name,
        location: location || null,
        start_date,
        end_date,
        map_url: map_url || null,
        pipeline_id: pipeline_id || null,
        stage_id: stage_id || null,
        status: status || 'RASCUNHO',
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(event, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao criar evento' }, { status: 500 });
  }
}
