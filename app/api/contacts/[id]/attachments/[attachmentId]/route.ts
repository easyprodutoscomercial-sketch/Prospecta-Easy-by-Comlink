import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/contacts/[id]/attachments/[attachmentId] - Deletar anexo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    // Get attachment
    const { data: attachment } = await admin
      .from('contact_attachments')
      .select('*')
      .eq('id', attachmentId)
      .eq('contact_id', id)
      .single();

    if (!attachment) {
      return NextResponse.json({ error: 'Anexo nao encontrado' }, { status: 404 });
    }

    // Check permission: uploader, contact owner, or admin
    const { data: contact } = await admin
      .from('contacts')
      .select('assigned_to_user_id')
      .eq('id', id)
      .single();

    const isUploader = attachment.uploaded_by_user_id === user.id;
    const isContactOwner = contact?.assigned_to_user_id === user.id;
    const isAdmin = profile.role === 'admin';

    if (!isUploader && !isContactOwner && !isAdmin) {
      return NextResponse.json({ error: 'Sem permissao para deletar este anexo' }, { status: 403 });
    }

    // Remove from storage
    await admin.storage.from('attachments').remove([attachment.file_path]);

    // Remove record
    const { error } = await admin
      .from('contact_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json({ error: error.message || 'Erro ao deletar anexo' }, { status: 500 });
  }
}
