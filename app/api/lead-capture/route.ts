import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone, normalizeEmail } from '@/lib/utils/normalize';
import { processStageChangeAutomations } from '@/lib/automations/engine';

// GET /api/lead-capture?token=xxx - Info publica do link (sem auth)
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token obrigatorio' }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: link, error } = await admin
      .from('lead_capture_links')
      .select('id, token, label, is_active, pipeline_id, user_id, whatsapp_vendedor')
      .eq('token', token)
      .single();

    if (error || !link) {
      return NextResponse.json({ error: 'Link nao encontrado' }, { status: 404 });
    }

    if (!link.is_active) {
      return NextResponse.json({ error: 'Link inativo', inactive: true }, { status: 410 });
    }

    // Buscar nome e avatar do vendedor
    const { data: profile } = await admin
      .from('profiles')
      .select('name, avatar_url')
      .eq('user_id', link.user_id)
      .single();

    // Buscar nome do pipeline
    const { data: pipeline } = await admin
      .from('pipelines')
      .select('name')
      .eq('id', link.pipeline_id)
      .single();

    // Se event/booth params presentes, buscar info do stand
    const eventId = request.nextUrl.searchParams.get('event');
    const boothId = request.nextUrl.searchParams.get('booth');
    let booth: { company_name: string; booth_number: string | null } | null = null;

    if (eventId && boothId) {
      const { data: boothData } = await admin
        .from('event_booths')
        .select('company_name, booth_number')
        .eq('id', boothId)
        .eq('event_id', eventId)
        .single();

      if (boothData) {
        booth = { company_name: boothData.company_name, booth_number: boothData.booth_number };
      }
    }

    return NextResponse.json({
      label: link.label,
      user_name: profile?.name || 'Vendedor',
      user_avatar: profile?.avatar_url || null,
      pipeline_name: pipeline?.name || 'Pipeline',
      whatsapp_vendedor: link.whatsapp_vendedor || null,
      booth,
    });
  } catch (error: any) {
    console.error('Error fetching lead capture info:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST /api/lead-capture - Criar lead via formulario publico (sem auth)
export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const body = await request.json();

    const { token, name, phone, email, company, cargo, notes, cidade, estado, event_id, booth_id } = body;

    // Validacoes basicas
    if (!token) {
      return NextResponse.json({ error: 'Token obrigatorio' }, { status: 400 });
    }
    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Nome e obrigatorio (min 2 caracteres)' }, { status: 400 });
    }
    if (!phone || phone.trim().length < 8) {
      return NextResponse.json({ error: 'Telefone/WhatsApp e obrigatorio' }, { status: 400 });
    }

    // Buscar link
    const { data: link, error: linkError } = await admin
      .from('lead_capture_links')
      .select('*')
      .eq('token', token)
      .single();

    if (linkError || !link) {
      return NextResponse.json({ error: 'Link nao encontrado' }, { status: 404 });
    }

    if (!link.is_active) {
      return NextResponse.json({ error: 'Este link foi desativado' }, { status: 410 });
    }

    // Normalizar para deduplicacao
    const phoneNormalized = normalizePhone(phone);
    const emailNormalized = normalizeEmail(email);

    // --- Fluxo com contexto de evento/stand ---
    if (event_id && booth_id) {
      // Buscar contato existente vinculado a este booth
      const { data: existingVisit } = await admin
        .from('booth_visits')
        .select('contact_id')
        .eq('booth_id', booth_id)
        .eq('event_id', event_id)
        .not('contact_id', 'is', null)
        .limit(1)
        .maybeSingle();

      // Buscar info do booth
      const { data: booth } = await admin
        .from('event_booths')
        .select('company_name, booth_number, organization_id')
        .eq('id', booth_id)
        .eq('event_id', event_id)
        .single();

      if (existingVisit?.contact_id) {
        // UPDATE contato existente (NAO sobrescreve name nem company)
        const updates: Record<string, any> = {
          contato_nome: name.trim(),
          phone: phone.trim(),
          phone_normalized: phoneNormalized,
          whatsapp: phone.trim(),
        };
        if (email?.trim()) {
          updates.email = email.trim();
          updates.email_normalized = emailNormalized;
        }
        if (cargo?.trim()) updates.cargo = cargo.trim();
        if (cidade?.trim()) updates.cidade = cidade.trim();
        if (estado?.trim()) updates.estado = estado.trim();
        if (notes?.trim()) updates.notes = notes.trim();

        await admin
          .from('contacts')
          .update(updates)
          .eq('id', existingVisit.contact_id);

        // Criar booth_visit de registro
        await admin
          .from('booth_visits')
          .insert({
            booth_id,
            event_id,
            organization_id: link.organization_id,
            user_id: link.user_id,
            contact_id: existingVisit.contact_id,
            contact_name: name.trim(),
            notes: notes?.trim() || null,
          });

        // Marcar booth como VISITADO
        await admin
          .from('event_booths')
          .update({ status: 'VISITADO' })
          .eq('id', booth_id);

        // Incrementar leads_count
        await admin
          .from('lead_capture_links')
          .update({
            leads_count: (link.leads_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', link.id);

        return NextResponse.json({
          success: true,
          updated: true,
          message: 'Dados registrados com sucesso! Entraremos em contato em breve.',
          whatsapp_vendedor: link.whatsapp_vendedor || null,
        }, { status: 200 });
      }

      // NAO encontrou contato existente pelo booth.
      // Antes de criar novo, checar se ja existe contato na org com mesmo phone/email.
      // Isso evita violar idx_contacts_unique_phone / idx_contacts_unique_email.
      console.log('[lead-capture] Buscando duplicates por phone/email', { phoneNormalized, emailNormalized, org: link.organization_id });
      let duplicateContact: { id: string } | null = null;
      if (phoneNormalized) {
        const { data } = await admin
          .from('contacts')
          .select('id')
          .eq('organization_id', link.organization_id)
          .eq('phone_normalized', phoneNormalized)
          .limit(1)
          .maybeSingle();
        if (data) duplicateContact = data;
      }
      if (!duplicateContact && emailNormalized) {
        const { data } = await admin
          .from('contacts')
          .select('id')
          .eq('organization_id', link.organization_id)
          .eq('email_normalized', emailNormalized)
          .limit(1)
          .maybeSingle();
        if (data) duplicateContact = data;
      }

      if (duplicateContact?.id) {
        console.log('[lead-capture] Contato ja existe na org — vinculando ao booth', duplicateContact.id);
        // Atualiza campos chave + vincula ao evento
        const updates: Record<string, any> = {
          contato_nome: name.trim(),
          whatsapp: phone.trim(),
        };
        if (cargo?.trim()) updates.cargo = cargo.trim();
        if (cidade?.trim()) updates.cidade = cidade.trim();
        if (estado?.trim()) updates.estado = estado.trim();
        if (notes?.trim()) updates.notes = notes.trim();
        if (event_id) updates.event_id = event_id;

        await admin.from('contacts').update(updates).eq('id', duplicateContact.id);

        await admin.from('booth_visits').insert({
          booth_id,
          event_id,
          organization_id: link.organization_id,
          user_id: link.user_id,
          contact_id: duplicateContact.id,
          contact_name: name.trim(),
          notes: notes?.trim() || null,
        });

        await admin.from('event_booths').update({ status: 'VISITADO' }).eq('id', booth_id);

        await admin.from('lead_capture_links').update({
          leads_count: (link.leads_count || 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', link.id);

        return NextResponse.json({
          success: true,
          duplicate: true,
          message: 'Dados registrados com sucesso! Entraremos em contato em breve.',
          whatsapp_vendedor: link.whatsapp_vendedor || null,
        }, { status: 200 });
      }

      const { data: firstStage } = await admin
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', link.pipeline_id)
        .order('position', { ascending: true })
        .limit(1)
        .single();

      if (!firstStage) {
        return NextResponse.json({ error: 'Pipeline sem stages configurados' }, { status: 500 });
      }

      // Valida user_id do link (FK created_by_user_id exige user existente)
      if (!link.user_id) {
        return NextResponse.json({ error: 'Link sem dono configurado' }, { status: 500 });
      }

      console.log('[lead-capture] Criando novo contato', { name: name.trim(), phoneNormalized, event_id, booth_id });
      const boothCompany = booth?.company_name || company?.trim() || null;

      const newContactData: Record<string, any> = {
        organization_id: link.organization_id,
        name: boothCompany || name.trim(),
        contato_nome: name.trim(),
        phone: phone.trim(),
        phone_normalized: phoneNormalized,
        email: email?.trim() || null,
        email_normalized: emailNormalized,
        name_normalized: (boothCompany || name.trim()).toLowerCase(),
        company: boothCompany,
        cargo: cargo?.trim() || null,
        notes: notes?.trim() || null,
        whatsapp: phone.trim(),
        cidade: cidade?.trim() || null,
        estado: estado?.trim() || null,
        tipo: [],
        pipeline_id: link.pipeline_id,
        stage_id: firstStage.id,
        event_id: event_id,
        assigned_to_user_id: link.user_id,
        created_by_user_id: link.user_id,
      };

      const optFields: Record<string, any> = {
        origem: 'FEIRA',
        temperatura: 'QUENTE',
        sem_documento: true,
      };

      let { data: newContact, error: insertErr } = await admin
        .from('contacts')
        .insert({ ...newContactData, ...optFields })
        .select('id')
        .single();

      if (insertErr) {
        const { data: retryContact, error: retryErr } = await admin
          .from('contacts')
          .insert(newContactData)
          .select('id')
          .single();
        if (retryErr) throw retryErr;
        newContact = retryContact;
      }

      if (newContact) {
        // Criar booth_visit vinculando
        await admin
          .from('booth_visits')
          .insert({
            booth_id,
            event_id,
            organization_id: link.organization_id,
            user_id: link.user_id,
            contact_id: newContact.id,
            contact_name: name.trim(),
            notes: notes?.trim() || null,
          });

        // Marcar booth como VISITADO
        await admin
          .from('event_booths')
          .update({ status: 'VISITADO' })
          .eq('id', booth_id);

        // Dispara automações do stage inicial (tratamos como entrada de null → firstStage).
        // Se falhar, não quebra o fluxo — lead já está salvo.
        try {
          await processStageChangeAutomations(
            admin,
            link.organization_id,
            newContact.id,
            null,
            firstStage.id,
          );
        } catch (e) {
          console.error('Error running automations for new lead (event flow):', e);
        }
      }

      // Incrementar leads_count
      await admin
        .from('lead_capture_links')
        .update({
          leads_count: (link.leads_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', link.id);

      return NextResponse.json({
        success: true,
        message: 'Dados registrados com sucesso! Entraremos em contato em breve.',
        whatsapp_vendedor: link.whatsapp_vendedor || null,
      }, { status: 201 });
    }

    // --- Fluxo original (sem contexto de evento) ---

    // Buscar primeiro stage do pipeline
    const { data: firstStage } = await admin
      .from('pipeline_stages')
      .select('id')
      .eq('pipeline_id', link.pipeline_id)
      .order('position', { ascending: true })
      .limit(1)
      .single();

    if (!firstStage) {
      return NextResponse.json({ error: 'Pipeline sem stages configurados' }, { status: 500 });
    }

    // Verificar duplicado (mesmo phone ou email na mesma org)
    const dupChecks = [];
    if (phoneNormalized) {
      dupChecks.push(
        admin
          .from('contacts')
          .select('id, name')
          .eq('organization_id', link.organization_id)
          .eq('phone_normalized', phoneNormalized)
          .limit(1)
          .maybeSingle()
      );
    }
    if (emailNormalized) {
      dupChecks.push(
        admin
          .from('contacts')
          .select('id, name')
          .eq('organization_id', link.organization_id)
          .eq('email_normalized', emailNormalized)
          .limit(1)
          .maybeSingle()
      );
    }

    const dupResults = await Promise.all(dupChecks);
    const duplicate = dupResults.find(r => r.data && !r.error);

    if (duplicate?.data) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: 'Seus dados ja estao registrados! Entraremos em contato em breve.',
      });
    }

    // Criar contato — tenta com todos os campos, fallback sem campos opcionais
    const baseContactData: Record<string, any> = {
      organization_id: link.organization_id,
      name: name.trim(),
      phone: phone.trim(),
      phone_normalized: phoneNormalized,
      email: email?.trim() || null,
      email_normalized: emailNormalized,
      name_normalized: name.trim().toLowerCase(),
      company: company?.trim() || null,
      cargo: cargo?.trim() || null,
      notes: notes?.trim() || null,
      whatsapp: phone.trim(),
      cidade: cidade?.trim() || null,
      estado: estado?.trim() || null,
      tipo: [],
      pipeline_id: link.pipeline_id,
      stage_id: firstStage.id,
      assigned_to_user_id: link.user_id,
      created_by_user_id: link.user_id,
    };

    // Campos que podem nao existir na tabela
    const optionalFields: Record<string, any> = {
      origem: 'QRCODE',
      temperatura: 'QUENTE',
      sem_documento: true,
    };

    // Tenta com todos os campos primeiro
    let { data: createdContact, error: insertError } = await admin
      .from('contacts')
      .insert({ ...baseContactData, ...optionalFields })
      .select('id')
      .single();

    // Se falhou (coluna inexistente), tenta sem os opcionais
    if (insertError) {
      console.warn('Insert with optional fields failed, retrying without:', insertError.message);
      const { data: retryContact, error: retryError } = await admin
        .from('contacts')
        .insert(baseContactData)
        .select('id')
        .single();

      if (retryError) {
        console.error('Error creating lead via QR:', retryError);
        throw retryError;
      }
      createdContact = retryContact;
    }

    // Dispara automações do stage inicial. Se falhar, não quebra o fluxo.
    if (createdContact?.id) {
      try {
        await processStageChangeAutomations(
          admin,
          link.organization_id,
          createdContact.id,
          null,
          firstStage.id,
        );
      } catch (e) {
        console.error('Error running automations for new lead (plain flow):', e);
      }
    }

    // Incrementar leads_count
    await admin
      .from('lead_capture_links')
      .update({
        leads_count: (link.leads_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', link.id);

    return NextResponse.json({
      success: true,
      message: 'Dados registrados com sucesso! Entraremos em contato em breve.',
      whatsapp_vendedor: link.whatsapp_vendedor || null,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating lead capture:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      stack: error?.stack?.split('\n').slice(0, 3).join(' | '),
    });
    // Retorna detalhe do erro pro cliente (sistema interno, sem vazar info sensivel)
    const dbMsg = error?.message || 'Erro desconhecido';
    return NextResponse.json({
      error: `Erro ao registrar: ${dbMsg}`,
      debug_code: error?.code || null,
      debug_hint: error?.hint || null,
    }, { status: 500 });
  }
}

// PATCH /api/lead-capture - Complementar dados do lead (step 2)
export async function PATCH(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const body = await request.json();

    const { token, phone, email, company, cargo, notes } = body;

    if (!token || !phone) {
      return NextResponse.json({ error: 'Token e telefone sao obrigatorios' }, { status: 400 });
    }

    // Buscar link para pegar organization_id
    const { data: link, error: linkError } = await admin
      .from('lead_capture_links')
      .select('organization_id')
      .eq('token', token)
      .single();

    if (linkError || !link) {
      return NextResponse.json({ error: 'Link nao encontrado' }, { status: 404 });
    }

    // Buscar contato pelo telefone normalizado na mesma org
    const phoneNormalized = normalizePhone(phone);
    const { data: contact, error: contactError } = await admin
      .from('contacts')
      .select('id')
      .eq('organization_id', link.organization_id)
      .eq('phone_normalized', phoneNormalized)
      .limit(1)
      .maybeSingle();

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contato nao encontrado' }, { status: 404 });
    }

    // Montar update apenas com campos preenchidos
    const updates: Record<string, unknown> = {};
    if (email?.trim()) {
      updates.email = email.trim();
      updates.email_normalized = normalizeEmail(email);
    }
    if (company?.trim()) updates.company = company.trim();
    if (cargo?.trim()) updates.cargo = cargo.trim();
    if (notes?.trim()) updates.notes = notes.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum dado para atualizar.' });
    }

    const { error: updateError } = await admin
      .from('contacts')
      .update(updates)
      .eq('id', contact.id);

    if (updateError) {
      console.error('Error updating lead via PATCH:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'Dados complementados com sucesso!',
    });
  } catch (error: any) {
    console.error('Error patching lead capture:', error);
    return NextResponse.json({ error: 'Erro ao atualizar dados.' }, { status: 500 });
  }
}
