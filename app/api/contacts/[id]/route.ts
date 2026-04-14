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

    const admin = getAdminClient();

    const { data: contact, error } = await admin
      .from('contacts')
      .select('*')
      .eq('id', id)
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

    return NextResponse.json({ contact, interactions: interactions || [], attachments: attachmentsWithUrls });

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
      .select('assigned_to_user_id, stage_id, organization_id, is_draft')
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

    // All known contact columns
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
