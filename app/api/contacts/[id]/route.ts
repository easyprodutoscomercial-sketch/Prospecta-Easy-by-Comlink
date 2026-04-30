import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { contactUpdateSchema } from '@/lib/utils/validation';
import { normalizeEmail, normalizePhone, normalizeCPF, normalizeCNPJ, normalizeName } from '@/lib/utils/normalize';
import { ensureProfile } from '@/lib/ensure-profile';
import { computeLeadScoreDetailed } from '@/lib/utils/lead-score';
import { processStageChangeAutomations } from '@/lib/automations/engine';

// GET /api/contacts/:id - Buscar contato
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();

    const { data: contact, error } = await admin
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !contact) {
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    // Buscar interações
    const { data: interactions } = await admin
      .from('interactions')
      .select('*')
      .eq('contact_id', id)
      .order('happened_at', { ascending: false });

    // Buscar anexos
    const { data: attachments } = await admin
      .from('contact_attachments')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false });

    // Add public URLs to attachments
    const attachmentsWithUrls = (attachments || []).map((att: any) => {
      const { data } = admin.storage.from('attachments').getPublicUrl(att.file_path);
      return { ...att, public_url: data.publicUrl };
    });

    // Buscar info do stand vinculado (se tiver event_id)
    // Mostra logo da marca, fotos da visita e dados do stand na ficha
    let standInfo: any = null;
    if (contact.event_id) {
      // Tenta achar booth_visit pelo contact_id (vinculo direto)
      const { data: visits } = await admin
        .from('booth_visits')
        .select('id, booth_id, event_id, user_name, contact_name, contact_role, prospect_type, photo_facade_url, photo_contact_url, notes, visited_at, created_at')
        .eq('contact_id', id)
        .order('created_at', { ascending: false });

      let primaryBoothId: string | null = visits?.[0]?.booth_id || null;

      // Fallback: se nao ha visit vinculada por contact_id, tenta achar booth pela company_name + event_id
      if (!primaryBoothId && contact.company) {
        const { data: matchBooth } = await admin
          .from('event_booths')
          .select('id')
          .eq('event_id', contact.event_id)
          .ilike('company_name', contact.company)
          .limit(1)
          .maybeSingle();
        if (matchBooth) primaryBoothId = matchBooth.id;
      }

      if (primaryBoothId) {
        const { data: booth } = await admin
          .from('event_booths')
          .select('id, company_name, booth_number, sector, logo_url, website, status')
          .eq('id', primaryBoothId)
          .single();

        const { data: event } = await admin
          .from('events')
          .select('id, name, status, start_date, end_date')
          .eq('id', contact.event_id)
          .single();

        standInfo = {
          event,
          booth,
          visits: visits || [],
        };
      }
    }

    return NextResponse.json({
      contact,
      interactions: interactions || [],
      attachments: attachmentsWithUrls,
      stand: standInfo,
    });

  } catch (error: any) {
    console.error('Error fetching contact:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar contato' },
      { status: 500 }
    );
  }
}

