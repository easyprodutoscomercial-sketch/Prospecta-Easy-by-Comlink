import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// POST /api/portal/[token]/tickets/[ticketId]/attachments - Upload (sem auth)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; ticketId: string }> }
) {
  try {
    const { token, ticketId } = await params;
    const admin = getAdminClient();

    // Validate token
    const { data: project } = await admin
      .from('support_projects')
      .select('id, is_active, organization_id, created_by')
      .eq('token', token)
      .single();

    if (!project || !project.is_active) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verify ticket belongs to project
    const { data: ticket } = await admin
      .from('support_tickets')
      .select('id')
      .eq('id', ticketId)
      .eq('project_id', project.id)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: 'Chamado nao encontrado' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Maximo 50MB.' }, { status: 400 });
    }

    // Generate unique file path
    const ext = file.name.split('.').pop() || 'bin';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `${project.organization_id}/suporte/${ticketId}/${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await admin.storage
      .from('attachments')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Portal upload error:', uploadError);
      return NextResponse.json(
        { error: 'Erro ao fazer upload: ' + uploadError.message },
        { status: 500 }
      );
    }

    // Insert record
    const { data: attachment, error: insertError } = await admin
      .from('support_attachments')
      .insert({
        organization_id: project.organization_id,
        ticket_id: ticketId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: project.created_by,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const { data: urlData } = admin.storage.from('attachments').getPublicUrl(filePath);

    return NextResponse.json({ ...attachment, public_url: urlData.publicUrl }, { status: 201 });
  } catch (error: any) {
    console.error('Error uploading portal attachment:', error);
    return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 });
  }
}
