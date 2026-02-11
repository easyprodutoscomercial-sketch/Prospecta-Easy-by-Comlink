import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { contactUpdateSchema } from '@/lib/utils/validation';
import { normalizeEmail, normalizePhone, normalizeCPF, normalizeCNPJ, normalizeName } from '@/lib/utils/normalize';
import { ensureProfile } from '@/lib/ensure-profile';

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

    return NextResponse.json({ contact, interactions: interactions || [] });

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
    const validated = contactUpdateSchema.parse(body);

    // Ownership enforcement: buscar contato atual
    const { data: existingContact } = await admin
      .from('contacts')
      .select('assigned_to_user_id')
      .eq('id', id)
      .single();

    if (!existingContact) {
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    // "Apontar para mim": se contato não tem dono e estou me atribuindo
    const isClaiming = validated.assigned_to_user_id === user.id && !existingContact.assigned_to_user_id;

    // Se movendo no pipeline (status change) e contato tem dono diferente de mim
    if (validated.status && existingContact.assigned_to_user_id && existingContact.assigned_to_user_id !== user.id && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas o responsável ou admin pode alterar o status deste contato' }, { status: 403 });
    }

    // Converter proxima_acao_data para ISO se presente
    if (validated.proxima_acao_data) {
      validated.proxima_acao_data = new Date(validated.proxima_acao_data).toISOString();
    }

    // Re-normalize identity fields when they change
    const updateData: Record<string, any> = { ...validated };

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

// DELETE /api/contacts/:id - Deletar contato
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

    const admin = getAdminClient();

    // Deletar interações primeiro
    await admin.from('interactions').delete().eq('contact_id', id);

    // Deletar contato
    const { error } = await admin.from('contacts').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting contact:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar contato' },
      { status: 500 }
    );
  }
}
