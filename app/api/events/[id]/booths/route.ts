import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/events/[id]/booths — list booths with visit info
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
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');

    let query = admin
      .from('event_booths')
      .select('*')
      .eq('event_id', id)
      .eq('organization_id', profile.organization_id)
      .order('company_name', { ascending: true });

    if (search) {
      query = query.or(`company_name.ilike.%${search}%,booth_number.ilike.%${search}%,sector.ilike.%${search}%`);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: booths, error } = await query;
    if (error) throw error;

    // Get visits for these booths
    const boothIds = (booths || []).map((b: any) => b.id);
    let visits: any[] = [];
    if (boothIds.length > 0) {
      const { data: v } = await admin
        .from('booth_visits')
        .select('*')
        .in('booth_id', boothIds)
        .order('visited_at', { ascending: false });
      visits = v || [];
    }

    // Mapa booth_id -> visit MAIS RECENTE (compat legado pra UI antiga)
    const visitsMap: Record<string, any> = {};
    // Mapa booth_id -> array de vendedores DISTINTOS que visitaram (avatar+nome)
    // Ordenado por visited_at desc (mais recente primeiro)
    const visitorsByBooth: Record<string, Array<{
      user_id: string;
      user_name: string;
      avatar_url: string | null;
      visited_at: string;
    }>> = {};
    const seenVisitorByBooth: Record<string, Set<string>> = {};
    // Mapa booth_id -> Set<contact_id> (todos os contatos capturados naquele stand)
    const contactIdsByBooth: Record<string, Set<string>> = {};
    const allContactIds = new Set<string>();
    const visitorUserIds = new Set<string>();

    visits.forEach((v: any) => {
      if (!visitsMap[v.booth_id]) visitsMap[v.booth_id] = v;

      if (v.user_id) {
        if (!seenVisitorByBooth[v.booth_id]) seenVisitorByBooth[v.booth_id] = new Set();
        if (!seenVisitorByBooth[v.booth_id].has(v.user_id)) {
          seenVisitorByBooth[v.booth_id].add(v.user_id);
          if (!visitorsByBooth[v.booth_id]) visitorsByBooth[v.booth_id] = [];
          visitorsByBooth[v.booth_id].push({
            user_id: v.user_id,
            user_name: v.user_name || 'Vendedor',
            avatar_url: null, // preenchido logo abaixo via lookup
            visited_at: v.visited_at,
          });
          visitorUserIds.add(v.user_id);
        }
      }

      if (v.contact_id) {
        if (!contactIdsByBooth[v.booth_id]) contactIdsByBooth[v.booth_id] = new Set();
        contactIdsByBooth[v.booth_id].add(v.contact_id);
        allContactIds.add(v.contact_id);
      }
    });

    // Profiles e contacts sao independentes — paraleliza pra reduzir tempo
    // de resposta. Pra AGRISHOW (800 booths, ~4000 visits) economiza um
    // round trip; antes era serial (booths → visits → profiles → contacts).
    const [profsRes, contactsRes] = await Promise.all([
      visitorUserIds.size > 0
        ? admin
            .from('profiles')
            .select('user_id, avatar_url, name')
            .eq('organization_id', profile.organization_id)
            .in('user_id', Array.from(visitorUserIds))
        : Promise.resolve({ data: [] as any[] }),
      allContactIds.size > 0
        ? admin
            .from('contacts')
            // A coluna se chama `cargo`, nao `role` — antes a query devolvia
            // 400 silencioso e contactsMap ficava vazio, fazendo a aba
            // "Contatos" da feira aparecer com 0 mesmo tendo 200+ contatos
            // linkados a booth_visits.
            .select('id, name, contato_nome, cargo, phone')
            .eq('organization_id', profile.organization_id)
            .in('id', Array.from(allContactIds))
        : Promise.resolve({ data: [] as any[] }),
    ]);

    // Aplica avatar_url no array de visitors
    const avatarMap: Record<string, string | null> = {};
    (profsRes.data || []).forEach((p: any) => {
      avatarMap[p.user_id] = p.avatar_url || null;
    });
    Object.values(visitorsByBooth).forEach((list) => {
      list.forEach((v) => { v.avatar_url = avatarMap[v.user_id] ?? null; });
    });

    // Mapa de contatos pra enriquecer cada booth com lista de contacts[].
    // Mostra nome da pessoa (contato_nome) se tiver — em contatos de feira o
    // campo `name` costuma ser o nome da empresa (mesmo da booth.company_name)
    // e quem o vendedor capturou esta em contato_nome.
    const contactsMap: Record<string, { id: string; name: string; role: string | null; phone: string | null }> = {};
    (contactsRes.data || []).forEach((c: any) => {
      contactsMap[c.id] = {
        id: c.id,
        name: c.contato_nome || c.name,
        role: c.cargo || null,
        phone: c.phone || null,
      };
    });

    const enriched = (booths || []).map((b: any) => {
      const ids = contactIdsByBooth[b.id] ? Array.from(contactIdsByBooth[b.id]) : [];
      return {
        ...b,
        visit: visitsMap[b.id] || null, // legado — visita mais recente
        visitors: visitorsByBooth[b.id] || [], // NOVO — todos os vendedores distintos
        contacts: ids.map((cid) => contactsMap[cid]).filter(Boolean),
      };
    });

    return NextResponse.json({ booths: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao buscar stands' }, { status: 500 });
  }
}

