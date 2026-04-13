import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { normalizePhone, normalizeEmail } from '@/lib/utils/normalize';

// Upload helper — identico ao check-in, so com label diferente.
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

// POST /api/events/[id]/walk-in
//
// Captura de contato AVULSO em feira — vendedor encontrou alguem no corredor,
// cafe, palestra, etc. (sem stand). Difere do /check-in porque:
//   - NAO cria booth_visit
//   - NAO marca nenhum booth como VISITADO
//   - NAO tem foto da fachada (avulso nao tem fachada)
//   - Tem apenas foto do cartao (opcional, recomendada)
//   - Empresa vem do form/OCR (nao tem booth pra puxar)
//
// Aceita multipart (com foto) ou JSON (sem foto, quando enfileirado offline).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let step = 'init';
  try {
    step = 'params';
    const { id: eventId } = await params;
    step = 'createClient';
    const supabase = await createClient();
    step = 'getUser';
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    step = 'ensureProfile';
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    step = 'adminClient';
    const admin = getAdminClient();
    const contentType = request.headers.get('content-type') || '';

    let contactName: string | null = null;
    let contactRole: string | null = null;
    let contactPhone: string | null = null;
    let contactEmail: string | null = null;
    let company: string | null = null;
    let prospectType: string = 'COMPRADOR';
    let notes: string | null = null;
    let photoContactUrl: string | null = null;
    let photoPersonUrl: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      step = 'parseFormData';
      const formData = await request.formData();
      contactName = (formData.get('contact_name') as string) || null;
      contactRole = (formData.get('contact_role') as string) || null;
      contactPhone = (formData.get('contact_phone') as string) || null;
      contactEmail = (formData.get('contact_email') as string) || null;
      company = (formData.get('company') as string) || null;
      prospectType = (formData.get('prospect_type') as string) || 'COMPRADOR';
      notes = (formData.get('notes') as string) || null;

      // Foto do cartao (photo_contact) + foto da pessoa (photo_person)
      step = 'uploadPhotoContact';
      const contactFile = formData.get('photo_contact') as File | null;
      if (contactFile && contactFile.size > 0) {
        photoContactUrl = await uploadFile(admin, contactFile, profile.organization_id, eventId, 'walkin-card');
      }
      step = 'uploadPhotoPerson';
      const personFile = formData.get('photo_person') as File | null;
      if (personFile && personFile.size > 0) {
        photoPersonUrl = await uploadFile(admin, personFile, profile.organization_id, eventId, 'walkin-person');
      }
    } else {
      step = 'parseJson';
      const body = await request.json();
      contactName = body.contact_name || null;
      contactRole = body.contact_role || null;
      contactPhone = body.contact_phone || null;
      contactEmail = body.contact_email || null;
      company = body.company || null;
      prospectType = body.prospect_type || 'COMPRADOR';
      notes = body.notes || null;
      photoContactUrl = body.photo_contact_url || null;
      photoPersonUrl = body.photo_person_url || null;
    }

    if (!contactName || contactName.trim().length < 2) {
      return NextResponse.json({ error: 'Nome e obrigatorio (min 2 caracteres)' }, { status: 400 });
    }

    // Verifica se o evento existe e pertence a org
    step = 'fetchEvent';
    const { data: event } = await admin
      .from('events')
      .select('id, pipeline_id, stage_id')
      .eq('id', eventId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Evento nao encontrado' }, { status: 404 });
    }

    if (!event.pipeline_id) {
      return NextResponse.json({
        error: 'Evento precisa ter um pipeline configurado',
      }, { status: 400 });
    }

    // Normaliza para dedup
    step = 'normalize';
    const phoneNorm = normalizePhone(contactPhone);
    const emailNorm = normalizeEmail(contactEmail);

    // Tenta encontrar duplicata na mesma org por phone OU email normalizado.
    // Busca os 2 em paralelo e pega o primeiro match. Antes, o codigo usava
    // if/else if (phone else email) — se o usuario preenchesse os 2 e existisse
    // outro contato com o mesmo email (mas telefone diferente), a busca por
    // phone falhava e o codigo tentava INSERT, explodindo na UNIQUE constraint
    // idx_contacts_unique_email (23505).
    let createdContact: any = null;
    if (phoneNorm || emailNorm) {
      step = 'dedupQuery';
      const queries: Promise<any>[] = [];
      if (phoneNorm) {
        queries.push(
          admin
            .from('contacts')
            .select('id, phone, email, event_id, name')
            .eq('organization_id', profile.organization_id)
            .eq('phone_normalized', phoneNorm)
            .limit(1)
            .maybeSingle()
        );
      }
      if (emailNorm) {
        queries.push(
          admin
            .from('contacts')
            .select('id, phone, email, event_id, name')
            .eq('organization_id', profile.organization_id)
            .eq('email_normalized', emailNorm)
            .limit(1)
            .maybeSingle()
        );
      }
      const results = await Promise.all(queries);
      const dup = results.find(r => r?.data?.id)?.data || null;
      const dupErr = results.find(r => r?.error)?.error || null;
      if (dupErr) {
        console.error('[walk-in] dedup query error:', dupErr);
        // Nao trava o fluxo — segue e cria contato novo.
      }
      if (dup?.id) {
        // Update: preserva nome/company originais, so completa o que tiver faltando
        const patch: any = {};
        if (contactPhone && !dup.phone) {
          patch.phone = contactPhone;
          if (phoneNorm) patch.phone_normalized = phoneNorm;
        }
        if (contactEmail && !dup.email) {
          patch.email = contactEmail;
          if (emailNorm) patch.email_normalized = emailNorm;
        }
        // Se o contato ainda nao tem evento, amarra neste
        if (!dup.event_id) patch.event_id = eventId;
        if (Object.keys(patch).length > 0) {
          await admin.from('contacts').update(patch).eq('id', dup.id);
        }
        createdContact = { id: dup.id, name: dup.name, duplicate: true };
      }
    }

    // Monta as notes. Fotos viram links no fim — o detalhe do contato
    // renderiza links clicaveis em notes.
    // Marker [Avulso] fica no inicio pra diferenciar de stand no relatorio
    // e export (busca por prefixo de notes).
    let packedNotes = notes?.trim()
      ? `[Avulso] ${notes.trim()}`
      : '[Avulso]';
    if (photoPersonUrl) {
      packedNotes += `\n\nFoto da pessoa: ${photoPersonUrl}`;
    }
    if (photoContactUrl) {
      packedNotes += `\n\nFoto do cartao: ${photoContactUrl}`;
    }

    // Se nao achou duplicata, cria contato novo.
    if (!createdContact) {
      step = 'insertContact';
      const insertPayload: any = {
        organization_id: profile.organization_id,
        name: contactName.trim(),
        company: company?.trim() || null,
        cargo: contactRole?.trim() || null,
        pipeline_id: event.pipeline_id,
        stage_id: event.stage_id,
        origem: 'FEIRA',
        event_id: eventId,
        tipo: prospectType === 'AMBOS' ? ['COMPRADOR', 'FORNECEDOR'] : [prospectType],
        notes: packedNotes,
        status: 'NOVO',
        created_by_user_id: user.id,
        assigned_to_user_id: user.id,
        name_normalized: contactName.trim().toLowerCase(),
        temperatura: 'QUENTE',
      };
      if (contactPhone) {
        insertPayload.phone = contactPhone;
        insertPayload.whatsapp = contactPhone;
        if (phoneNorm) insertPayload.phone_normalized = phoneNorm;
      }
      if (contactEmail) {
        insertPayload.email = contactEmail;
        if (emailNorm) insertPayload.email_normalized = emailNorm;
      }

      const { data: newContact, error: insertErr } = await admin
        .from('contacts')
        .insert(insertPayload)
        .select('id, name')
        .single();

      if (insertErr) throw insertErr;
      createdContact = newContact;
    } else if (photoContactUrl || photoPersonUrl) {
      // Duplicata: append fotos novas nas notes existentes se ainda nao tem
      const { data: existing } = await admin
        .from('contacts')
        .select('notes')
        .eq('id', createdContact.id)
        .single();
      const currentNotes = existing?.notes || '';
      let updated = currentNotes;
      if (photoPersonUrl && !currentNotes.includes(photoPersonUrl)) {
        updated += `\n\nFoto da pessoa (revisita): ${photoPersonUrl}`;
      }
      if (photoContactUrl && !currentNotes.includes(photoContactUrl)) {
        updated += `\n\nFoto do cartao (revisita): ${photoContactUrl}`;
      }
      if (updated !== currentNotes) {
        await admin
          .from('contacts')
          .update({ notes: updated.trim() })
          .eq('id', createdContact.id);
      }
    }

    return NextResponse.json({
      contact: createdContact,
      walk_in: true,
    }, { status: 201 });
  } catch (error: any) {
    console.error(`[walk-in] ERRO step=${step}:`, error);
    const detail = {
      error: error?.message || 'Erro ao registrar contato avulso',
      step,
      name: error?.name || null,
      code: error?.code || null,
      details: error?.details || null,
      hint: error?.hint || null,
      stack: error?.stack?.split('\n').slice(0, 8).join('\n') || null,
    };
    return NextResponse.json(detail, { status: 500 });
  }
}
