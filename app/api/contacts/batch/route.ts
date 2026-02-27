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

    const { error } = await admin
      .from('contacts')
      .update(updateData)
      .in('id', allowedIds);

    if (error) throw error;

    return NextResponse.json({ success: true, updated: allowedIds.length });

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

    // Delete all related records first
    await admin.from('interactions').delete().in('contact_id', ids);
    await admin.from('meetings').delete().in('contact_id', ids);
    await admin.from('notifications').delete().in('contact_id', ids);
    await admin.from('access_requests').delete().in('contact_id', ids);
    await admin.from('contact_attachments').delete().in('contact_id', ids);

    // Delete contacts
    const { error } = await admin.from('contacts').delete().in('id', ids);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: ids.length });

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