// POST /api/events/[id]/booths — create booth (single or bulk)
export async function POST(
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
    const body = await request.json();

    // Verify event belongs to org
    const { data: event } = await admin
      .from('events')
      .select('id, pipeline_id, stage_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    // Flag para criar contatos a partir de booths existentes
    const createContacts = body.create_contacts === true;

    if (createContacts) {
      if (!event.pipeline_id) {
        return NextResponse.json({ error: 'Evento precisa ter um pipeline para criar contatos' }, { status: 400 });
      }

      // Buscar booths do evento que ainda nao tem contato vinculado
      const { data: allBooths } = await admin
        .from('event_booths')
        .select('id, company_name, booth_number')
        .eq('event_id', id)
        .eq('organization_id', profile.organization_id);

      if (!allBooths || allBooths.length === 0) {
        return NextResponse.json({ error: 'Nenhum stand cadastrado' }, { status: 400 });
      }

      // TRAVA 1: Booth com booth_visit vinculado a contato
      const { data: existingVisits } = await admin
        .from('booth_visits')
        .select('booth_id')
        .eq('event_id', id)
        .not('contact_id', 'is', null);

      const boothsWithContact = new Set((existingVisits || []).map((v: any) => v.booth_id));

      // TRAVA 2: Contato ja existe no evento com mesmo company_name
      // (cobre o caso onde visit foi orfanado por delete do contato anterior)
      const { data: existingContacts } = await admin
        .from('contacts')
        .select('company')
        .eq('organization_id', profile.organization_id)
        .eq('event_id', id);

      const companiesWithContact = new Set(
        (existingContacts || [])
          .map((c: any) => (c.company || '').toLowerCase().trim())
          .filter(Boolean)
      );

      const boothsToCreate = allBooths.filter((b: any) => {
        if (boothsWithContact.has(b.id)) return false; // ja tem visit vinculado
        const companyKey = (b.company_name || '').toLowerCase().trim();
        if (companiesWithContact.has(companyKey)) return false; // ja tem contato desta empresa
        return true;
      });

      if (boothsToCreate.length === 0) {
        return NextResponse.json({
          message: 'Todos os stands ja tem contatos criados',
          created: 0,
          skipped: allBooths.length,
        });
      }

      // Buscar primeiro stage do pipeline
      const { data: firstStage } = await admin
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', event.pipeline_id)
        .order('position', { ascending: true })
        .limit(1)
        .single();

      if (!firstStage) {
        return NextResponse.json({ error: 'Pipeline sem stages configurados' }, { status: 500 });
      }

      let created = 0;
      for (const b of boothsToCreate) {
        const contactData: Record<string, any> = {
          organization_id: profile.organization_id,
          name: b.company_name,
          company: b.company_name,
          name_normalized: b.company_name.toLowerCase().trim(),
          pipeline_id: event.pipeline_id,
          stage_id: event.stage_id || firstStage.id,
          tipo: [],
          status: 'NOVO',
          created_by_user_id: user.id,
        };

        // Tenta com origem, fallback sem
        let { data: newContact, error: cErr } = await admin
          .from('contacts')
          .insert({ ...contactData, origem: 'FEIRA' })
          .select('id')
          .single();

        if (cErr) {
          const { data: retry, error: rErr } = await admin
            .from('contacts')
            .insert(contactData)
            .select('id')
            .single();
          if (rErr) continue;
          newContact = retry;
        }

        if (newContact) {
          // Criar booth_visit sintetico (sem marcar VISITADO)
          await admin
            .from('booth_visits')
            .insert({
              booth_id: b.id,
              event_id: id,
              organization_id: profile.organization_id,
              user_id: user.id,
              contact_id: newContact.id,
              user_name: profile.name,
              notes: 'Contato criado antecipadamente',
            });
          created++;
        }
      }

      return NextResponse.json({ message: `${created} contatos criados`, created }, { status: 201 });
    }

    // Support bulk insert
    const rawItems = Array.isArray(body) ? body : [body];
    const items = rawItems.filter((i: any) => i && i.company_name);

    const records = items.map((item: any) => ({
      event_id: id,
      organization_id: profile.organization_id,
      company_name: item.company_name,
      booth_number: item.booth_number || null,
      sector: item.sector || null,
      status: 'PENDENTE',
    }));

    const { data: booths, error } = await admin
      .from('event_booths')
      .insert(records)
      .select();

    if (error) throw error;

    // Normaliza contatos por item: aceita tanto array `contacts[]` quanto campos flat legados
    type ContactInput = { name?: string; role?: string; phone?: string; email?: string };
    const extractContacts = (item: any): ContactInput[] => {
      if (Array.isArray(item?.contacts)) {
        return item.contacts.filter(
          (c: ContactInput) => c && (c.name || c.phone || c.email)
        );
      }
      if (item?.contact_name || item?.contact_phone || item?.contact_email) {
        return [
          {
            name: item.contact_name,
            role: item.contact_role,
            phone: item.contact_phone,
            email: item.contact_email,
          },
        ];
      }
      return [];
    };

    // Se algum item trouxe dados de contato, criar contato + booth_visit
    const contactItems = (booths || [])
      .map((b: any, idx: number) => ({
        booth: b,
        item: items[idx],
        contacts: extractContacts(items[idx]),
      }))
      .filter((pair: any) => pair.contacts.length > 0);

    let contactsCreated = 0;
    if (contactItems.length > 0 && event.pipeline_id) {
      // Buscar primeiro stage do pipeline (fallback)
      const { data: firstStage } = await admin
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', event.pipeline_id)
        .order('position', { ascending: true })
        .limit(1)
        .single();

      const stageId = event.stage_id || firstStage?.id;
      if (stageId) {
        for (const { booth, item, contacts } of contactItems) {
          for (const c of contacts) {
            const rawPhone: string = String(c.phone || '');
            const phoneNormalized = rawPhone.replace(/\D/g, '') || null;
            const rawEmail: string = String(c.email || '').trim();
            const emailNormalized = rawEmail ? rawEmail.toLowerCase() : null;
            const contactName: string =
              (c.name && String(c.name).trim()) || item.company_name;

            const contactData: Record<string, any> = {
              organization_id: profile.organization_id,
              name: contactName,
              company: item.company_name,
              name_normalized: contactName.toLowerCase().trim(),
              phone: rawPhone || null,
              phone_normalized: phoneNormalized,
              email: rawEmail || null,
              email_normalized: emailNormalized,
              pipeline_id: event.pipeline_id,
              stage_id: stageId,
              tipo: [],
              status: 'NOVO',
              created_by_user_id: user.id,
            };

            // Tenta com origem FEIRA, fallback sem
            let { data: newContact, error: cErr } = await admin
              .from('contacts')
              .insert({ ...contactData, origem: 'FEIRA' })
              .select('id')
              .single();

            if (cErr) {
              const { data: retry } = await admin
                .from('contacts')
                .insert(contactData)
                .select('id')
                .single();
              newContact = retry;
            }

            if (newContact) {
              await admin.from('booth_visits').insert({
                booth_id: booth.id,
                event_id: id,
                organization_id: profile.organization_id,
                user_id: user.id,
                contact_id: newContact.id,
                contact_name: c.name || null,
                contact_role: c.role || null,
                user_name: profile.name,
                notes: 'Importado via Excel',
              });
              contactsCreated++;
            }
          }
        }
      }
    }

    return NextResponse.json(
      { booths: booths || [], contactsCreated },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao criar stand' }, { status: 500 });
  }
}
