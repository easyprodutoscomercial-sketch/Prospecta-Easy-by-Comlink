import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureProfile } from '@/lib/ensure-profile';

const batchUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: z.enum([
    'NOVO', 'EM_PROSPECCAO', 'CONTATADO', 'REUNIAO_MARCADA', 'CONVERTIDO', 'PERDIDO',
  ]).optional(),
  inexistente: z.boolean().optional(),
}).refine((data) => data.status !== undefined || data.inexistente !== undefined, {
  message: 'Pelo menos status ou inexistente deve ser informado',
});

const batchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

// PATCH /api/contacts/batch - Atualizar status em massa
export async function PATCH(request: NextRequest) {
  try {
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
    const { ids, status, inexistente } = batchUpdateSchema.parse(body);

    const allowedIds = ids;

    const updateData: Record<string, any> = {};
    if (status !== undefined) updateData.status = status;
    if (inexistente !== undefined) updateData.inexistente = inexistente;

    // Filtra org_id pra impedir admin de uma org alterar contatos de outra
    // mandando UUIDs alheios. Sistema interno hoje (1 org), mas R1 pede
    // defense in depth.
    const { data: updated, error } = await admin
      .from('contacts')
      .update(updateData)
      .in('id', allowedIds)
      .eq('organization_id', profile.organization_id)
      .select('id');

    if (error) throw error;

    return NextResponse.json({ success: true, updated: updated?.length || 0 });

  } catch (error: any) {
    console.error('Error batch updating contacts:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar contatos' },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/batch - Deletar em massa (apenas admin)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem deletar contatos' }, { status: 403 });
    }

    const admin = getAdminClient();
    const body = await request.json();
    const { ids } = batchDeleteSchema.parse(body);

    // Antes de deletar, valida que TODOS os ids passados pertencem a org do
    // user. Se algum nao for, recusa o batch inteiro (atomicidade).
    // Sem esse check, admin de uma org poderia deletar contatos de outra
    // passando UUIDs alheios.
    const { data: ownedContacts } = await admin
      .from('contacts')
      .select('id, name')
      .in('id', ids)
      .eq('organization_id', profile.organization_id);

    const ownedIds = (ownedContacts || []).map((c: any) => c.id);
    if (ownedIds.length !== ids.length) {
      return NextResponse.json(
        { error: 'Alguns contatos nao foram encontrados ou nao pertencem a sua organizacao' },
        { status: 404 }
      );
    }

    // Delete all related records first (escopados aos contatos validados)
    await admin.from('interactions').delete().in('contact_id', ownedIds);
    await admin.from('meetings').delete().in('contact_id', ownedIds);
    await admin.from('notifications').delete().in('contact_id', ownedIds);
    await admin.from('access_requests').delete().in('contact_id', ownedIds);
    await admin.from('contact_attachments').delete().in('contact_id', ownedIds);

    // Delete contacts (com filtro org_id por seguranca extra)
    const { error } = await admin
      .from('contacts')
      .delete()
      .in('id', ownedIds)
      .eq('organization_id', profile.organization_id);

    if (error) throw error;

    // Audit log: registra cada delete pra ter rastro de quem deletou em massa.
    // Sem isso, vendedor reclama "sumiu meu contato" e ninguem sabe quem foi.
    try {
      const auditRows = ownedContacts!.map((c: any) => ({
        organization_id: profile.organization_id,
        user_id: user.id,
        action: 'CONTACT_DELETE',
        entity_type: 'contact',
        entity_id: c.id,
        metadata: { name: c.name, batch: true, batch_size: ids.length },
      }));
      await admin.from('audit_log').insert(auditRows);
    } catch (auditErr) {
      // Audit log nao pode bloquear o delete em si — so loga se falhar.
      console.warn('[batch-delete] audit_log insert falhou:', auditErr);
    }

    return NextResponse.json({ success: true, deleted: ownedIds.length });

  } catch (error: any) {
    console.error('Error batch deleting contacts:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao deletar contatos' },
      { status: 500 }
    );
  }
}
