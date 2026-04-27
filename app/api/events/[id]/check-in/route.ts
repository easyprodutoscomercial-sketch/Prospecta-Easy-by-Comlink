import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { normalizePhone, normalizeEmail } from '@/lib/utils/normalize';

// Helper: upload a file to storage and return the public URL
async function uploadFile(admin: any, file: File, orgId: string, eventId: string, label: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = file.name.split('.').pop() || 'jpg';
  const safeName = `${Date.now()}-${label}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `${orgId}/events/${eventId}/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage
    .from('attachments')
    .upload(filePath, buffer, { contentType: file.type || 'image/jpeg' });
  if (error) return null;
  const { data: urlData } = admin.storage.from('attachments').getPublicUrl(filePath);
  return urlData.publicUrl;
}

// POST /api/events/[id]/check-in — register a booth visit
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const admin = getAdminClient();
    const contentType = request.headers.get('content-type') || '';

    let boothId: string;
    let contactName: string | null = null;
    let contactRole: string | null = null;
    let contactPhone: string | null = null;
    let contactEmail: string | null = null;
    let prospectType: string = 'COMPRADOR';
    let notes: string | null = null;
    let photoFacadeUrl: string | null = null;
    let photoContactUrl: string | null = null;
    let autoCreate = false;
    let markVisited = true;
    let extraPhotosUrls: string[] = [];
    let extraContacts: { name: string; cargo: string }[] = [];
    let idempotencyKey: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      boothId = formData.get('booth_id') as string;
      contactName = formData.get('contact_name') as string || null;
      contactRole = formData.get('contact_role') as string || null;
      contactPhone = formData.get('contact_phone') as string || null;
      contactEmail = formData.get('contact_email') as string || null;
      prospectType = formData.get('prospect_type') as string || 'COMPRADOR';
      notes = formData.get('notes') as string || null;
      markVisited = formData.get('mark_visited') !== 'false';
      idempotencyKey = (formData.get('idempotency_key') as string) || null;

      // Parse extra contacts JSON
      const extraContactsStr = formData.get('extra_contacts') as string || '';
      if (extraContactsStr) {
        try { extraContacts = JSON.parse(extraContactsStr); } catch { extraContacts = []; }
      }

      // Upload facade photo
      const facadeFile = formData.get('photo_facade') as File | null;
      if (facadeFile && facadeFile.size > 0) {
        photoFacadeUrl = await uploadFile(admin, facadeFile, profile.organization_id, eventId, 'facade');
      }

      // Upload contact photo
      const contactFile = formData.get('photo_contact') as File | null;
      if (contactFile && contactFile.size > 0) {
        photoContactUrl = await uploadFile(admin, contactFile, profile.organization_id, eventId, 'contact');
      }

      // Upload extra photos
      for (let i = 0; ; i++) {
        const file = formData.get(`photo_extra_${i}`) as File | null;
        if (!file || file.size === 0) break;
        const url = await uploadFile(admin, file, profile.organization_id, eventId, `extra${i}`);
        if (url) extraPhotosUrls.push(url);
      }
    } else {
      const body = await request.json();
      boothId = body.booth_id;
      contactName = body.contact_name || null;
      contactRole = body.contact_role || null;
      contactPhone = body.contact_phone || null;
      contactEmail = body.contact_email || null;
      prospectType = body.prospect_type || 'COMPRADOR';
      notes = body.notes || null;
      photoFacadeUrl = body.photo_facade_url || null;
      photoContactUrl = body.photo_contact_url || null;
      autoCreate = !!body.auto_create;
      markVisited = body.mark_visited !== false;
      extraContacts = body.extra_contacts || [];
      idempotencyKey = body.idempotency_key || null;
    }

    if (!boothId) {
      return NextResponse.json({ error: 'booth_id é obrigatório' }, { status: 400 });
    }

    // Verify booth belongs to this event and org
    const { data: booth } = await admin
      .from('event_booths')
      .select('id, event_id, company_name')
      .eq('id', boothId)
      .eq('event_id', eventId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!booth) {
      return NextResponse.json({ error: 'Stand não encontrado' }, { status: 404 });
    }

    // Bloqueio: so aceita check-in se a feira estiver ATIVA. Admin ativa/encerra
    // na lista de feiras (/eventos). Regra pedida pelo dono pra evitar capturas
    // fora do intervalo oficial da feira.
    const { data: eventStatusRow } = await admin
      .from('events')
      .select('status')
      .eq('id', eventId)
      .single();

    if (!eventStatusRow || eventStatusRow.status !== 'ATIVO') {
      return NextResponse.json(
        {
          error: 'Esta feira não está ativa. Peça ao admin para ativá-la antes de registrar visitas.',
          event_status: eventStatusRow?.status || null,
        },
        { status: 403 }
      );
    }

    // Auto-create: just create/link a contact without creating a visit or marking as visited
    if (autoCreate) {
      const { data: event } = await admin
        .from('events')
        .select('pipeline_id, stage_id')
        .eq('id', eventId)
        .single();

      const { data: existingVisit } = await admin
        .from('booth_visits')
        .select('contact_id')
        .eq('booth_id', boothId)
        .eq('event_id', eventId)
        .not('contact_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (existingVisit?.contact_id) {
        const { data: existingContact } = await admin
          .from('contacts')
          .select('*')
          .eq('id', existingVisit.contact_id)
          .single();
        return NextResponse.json({ contact: existingContact }, { status: 200 });
      }

      if (event?.pipeline_id) {
        const { data: newContact } = await admin
          .from('contacts')
          .insert({
            organization_id: profile.organization_id,
            name: booth.company_name,
            company: booth.company_name,
            pipeline_id: event.pipeline_id,
            stage_id: event.stage_id,
            origem: 'FEIRA',
            event_id: eventId,
            tipo: ['COMPRADOR'],
            status: 'NOVO',
            created_by_user_id: user.id,
            name_normalized: booth.company_name.toLowerCase().trim(),
          })
          .select()
          .single();

        return NextResponse.json({ contact: newContact }, { status: 201 });
      }

      return NextResponse.json({ contact: null, message: 'Evento sem pipeline configurado' }, { status: 200 });
    }

    // Pack metadata (extra photos + extra contacts) into notes
    const hasMeta = extraPhotosUrls.length > 0 || extraContacts.length > 0;
    const userNotes = notes || '';
    const packedNotes = hasMeta
      ? `${userNotes}\n<!--EXTRA:${JSON.stringify({ photos: extraPhotosUrls, contacts: extraContacts })}-->`.trim()
      : userNotes || null;

    // Create the visit record
    // ============================================
    // TRAVA DE DUPLICACAO em 2 camadas:
    // 1. idempotency_key (UUID gerado pelo cliente) — proteção forte:
    //    se enviar a mesma key 2x, retorna a visita existente. Cobre
    //    click-spam, retry de rede, sync offline duplo.
    // 2. Fallback temporal de 60s (caso cliente antigo nao envie key)
    // ============================================
    let visit: any = null;

    if (idempotencyKey) {
      const { data: existingByKey } = await admin
        .from('booth_visits')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (existingByKey) {
        console.log('[check-in] idempotency_key match — retornando visit existente', existingByKey.id);
        visit = existingByKey;
      }
    }

    if (!visit) {
      // Fallback: 1 visita por user+booth+DIA (timezone Sao Paulo).
      // Antes era 60s, mas vendedor pode reabrir o stand horas depois e
      // duplicar — agora consolida na MESMA visita do dia.
      const todayStartSP = new Date();
      todayStartSP.setHours(0, 0, 0, 0); // local server, ajuste pra TZ correto via SQL no UNIQUE INDEX
      const startISO = new Date(todayStartSP.getTime() - 12 * 3600_000).toISOString(); // -12h margem TZ
      const { data: todayVisit } = await admin
        .from('booth_visits')
        .select('*')
        .eq('booth_id', boothId)
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .gte('created_at', startISO)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (todayVisit) {
        console.log('[check-in] Visita do mesmo user/stand HOJE ja existe, atualizando', todayVisit.id);
        const { data: updated } = await admin
          .from('booth_visits')
          .update({
            photo_facade_url: photoFacadeUrl || todayVisit.photo_facade_url,
            photo_contact_url: photoContactUrl || todayVisit.photo_contact_url,
            contact_name: contactName || todayVisit.contact_name,
            contact_role: contactRole || todayVisit.contact_role,
            prospect_type: prospectType,
            notes: packedNotes || todayVisit.notes,
            // Marca a key dessa requisicao se ainda nao tinha
            idempotency_key: todayVisit.idempotency_key || idempotencyKey,
          })
          .eq('id', todayVisit.id)
          .select()
          .single();
        visit = updated || todayVisit;
      }
    }

    if (!visit) {
      const { data: newVisit, error: visitError } = await admin
        .from('booth_visits')
        .insert({
          booth_id: boothId,
          event_id: eventId,
          organization_id: profile.organization_id,
          user_id: user.id,
          user_name: profile.name,
          photo_facade_url: photoFacadeUrl,
          photo_contact_url: photoContactUrl,
          contact_name: contactName,
          contact_role: contactRole,
          prospect_type: prospectType,
          notes: packedNotes,
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();
      if (visitError) {
        // Se UNIQUE INDEX rejeitou, e porque outra requisicao em paralelo
        // criou com a mesma key. Buscar e retornar essa.
        if (idempotencyKey && visitError.code === '23505') {
          const { data: race } = await admin
            .from('booth_visits')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle();
          if (race) {
            console.log('[check-in] Race condition resolvida via UNIQUE INDEX', race.id);
            visit = race;
          }
        }
        if (!visit) throw visitError;
      } else {
        visit = newVisit;
      }
    }

    // Mark booth as visited only if requested
    if (markVisited) {
      await admin
        .from('event_booths')
        .update({ status: 'VISITADO' })
        .eq('id', boothId);
    }

    // If event has pipeline, create or link contact
    let createdContact = null;
    const { data: event } = await admin
      .from('events')
      .select('pipeline_id, stage_id')
      .eq('id', eventId)
      .single();

    if (event?.pipeline_id) {
      const { data: existingVisit } = await admin
        .from('booth_visits')
        .select('contact_id')
        .eq('booth_id', boothId)
        .eq('event_id', eventId)
        .not('contact_id', 'is', null)
        .limit(1)
        .maybeSingle();

      const isFirstSave = !existingVisit?.contact_id;

      const phoneNorm = normalizePhone(contactPhone);
      const emailNorm = normalizeEmail(contactEmail);

      if (existingVisit?.contact_id) {
        createdContact = { id: existingVisit.contact_id };
        await admin
          .from('booth_visits')
          .update({ contact_id: existingVisit.contact_id })
          .eq('id', visit.id);
        // Se temos phone/email escaneados e o contato existente não tem, atualiza
        if (contactPhone || contactEmail) {
          const { data: existingContactRow } = await admin
            .from('contacts')
            .select('phone, email')
            .eq('id', existingVisit.contact_id)
            .single();
          const patch: any = {};
          if (contactPhone && !existingContactRow?.phone) {
            patch.phone = contactPhone;
            if (phoneNorm) patch.phone_normalized = phoneNorm;
          }
          if (contactEmail && !existingContactRow?.email) {
            patch.email = contactEmail;
            if (emailNorm) patch.email_normalized = emailNorm;
          }
          if (Object.keys(patch).length > 0) {
            await admin.from('contacts').update(patch).eq('id', existingVisit.contact_id);
          }
        }
      } else if (contactName) {
        // Avatar: photo_contact_url (foto do cartao) e o melhor que temos aqui
        // porque check-in de stand nao tira foto da pessoa, so do cartao.
        const avatarUrl = photoContactUrl || null;
        // Padrao do CRM: name = empresa (do stand), contato_nome = pessoa.
        // Antes salvava contato como pessoa solta (sem destaque pra empresa).
        const empresaName = booth.company_name || contactName;
        const insertPayload: any = {
          organization_id: profile.organization_id,
          name: empresaName,
          contato_nome: contactName,
          company: booth.company_name,
          cargo: contactRole,
          pipeline_id: event.pipeline_id,
          stage_id: event.stage_id,
          origem: 'FEIRA',
          event_id: eventId,
          tipo: prospectType === 'AMBOS' ? ['COMPRADOR', 'FORNECEDOR'] : [prospectType],
          notes: userNotes ? `[Feira] ${userNotes}` : null,
          status: 'NOVO',
          created_by_user_id: user.id,
          name_normalized: empresaName.toLowerCase().trim(),
          avatar_url: avatarUrl,
        };
        if (contactPhone) {
          insertPayload.phone = contactPhone;
          if (phoneNorm) insertPayload.phone_normalized = phoneNorm;
        }
        if (contactEmail) {
          insertPayload.email = contactEmail;
          if (emailNorm) insertPayload.email_normalized = emailNorm;
        }
        const { data: newContact } = await admin
          .from('contacts')
          .insert(insertPayload)
          .select()
          .single();

        if (newContact) {
          createdContact = newContact;
          await admin
            .from('booth_visits')
            .update({ contact_id: newContact.id })
            .eq('id', visit.id);
        }
      }

      // Create extra contacts in the pipeline too — only on the first save to avoid duplicates
      if (isFirstSave && extraContacts.length > 0) {
        const tipoArr = prospectType === 'AMBOS' ? ['COMPRADOR', 'FORNECEDOR'] : [prospectType];
        for (const extra of extraContacts) {
          const extraName = (extra.name || '').trim();
          if (!extraName) continue;
          const baseNotes = userNotes ? `[Feira] ${userNotes}` : '[Feira]';
          const empresaName = booth.company_name || extraName;
          const extraPhone = ((extra as any).phone || '').trim();
          const phoneN = extraPhone ? extraPhone.replace(/\D/g, '') : null;
          const extraPayload: any = {
            organization_id: profile.organization_id,
            name: empresaName,
            contato_nome: extraName,
            company: booth.company_name,
            cargo: extra.cargo || null,
            pipeline_id: event.pipeline_id,
            stage_id: event.stage_id,
            origem: 'FEIRA',
            event_id: eventId,
            tipo: tipoArr,
            notes: baseNotes,
            status: 'NOVO',
            created_by_user_id: user.id,
            name_normalized: empresaName.toLowerCase(),
          };
          if (extraPhone) {
            extraPayload.phone = extraPhone;
            if (phoneN) extraPayload.phone_normalized = phoneN;
          }
          await admin.from('contacts').insert(extraPayload);
        }
      }
    }

    return NextResponse.json({
      visit,
      contact: createdContact,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao fazer check-in' }, { status: 500 });
  }
}

// GET /api/events/[id]/check-in — list all visits for event (timeline)
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

    const { data: visits, error } = await admin
      .from('booth_visits')
      .select('*, event_booths(company_name, booth_number, sector)')
      .eq('event_id', id)
      .eq('organization_id', profile.organization_id)
      .order('visited_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ visits: visits || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
