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
    let associacao: string | null = null;
    // Se vier contact_id, significa que e a FINALIZACAO de um rascunho existente
    // (contato com is_draft=true criado la atras via POST /api/contacts/draft).
    let finalizeContactId: string | null = null;

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
      associacao = (formData.get('associacao') as string) || null;
      finalizeContactId = (formData.get('contact_id') as string) || null;

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
      associacao = body.associacao || null;
      finalizeContactId = body.contact_id || null;
    }

    if (!contactName || contactName.trim().length < 2) {
      return NextResponse.json({ error: 'Nome e obrigatorio (min 2 caracteres)' }, { status: 400 });
    }

    // Verifica se o evento existe e pertence a org
    step = 'fetchEvent';
    const { data: event } = await admin
      .from('events')
      .select('id, pipeline_id, stage_id, status')
      .eq('id', eventId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Evento nao encontrado' }, { status: 404 });
    }

    // Bloqueio: so aceita contato avulso se a feira estiver ATIVA. Mesma regra
    // do check-in de stand — admin controla a janela de captura.
    if (event.status !== 'ATIVO') {
      return NextResponse.json(
        {
          error: 'Esta feira nao esta ativa. Peca ao admin para ativa-la antes de registrar contatos.',
          event_status: event.status,
        },
        { status: 403 }
      );
    }

    if (!event.pipeline_id) {
      return NextResponse.json({
        error: 'Evento precisa ter um pipeline configurado',
      }, { status: 400 });
    }

    // Se veio contact_id, valida que e um draft desta org / deste evento.
    // Usado na finalizacao: o form criou um rascunho la atras via POST
    // /api/contacts/draft e agora o usuario clicou "Finalizar cadastro".
    if (finalizeContactId) {
      const { data: draftContact } = await admin
        .from('contacts')
        .select('id, is_draft, organization_id, event_id')
        .eq('id', finalizeContactId)
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      if (!draftContact) {
        return NextResponse.json({ error: 'Rascunho nao encontrado' }, { status: 404 });
      }
      if (!draftContact.is_draft) {
        return NextResponse.json(
          { error: 'Contato ja foi finalizado, nao pode re-finalizar' },
          { status: 409 }
        );
      }
    }

    // Normaliza para dedup
    step = 'normalize';
    const phoneNorm = normalizePhone(contactPhone);
    const emailNorm = normalizeEmail(contactEmail);

    // Tenta encontrar duplicata na mesma org por phone OU email normalizado.
    // Importante: ignora rascunhos (is_draft=true) no dedup — dois rascunhos
    // preenchendo o mesmo telefone nao sao "duplicata", sao 2 in-progress.
    // Tambem ignora o proprio finalizeContactId (self-match).
    let createdContact: any = null;
    if (phoneNorm || emailNorm) {
      step = 'dedupQuery';
      let dup: any = null;
      if (phoneNorm) {
        const { data, error: dupErr } = await admin
          .from('contacts')
          .select('id, phone, email, event_id, name')
          .eq('organization_id', profile.organization_id)
          .eq('phone_normalized', phoneNorm)
          .eq('is_draft', false)
          .limit(1)
          .maybeSingle();
        if (dupErr) console.error('[walk-in] dedup by phone error:', dupErr);
        if (data && data.id !== finalizeContactId) dup = data;
      }
      if (!dup && emailNorm) {
        const { data, error: dupErr } = await admin
          .from('contacts')
          .select('id, phone, email, event_id, name')
          .eq('organization_id', profile.organization_id)
          .eq('email_normalized', emailNorm)
          .eq('is_draft', false)
          .limit(1)
          .maybeSingle();
        if (dupErr) console.error('[walk-in] dedup by email error:', dupErr);
        if (data && data.id !== finalizeContactId) dup = data;
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

        // Dedupe achou um contato ja existente. Se estavamos finalizando um
        // rascunho, o rascunho agora e obsoleto — deleta pra nao ficar lixo.
        // Filtra org_id pra que se o cliente passar UUID adulterado de outra
        // org, nao deletemos contato real alheio.
        if (finalizeContactId) {
          await admin
            .from('contacts')
            .delete()
            .eq('id', finalizeContactId)
            .eq('organization_id', profile.organization_id);
        }
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

    // Avatar do contato: prioriza foto da pessoa, fallback pra foto do cartao.
    // Gravado na coluna dedicada avatar_url (notes continua tendo as URLs
    // como texto pra retrocompatibilidade com code paths antigos).
    const avatarUrl = photoPersonUrl || photoContactUrl || null;

    // Se nao achou duplicata, cria contato novo OU finaliza o rascunho existente.
    if (!createdContact) {
      step = 'insertOrFinalizeContact';
      const payload: any = {
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
        name_normalized: contactName.trim().toLowerCase(),
        temperatura: 'QUENTE',
        avatar_url: avatarUrl,
        associacao: associacao?.trim() || null,
      };
      if (contactPhone) {
        payload.phone = contactPhone;
        payload.whatsapp = contactPhone;
        if (phoneNorm) payload.phone_normalized = phoneNorm;
      }
      if (contactEmail) {
        payload.email = contactEmail;
        if (emailNorm) payload.email_normalized = emailNorm;
      }

      if (finalizeContactId) {
        // Finalizacao: atualiza o rascunho, marca is_draft=false.
        payload.is_draft = false;
        const { data: updated, error: updateErr } = await admin
          .from('contacts')
          .update(payload)
          .eq('id', finalizeContactId)
          .select('id, name')
          .single();
        if (updateErr) throw updateErr;
        createdContact = updated;
      } else {
        // Fluxo classico: cria contato novo.
        payload.organization_id = profile.organization_id;
        payload.created_by_user_id = user.id;
        payload.assigned_to_user_id = user.id;
        const { data: newContact, error: insertErr } = await admin
          .from('contacts')
          .insert(payload)
          .select('id, name')
          .single();
        if (insertErr) throw insertErr;
        createdContact = newContact;
      }
    } else if (photoContactUrl || photoPersonUrl) {
      // Duplicata: append fotos novas nas notes existentes se ainda nao tem.
      // E, se o contato nao tinha avatar_url, grava agora.
      const { data: existing } = await admin
        .from('contacts')
        .select('notes, avatar_url')
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
      if (!existing?.avatar_url && avatarUrl) {
        await admin
          .from('contacts')
          .update({ avatar_url: avatarUrl })
          .eq('id', createdContact.id);
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
