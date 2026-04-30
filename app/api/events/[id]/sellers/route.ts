import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/events/[id]/sellers
// Lista vendedores "atuando na feira": todo usuário que tem lead_capture_link
// ativo no pipeline do evento (= quem pode gerar QR nos stands). Pra cada um,
// retorna contadores reais de produção neste evento:
//  - contacts_captured: total de contatos atribuidos (created_by_user_id) no evento
//  - stands_visited: quantos stands UNICOS o vendedor visitou (booth_visits distinct booth_id)
//  - total_visits: total de visitas registradas (pode ser > stands_visited se revisitou)
//  - qr_leads / manual_checkins: detalhamento legacy
//  - last_activity: timestamp da visita mais recente
export async function GET(
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

    // 1. Pega evento + pipeline
    const { data: event } = await admin
      .from('events')
      .select('id, pipeline_id')
      .eq('id', eventId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Evento nao encontrado' }, { status: 404 });
    }

    // 2. Vendedores com QR ativo pra este evento ou pipeline.
    // Prioriza links ja amarrados a este event_id; se houver qualquer link
    // travado no evento, filtra SO esses usuarios. Senao, usa links genericos
    // (event_id null) do mesmo pipeline — modo retrocompativel.
    const eligibleUserIds = new Set<string>();
    const eventScopedUserIds = new Set<string>();
    if (event.pipeline_id) {
      const { data: links } = await admin
        .from('lead_capture_links')
        .select('user_id, event_id')
        .eq('organization_id', profile.organization_id)
        .eq('pipeline_id', event.pipeline_id)
        .eq('is_active', true);
      (links || []).forEach((l: any) => {
        if (!l.user_id) return;
        if (l.event_id === eventId) eventScopedUserIds.add(l.user_id);
      });
      // Se ha pelo menos 1 link travado no evento, a lista "elegivel" vira
      // apenas esses. Quem so tem link generico e ignorado — e um passo
      // forte, mas e o ponto do vinculo forte.
      if (eventScopedUserIds.size > 0) {
        eventScopedUserIds.forEach((uid) => eligibleUserIds.add(uid));
      } else {
        (links || []).forEach((l: any) => {
          if (l.user_id && l.event_id === null) eligibleUserIds.add(l.user_id);
        });
      }
    }

    // 3. Vendedores que já produziram leads deste evento (união com os elegíveis)
    const { data: eventContacts } = await admin
      .from('contacts')
      .select('created_by_user_id')
      .eq('organization_id', profile.organization_id)
      .eq('event_id', eventId)
      .not('created_by_user_id', 'is', null);

    const qrLeadsByUser: Record<string, number> = {};
    (eventContacts || []).forEach((c: any) => {
      if (!c.created_by_user_id) return;
      eligibleUserIds.add(c.created_by_user_id);
      qrLeadsByUser[c.created_by_user_id] = (qrLeadsByUser[c.created_by_user_id] || 0) + 1;
    });

    // 4. Quem fez check-in manual no evento (booth_visits) — agrega tambem stands UNICOS
    const { data: visits } = await admin
      .from('booth_visits')
      .select('user_id, visited_at, booth_id')
      .eq('event_id', eventId)
      .eq('organization_id', profile.organization_id)
      .order('visited_at', { ascending: false });

    const manualByUser: Record<string, number> = {};
    const lastActivityByUser: Record<string, string> = {};
    const standsSetByUser: Record<string, Set<string>> = {};
    (visits || []).forEach((v: any) => {
      if (!v.user_id) return;
      eligibleUserIds.add(v.user_id);
      manualByUser[v.user_id] = (manualByUser[v.user_id] || 0) + 1;
      if (v.booth_id) {
        if (!standsSetByUser[v.user_id]) standsSetByUser[v.user_id] = new Set();
        standsSetByUser[v.user_id].add(v.booth_id);
      }
      if (!lastActivityByUser[v.user_id] || v.visited_at > lastActivityByUser[v.user_id]) {
        lastActivityByUser[v.user_id] = v.visited_at;
      }
    });

    // 4b. Total de stands no evento (pra calcular % de cobertura)
    const { count: totalStandsInEvent } = await admin
      .from('event_booths')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('organization_id', profile.organization_id);

    // 5. Busca nome e avatar dos profiles
    const userIds = Array.from(eligibleUserIds);
    let profilesMap: Record<string, { name: string; avatar_url: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('user_id, name, avatar_url')
        .in('user_id', userIds);
      (profiles || []).forEach((p: any) => {
        profilesMap[p.user_id] = { name: p.name || 'Sem nome', avatar_url: p.avatar_url || null };
      });
    }

    // 6. Monta resposta — ordenado por contatos_capturados desc, desempate por stands_visited
    const totalStands = totalStandsInEvent || 0;
    const sellers = userIds
      .map((uid) => {
        const qr = qrLeadsByUser[uid] || 0;
        const manual = manualByUser[uid] || 0;
        const standsVisited = standsSetByUser[uid]?.size || 0;
        const contactsCaptured = qr + manual;
        return {
          user_id: uid,
          name: profilesMap[uid]?.name || 'Sem nome',
          avatar_url: profilesMap[uid]?.avatar_url || null,
          contacts_captured: contactsCaptured,
          stands_visited: standsVisited,
          coverage_pct: totalStands > 0 ? Math.round((standsVisited / totalStands) * 100) : 0,
          total_visits: manual,
          qr_leads: qr,
          manual_checkins: manual,
          total: contactsCaptured,
          last_activity: lastActivityByUser[uid] || null,
        };
      })
      .sort((a, b) => {
        if (b.contacts_captured !== a.contacts_captured) return b.contacts_captured - a.contacts_captured;
        if (b.stands_visited !== a.stands_visited) return b.stands_visited - a.stands_visited;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({
      sellers,
      total_sellers: sellers.length,
      active_sellers: sellers.filter((s) => s.contacts_captured > 0 || s.stands_visited > 0).length,
      total_stands: totalStands,
    });
  } catch (error: any) {
    console.error('Error listing event sellers:', error);
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