// PATCH /api/contacts/:id - Atualizar contato (todos os campos)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const body = await request.json();

    // Guarda explicito: rejeita campos sensiveis no body. Zod ja stripia
    // (default strip), e dbFields filtra de novo, mas defesa em camadas e
    // explicita nesse caso pra ficar OBVIO se alguem tentar.
    const FORBIDDEN_FIELDS = ['created_by_user_id', 'organization_id', 'id', 'created_at', 'updated_at'];
    for (const f of FORBIDDEN_FIELDS) {
      if (f in body) {
        return NextResponse.json(
          { error: `Campo '${f}' nao pode ser alterado via PATCH` },
          { status: 400 }
        );
      }
    }

    // Limpar strings vazias → null (formulario envia "" para campos opcionais)
    const cleanedBody = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [
        key,
        value === '' ? null : value,
      ])
    );

    const validated = contactUpdateSchema.parse(cleanedBody);

    // Ownership enforcement: buscar contato atual
    const { data: existingContact } = await admin
      .from('contacts')
      .select('assigned_to_user_id, stage_id, organization_id, is_draft, event_id, inexistente')
      .eq('id', id)
      .single();

    if (!existingContact) {
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    // "Apontar para mim": se contato não tem dono e estou me atribuindo
    const isClaiming = validated.assigned_to_user_id === user.id && !existingContact.assigned_to_user_id;

    // Qualquer usuario autenticado pode editar contatos

    // Converter proxima_acao_data para ISO se presente
    if (validated.proxima_acao_data) {
      validated.proxima_acao_data = new Date(validated.proxima_acao_data).toISOString();
    }

    // All known contact columns.
    //
    // ATENCAO: NUNCA adicionar `created_by_user_id` aqui. Coluna e historico
    // de quem capturou o lead (usado em ranking, audit, atribuicao retroativa).
    // PATCH publico nao deve permitir mudar isso. Quiz publico grava NULL,
    // mas isso e setado no INSERT — nao via PATCH.
    //
    // Tambem NAO incluir `organization_id` (isolamento multi-tenant) nem
    // `id`/`created_at`/`updated_at` (gerados pelo banco).
    const dbFields = new Set([
      'name', 'phone', 'email', 'cpf', 'cnpj', 'company', 'notes', 'status',
      'tipo', 'referencia', 'classe', 'produtos_fornecidos',
      'contato_nome', 'cargo', 'endereco', 'cidade', 'estado', 'cep',
      'website', 'instagram', 'whatsapp',
      'assigned_to_user_id',
      'pipeline_id', 'stage_id',
      'inexistente',
      'telefones_adicionais',
      'temperatura', 'segmento', 'origem', 'proxima_acao_tipo', 'proxima_acao_data',
      'motivo_ganho_perdido', 'valor_estimado',
      'associacao',
    ]);

    // Se stage_id foi enviado, sincronizar o campo status com o slug do stage
    // Apenas atualizar status se o slug corresponder a um valor valido do CHECK constraint
    const VALID_STATUSES = ['NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA', 'CONVERTIDO', 'PERDIDO'];
    if (validated.stage_id) {
      const { data: stage } = await admin
        .from('pipeline_stages')
        .select('slug')
        .eq('id', validated.stage_id)
        .single();

      if (stage && VALID_STATUSES.includes(stage.slug)) {
        (validated as any).status = stage.slug;
      }
    }

    // Re-normalize identity fields when they change
    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(validated)) {
      if (dbFields.has(key) && value !== undefined) {
        updateData[key] = value;
      }
    }

    if (validated.name !== undefined) {
      updateData.name_normalized = normalizeName(validated.name);
    }
    if (validated.email !== undefined) {
      updateData.email_normalized = normalizeEmail(validated.email);
    }
    if (validated.phone !== undefined) {
      updateData.phone_normalized = normalizePhone(validated.phone);
    }
    if (validated.cpf !== undefined) {
      updateData.cpf_digits = normalizeCPF(validated.cpf);
    }
    if (validated.cnpj !== undefined) {
      updateData.cnpj_digits = normalizeCNPJ(validated.cnpj);
    }

    // Use conditional update for claiming to avoid race condition
    let query = admin.from('contacts').update(updateData).eq('id', id);
    if (isClaiming) {
      query = query.is('assigned_to_user_id', null);
    }

    const { data: contact, error } = await query.select().single();

    if (error) throw error;

    // Recalculate lead score after update — pula rascunhos pra economizar ciclo
    // e nao poluir o historico com scores de dados incompletos.
    if (!existingContact.is_draft) {
      try {
        const { data: interactions } = await admin
          .from('interactions')
          .select('outcome, happened_at')
          .eq('contact_id', id)
          .order('happened_at', { ascending: false })
          .limit(50);
        const detailed = computeLeadScoreDetailed({ ...contact, interactions: interactions || [] });
        await admin.from('contacts').update({ lead_score: detailed.total }).eq('id', id);
        contact.lead_score = detailed.total;
      } catch { /* non-blocking */ }
    }

    // Process stage change automations — tambem pula rascunhos.
    if (!existingContact.is_draft && validated.stage_id && validated.stage_id !== existingContact.stage_id) {
      try {
        await processStageChangeAutomations(
          admin,
          existingContact.organization_id,
          id,
          existingContact.stage_id,
          validated.stage_id,
        );
      } catch { /* non-blocking */ }
    }

    // Quando contato e descartado (inexistente: false -> true) e estava
    // vinculado a uma feira, checar se o(s) booth(s) ainda tem outro contato
    // ativo. Se nao tiver, voltar booth pra PENDENTE — antes ficava VISITADO
    // pra sempre mesmo sem contato real, inflando cobertura no mapa.
    if (
      validated.inexistente === true &&
      existingContact.inexistente !== true &&
      existingContact.event_id
    ) {
      try {
        // Busca todos os booth_ids que esse contato visitou
        const { data: contactVisits } = await admin
          .from('booth_visits')
          .select('booth_id')
          .eq('contact_id', id)
          .eq('event_id', existingContact.event_id)
          .eq('organization_id', existingContact.organization_id);

        const boothIds = Array.from(
          new Set((contactVisits || []).map((v: any) => v.booth_id).filter(Boolean))
        );

        for (const boothId of boothIds) {
          // Pega outras visitas do mesmo booth (excluindo as desse contato)
          const { data: otherVisits } = await admin
            .from('booth_visits')
            .select('contact_id')
            .eq('booth_id', boothId)
            .eq('organization_id', existingContact.organization_id)
            .neq('contact_id', id);

          const otherContactIds = (otherVisits || [])
            .map((v: any) => v.contact_id)
            .filter(Boolean);

          // Se nao ha outras visitas nem outros contatos, pode voltar pra PENDENTE
          if (otherContactIds.length === 0) {
            // Mas pode haver visita SEM contact_id no booth (visita exploratoria)
            // — nesse caso ainda conta como visitado.
            const visitsNoContact = (otherVisits || []).filter((v: any) => !v.contact_id);
            if (visitsNoContact.length === 0) {
              await admin
                .from('event_booths')
                .update({ status: 'PENDENTE' })
                .eq('id', boothId)
                .eq('organization_id', existingContact.organization_id);
            }
          } else {
            // Ha outros contatos no booth — checa se algum ainda esta ATIVO
            const { data: activeOthers } = await admin
              .from('contacts')
              .select('id')
              .in('id', otherContactIds)
              .eq('is_draft', false)
              .eq('inexistente', false)
              .limit(1);

            if (!activeOthers || activeOthers.length === 0) {
              // Nenhum outro contato ativo; volta pra PENDENTE
              await admin
                .from('event_booths')
                .update({ status: 'PENDENTE' })
                .eq('id', boothId)
                .eq('organization_id', existingContact.organization_id);
            }
          }
        }
      } catch (e) {
        console.error('[contacts PATCH] revert booth status falhou:', e);
        // non-blocking — nao trava o PATCH se a reversao do booth falhar
      }
    }

    return NextResponse.json(contact);

  } catch (error: any) {
    console.error('Error updating contact:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar contato' },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/:id - Deletar contato (apenas admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();

    // Valida que o contato pertence a org (senao admin de outra org poderia
    // apagar daqui — na pratica a gente so tem 1 org, mas defesa em camadas).
    const { data: existing } = await admin
      .from('contacts')
      .select('id, name, organization_id, is_draft, created_by_user_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Contato nao encontrado' }, { status: 404 });
    }

    // Permissao de delete:
    //   - rascunhos: o criador ou admin pode deletar
    //   - contatos finalizados: so admin
    const canDelete =
      profile.role === 'admin' ||
      (existing.is_draft && existing.created_by_user_id === user.id);

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Apenas administradores podem deletar contatos ja finalizados' },
        { status: 403 }
      );
    }

    // Conta filhos pro audit
    const [intCount, meetCount, attCount] = await Promise.all([
      admin.from('interactions').select('id', { count: 'exact', head: true }).eq('contact_id', id),
      admin.from('meetings').select('id', { count: 'exact', head: true }).eq('contact_id', id),
      admin.from('contact_attachments').select('id', { count: 'exact', head: true }).eq('contact_id', id),
    ]);

    // Deletar anexos do storage primeiro
    const { data: attachments } = await admin
      .from('contact_attachments')
      .select('file_path')
      .eq('contact_id', id);

    if (attachments && attachments.length > 0) {
      const filePaths = attachments.map((a: any) => a.file_path);
      await admin.storage.from('attachments').remove(filePaths);
    }

    // Deletar contato — o banco cuida dos filhos via FK CASCADE.
    const { error } = await admin
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) throw error;

    // Audit log
    try {
      await admin.from('audit_log').insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        user_name: profile.name || 'Sem nome',
        entity: 'contact',
        entity_id: id,
        action: 'delete',
        old_values: { name: existing.name },
        metadata: {
          cascade_interactions: intCount.count || 0,
          cascade_meetings: meetCount.count || 0,
          cascade_attachments: attCount.count || 0,
        },
      });
    } catch (e) {
      console.error('[delete contact] audit log failed:', e);
    }

    return NextResponse.json({ success: true, deleted: { name: existing.name } });
  } catch (error: any) {
    console.error('Error deleting contact:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar contato' },
      { status: 500 }
    );
  }
}
