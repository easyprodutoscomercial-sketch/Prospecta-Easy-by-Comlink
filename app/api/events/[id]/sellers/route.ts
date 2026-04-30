import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/events/[id]/sellers
// Lista vendedores "atuando na feira": todo usuário que tem lead_capture_link
// ativo no pipeline do evento (= quem pode gerar QR nos stands). Pra cada um,
// retorna contadores reais de produção neste evento.
//
// REGRA DE CONTAGEM (corrigida em 2026-04-30 apos vendedores reclamarem
// que numeros estavam errados):
//
//   - contacts_captured = contatos UNICOS atribuidos ao vendedor.
//     Calcula uniao de SET de:
//       (a) contatos com created_by_user_id = vendedor (QR)
//       (b) contatos vinculados a booth_visits onde user_id = vendedor (stand)
//     Sem isso o numero inflava: cliente que escaneava QR + depois era
//     atendido no stand contava 2x. Mario tinha 304 mostrado mas real era 205.
//
//   - stands_visited = booths UNICOS (distinct booth_id) visitados.
//     Se vendedor abriu mesmo stand 2x pra corrigir, conta 1.
//
//   - via_qr / via_stand: detalhamento que SOMA pode dar > contacts_captured
//     (porque um contato pode ser ambos). E informativo, nao base de calculo.
//
//   - total_visits: total de booth_visits registradas (pode ser > stands_visited).
//     Util pra debug/auditoria, nao mostrado no card.
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

    // 3. Contatos do evento — busca id + created_by_user_id pra que possamos
    // depois fazer SET de contatos unicos por vendedor (sem dupla contagem).
    //
    // Filtros aplicados:
    //   - is_draft=false: rascunhos nao contam (vendedor abriu form e nao
    //     terminou, nao deveria pesar no ranking dele)
    //   - inexistente=false: descartados nao contam (vendedor decidiu que
    //     nao era um lead valido — nao infla a contagem do esforco dele)
    //
    // Isso bate com /api/contacts (que tambem exclui esses por default) e com
    // a aba Contatos do evento. Antes o ranking mostrava 631 e a lista
    // mostrava 556 — vendedor pensava "sumiu lead".
    const { data: eventContacts } = await admin
      .from('contacts')
      .select('id, created_by_user_id')
      .eq('organization_id', profile.organization_id)
      .eq('event_id', eventId)
      .eq('is_draft', false)
      .eq('inexistente', false);

    // Set de contatos UNICOS atribuidos a cada vendedor (uniao QR + stand)
    const contactsSetByUser: Record<string, Set<string>> = {};
    // Set de contatos que vieram via QR (created_by) — informativo
    const viaQrSetByUser: Record<string, Set<string>> = {};

    // Set de contatos ATIVOS do evento — usado pra excluir descartados/rascunhos
    // do lado do booth_visits tambem (visita pode estar linkada a contato que
    // depois virou rascunho/descartado, nao deveria contar)
    const activeContactIds = new Set((eventContacts || []).map((c: any) => c.id));

    (eventContacts || []).forEach((c: any) => {
      if (!c.created_by_user_id || !c.id) return;
      const uid = c.created_by_user_id;
      eligibleUserIds.add(uid);
      if (!contactsSetByUser[uid]) contactsSetByUser[uid] = new Set();
      if (!viaQrSetByUser[uid]) viaQrSetByUser[uid] = new Set();
      contactsSetByUser[uid].add(c.id);
      viaQrSetByUser[uid].add(c.id);
    });

    // 4. Booth visits — agrega stands UNICOS e contatos via stand
    const { data: visits } = await admin
      .from('booth_visits')
      .select('user_id, visited_at, booth_id, contact_id')
      .eq('event_id', eventId)
      .eq('organization_id', profile.organization_id)
      .order('visited_at', { ascending: false });

    const totalVisitsByUser: Record<string, number> = {};
    const lastActivityByUser: Record<string, string> = {};
    const standsSetByUser: Record<string, Set<string>> = {};
    const viaStandSetByUser: Record<string, Set<string>> = {};

    (visits || []).forEach((v: any) => {
      if (!v.user_id) return;
      eligibleUserIds.add(v.user_id);
      totalVisitsByUser[v.user_id] = (totalVisitsByUser[v.user_id] || 0) + 1;

      if (v.booth_id) {
        if (!standsSetByUser[v.user_id]) standsSetByUser[v.user_id] = new Set();
        standsSetByUser[v.user_id].add(v.booth_id);
      }

      // Contato vinculado a esta visita conta como atribuido a esse vendedor —
      // SO se o contato ainda esta ativo (nao foi descartado nem virou rascunho).
      if (v.contact_id && activeContactIds.has(v.contact_id)) {
        if (!contactsSetByUser[v.user_id]) contactsSetByUser[v.user_id] = new Set();
        if (!viaStandSetByUser[v.user_id]) viaStandSetByUser[v.user_id] = new Set();
        contactsSetByUser[v.user_id].add(v.contact_id);
        viaStandSetByUser[v.user_id].add(v.contact_id);
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
        const standsVisited = standsSetByUser[uid]?.size || 0;
        const contactsCaptured = contactsSetByUser[uid]?.size || 0;
        const viaQr = viaQrSetByUser[uid]?.size || 0;
        const viaStand = viaStandSetByUser[uid]?.size || 0;
        const totalVisits = totalVisitsByUser[uid] || 0;
        // Quantos contatos foram capturados POR AMBOS os caminhos (QR + stand).
        // Mostrar isso ajuda o vendedor a entender "esse cliente eu peguei via QR
        // depois fui no stand dele" — nao e duplicacao, e enriquecimento.
        const overlapBoth = (viaQr > 0 && viaStand > 0)
          ? Math.max(0, viaQr + viaStand - contactsCaptured)
          : 0;
        return {
          user_id: uid,
          name: profilesMap[uid]?.name || 'Sem nome',
          avatar_url: profilesMap[uid]?.avatar_url || null,
          // Numero principal — contatos UNICOS atribuidos
          contacts_captured: contactsCaptured,
          stands_visited: standsVisited,
          coverage_pct: totalStands > 0 ? Math.round((standsVisited / totalStands) * 100) : 0,
          // Detalhamento (informativo — soma pode dar > contacts_captured)
          via_qr: viaQr,
          via_stand: viaStand,
          overlap_both: overlapBoth,
          total_visits: totalVisits,
          // Aliases legados pra compat com chamadores antigos
          qr_leads: viaQr,
          manual_checkins: viaStand,
          total: contactsCaptured,
          last_activity: lastActivityByUser[uid] || null,
        };
      })
      .sort((a, b) => {
        if (b.contacts_captured !== a.contacts_captured) return b.contacts_captured - a.contacts_captured;
        if (b.stands_visited !== a.stands_visited) return b.stands_visited - a.stands_visited;
        return a.name.localeCompare(b.name);
      });

    // Total de contatos UNICOS no evento (real, nao soma dos cards). Usado no
    // header do ranking pra mostrar o "verdadeiro" sem inflar.
    const totalUniqueContacts = (eventContacts || []).length;

    return NextResponse.json({
      sellers,
      total_sellers: sellers.length,
      active_sellers: sellers.filter((s) => s.contacts_captured > 0 || s.stands_visited > 0).length,
      total_stands: totalStands,
      total_contacts: totalUniqueContacts,
    });
  } catch (error: any) {
    console.error('Error listing event sellers:', error);
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
