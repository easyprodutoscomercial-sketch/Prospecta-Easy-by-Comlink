import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// POST /api/events/[id]/snapshot
//
// Gera uma "foto" imut\u00e1vel do estado atual da feira. Usada manualmente
// pelo admin a qualquer momento, e automaticamente pelo PUT /api/events/[id]
// quando o status vira ENCERRADO.
//
// Objetivo: preservar historico executivo (quantos leads, vendedores, dias)
// mesmo se a feira for apagada depois via cascade delete. O snapshot fica
// na tabela event_snapshots, que tem event_id ON DELETE SET NULL — sobrevive.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();

    // Pega evento
    const { data: event } = await admin
      .from('events')
      .select('id, name, location, start_date, end_date, status, pipeline_id')
      .eq('id', eventId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Evento nao encontrado' }, { status: 404 });
    }

    // Body opcional: { trigger: 'manual' | 'auto_encerrado' }
    let trigger = 'manual';
    try {
      const body = await request.json();
      if (body?.trigger === 'auto_encerrado') trigger = 'auto_encerrado';
    } catch { /* body vazio, ok */ }

    // === Coleta os dados pro snapshot ===

    // Total de stands e visitados
    const { data: booths } = await admin
      .from('event_booths')
      .select('id, status, company_name, booth_number, sector')
      .eq('event_id', eventId)
      .eq('organization_id', profile.organization_id);

    const totalBooths = (booths || []).length;
    const visitedBooths = (booths || []).filter((b: any) => b.status === 'VISITADO').length;

    // Booth visits (leads de stand)
    const { data: visits } = await admin
      .from('booth_visits')
      .select('id, user_id, user_name, visited_at, prospect_type, contact_name, contact_id, booth_id')
      .eq('event_id', eventId)
      .eq('organization_id', profile.organization_id);

    const visitContactIds = new Set<string>();
    (visits || []).forEach((v: any) => {
      if (v.contact_id) visitContactIds.add(v.contact_id);
    });

    // Contatos ligados ao evento
    const { data: eventContacts } = await admin
      .from('contacts')
      .select('id, name, company, email, phone, cargo, valor_estimado, temperatura, status, created_by_user_id, created_at')
      .eq('organization_id', profile.organization_id)
      .eq('event_id', eventId);

    const allContactIds = (eventContacts || []).map((c: any) => c.id);
    // Walk-ins = contatos do evento que nao aparecem em booth_visits
    const walkInContacts = (eventContacts || []).filter((c: any) => !visitContactIds.has(c.id));
    const standContacts = (eventContacts || []).filter((c: any) => visitContactIds.has(c.id));

    const totalLeads = allContactIds.length;
    const totalWalkIns = walkInContacts.length;
    const totalStandLeads = standContacts.length;

    // Por vendedor (contatos criados + visitas feitas)
    const userAgg: Record<string, { user_id: string; user_name: string; leads: number; visits: number; total: number }> = {};

    (eventContacts || []).forEach((c: any) => {
      if (!c.created_by_user_id) return;
      if (!userAgg[c.created_by_user_id]) {
        userAgg[c.created_by_user_id] = {
          user_id: c.created_by_user_id,
          user_name: '',
          leads: 0,
          visits: 0,
          total: 0,
        };
      }
      userAgg[c.created_by_user_id].leads++;
      userAgg[c.created_by_user_id].total++;
    });

    (visits || []).forEach((v: any) => {
      if (!v.user_id) return;
      if (!userAgg[v.user_id]) {
        userAgg[v.user_id] = {
          user_id: v.user_id,
          user_name: v.user_name || '',
          leads: 0,
          visits: 0,
          total: 0,
        };
      }
      if (!userAgg[v.user_id].user_name && v.user_name) {
        userAgg[v.user_id].user_name = v.user_name;
      }
      userAgg[v.user_id].visits++;
      userAgg[v.user_id].total++;
    });

    // Busca nomes dos profiles
    const userIds = Object.keys(userAgg);
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);
      (profiles || []).forEach((p: any) => {
        if (userAgg[p.user_id] && !userAgg[p.user_id].user_name) {
          userAgg[p.user_id].user_name = p.name || 'Sem nome';
        }
      });
    }

    const sellers = Object.values(userAgg).sort((a, b) => b.total - a.total);

    // Por temperatura
    const byTemperatura: Record<string, number> = {};
    (eventContacts || []).forEach((c: any) => {
      if (c.temperatura) {
        byTemperatura[c.temperatura] = (byTemperatura[c.temperatura] || 0) + 1;
      }
    });

    // Por status
    const byStatus: Record<string, number> = {};
    (eventContacts || []).forEach((c: any) => {
      if (c.status) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    });

    // Valor total dos deals
    const totalValue = (eventContacts || []).reduce((sum: number, c: any) => {
      return sum + (Number(c.valor_estimado) || 0);
    }, 0);

    const highValueDeals = (eventContacts || [])
      .filter((c: any) => Number(c.valor_estimado) > 0)
      .sort((a: any, b: any) => Number(b.valor_estimado) - Number(a.valor_estimado))
      .slice(0, 10)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        company: c.company,
        valor: Number(c.valor_estimado),
      }));

    // Interactions no periodo (pra saber quanto trabalho ja rolou em cima)
    let totalInteractions = 0;
    let totalMeetings = 0;
    if (allContactIds.length > 0) {
      const { count: intCount } = await admin
        .from('interactions')
        .select('*', { count: 'exact', head: true })
        .in('contact_id', allContactIds);
      totalInteractions = intCount || 0;

      const { count: meetCount } = await admin
        .from('meetings')
        .select('*', { count: 'exact', head: true })
        .in('contact_id', allContactIds);
      totalMeetings = meetCount || 0;
    }

    // Por dia
    const dayMap: Record<string, number> = {};
    (visits || []).forEach((v: any) => {
      if (!v.visited_at) return;
      const day = v.visited_at.split('T')[0];
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    (walkInContacts || []).forEach((c: any) => {
      if (!c.created_at) return;
      const day = c.created_at.split('T')[0];
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    const byDay = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const snapshotData = {
      // Totais principais
      total_leads: totalLeads,
      total_stand_leads: totalStandLeads,
      total_walk_ins: totalWalkIns,
      total_booths: totalBooths,
      visited_booths: visitedBooths,
      coverage_pct: totalBooths > 0 ? Math.round((visitedBooths / totalBooths) * 100) : 0,
      total_value: totalValue,
      total_interactions: totalInteractions,
      total_meetings: totalMeetings,
      // Breakdowns
      sellers,
      by_temperatura: byTemperatura,
      by_status: byStatus,
      by_day: byDay,
      high_value_deals: highValueDeals,
      // Metadata do snapshot
      generated_at: new Date().toISOString(),
    };

    // Insere o snapshot
    const { data: snapshot, error: insertErr } = await admin
      .from('event_snapshots')
      .insert({
        organization_id: profile.organization_id,
        event_id: eventId,
        event_name: event.name,
        event_location: event.location,
        event_start_date: event.start_date,
        event_end_date: event.end_date,
        snapshot_data: snapshotData,
        trigger,
        created_by_user_id: user.id,
        created_by_name: profile.name,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('[snapshot] insert error:', insertErr);
      return NextResponse.json({ error: 'Erro ao gerar snapshot' }, { status: 500 });
    }

    return NextResponse.json({
      snapshot_id: snapshot.id,
      summary: snapshotData,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[snapshot] error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao gerar snapshot' }, { status: 500 });
  }
}
