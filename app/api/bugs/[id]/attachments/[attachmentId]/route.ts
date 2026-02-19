import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/bugs/[id]/attachments/[attachmentId] - Deletar anexo do bug
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    // Get attachment
    const { data: attachment } = await admin
      .from('bug_attachments')
      .select('*')
      .eq('id', attachmentId)
      .eq('bug_report_id', id)
      .single();

    if (!attachment) {
      return NextResponse.json({ error: 'Anexo nao encontrado' }, { status: 404 });
    }

    // Remove from storage
    await admin.storage.from('attachments').remove([attachment.file_path]);

    // Remove record
    const { error } = await admin
      .from('bug_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting bug attachment:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar anexo' },
      { status: 500 }
    );
  }
}
