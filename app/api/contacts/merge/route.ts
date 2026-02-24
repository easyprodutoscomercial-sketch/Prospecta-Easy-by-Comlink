import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// POST /api/contacts/merge - Mesclar dois contatos duplicados (apenas admin)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem mesclar contatos' }, { status: 403 });
    }

    const body = await request.json();
    const { primary_id, secondary_id, merged_fields } = body;

    if (!primary_id || !secondary_id) {
      return NextResponse.json({ error: 'primary_id e secondary_id sao obrigatorios' }, { status: 400 });
    }

    if (primary_id === secondary_id) {
      return NextResponse.json({ error: 'Nao e possivel mesclar um contato consigo mesmo' }, { status: 400 });
    }

    if (!merged_fields || typeof merged_fields !== 'object') {
      return NextResponse.json({ error: 'merged_fields e obrigatorio' }, { status: 400 });
    }

    const admin = getAdminClient();
    const orgId = profile.organization_id;

    // Verificar que ambos os contatos existem e pertencem a mesma organizacao
    const { data: primaryContact, error: primaryError } = await admin
      .from('contacts')
      .select('*')
      .eq('id', primary_id)
      .eq('organization_id', orgId)
      .single();

    if (primaryError || !primaryContact) {
      return NextResponse.json({ error: 'Contato primario nao encontrado' }, { status: 404 });
    }

    const { data: secondaryContact, error: secondaryError } = await admin
      .from('contacts')
      .select('*')
      .eq('id', secondary_id)
      .eq('organization_id', orgId)
      .single();

    if (secondaryError || !secondaryContact) {
      return NextResponse.json({ error: 'Contato secundario nao encontrado' }, { status: 404 });
    }

    // 1. Atualizar o contato primario com os campos mesclados
    const { error: updateError } = await admin
      .from('contacts')
      .update(merged_fields)
      .eq('id', primary_id);

    if (updateError) {
      console.error('Erro ao atualizar contato primario:', updateError);
      throw updateError;
    }

    // 2. Reassociar todos os registros relacionados do secundario para o primario
    const reassociationTables = [
      'interactions',
      'meetings',
      'contact_attachments',
      'notifications',
      'access_requests',
    ];

    for (const table of reassociationTables) {
      const { error: reassocError } = await admin
        .from(table)
        .update({ contact_id: primary_id })
        .eq('contact_id', secondary_id);

      if (reassocError) {
        // Log mas nao falha - a tabela pode nao ter registros para esse contato
        console.warn(`Aviso ao reassociar ${table}:`, reassocError.message);
      }
    }

    // 3. Deletar o contato secundario
    const { error: deleteError } = await admin
      .from('contacts')
      .delete()
      .eq('id', secondary_id);

    if (deleteError) {
      console.error('Erro ao deletar contato secundario:', deleteError);
      throw deleteError;
    }

    // 4. Buscar o contato primario atualizado
    const { data: updatedPrimary, error: fetchError } = await admin
      .from('contacts')
      .select('*')
      .eq('id', primary_id)
      .single();

    if (fetchError) {
      console.error('Erro ao buscar contato atualizado:', fetchError);
      throw fetchError;
    }

    return NextResponse.json({ success: true, contact: updatedPrimary });
  } catch (error: any) {
    console.error('Error merging contacts:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao mesclar contatos' },
      { status: 500 }
    );
  }
}
