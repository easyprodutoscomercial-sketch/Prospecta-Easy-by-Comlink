import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/portal/[token]/tickets/[ticketId] - Detalhe do ticket (sem auth)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; ticketId: string }> }
) {
  try {
    const { token, ticketId } = await params;
    const admin = getAdminClient();

    // Validate token and get project
    const { data: project, error: projError } = await admin
      .from('support_projects')
      .select('id, is_active, organization_id')
      .eq('token', token)
      .single();

    if (projError || !project) {
      return NextResponse.json({ error: 'Projeto nao encontrado' }, { status: 404 });
    }

    if (!project.is_active) {
      return NextResponse.json({ error: 'Portal desativado' }, { status: 410 });
    }

    // Fetch ticket
    const { data: ticket, error } = await admin
      .from('support_tickets')
      .select('id, title, description, ticket_type, category, priority, severity, status, created_at, updated_at, resolved_at')
      .eq('id', ticketId)
      .eq('project_id', project.id)
      .single();

    if (error || !ticket) {
      return NextResponse.json({ error: 'Chamado nao encontrado' }, { status: 404 });
    }

    // Fetch comments (only non-internal)
    const { data: comments } = await admin
      .from('support_comments')
      .select('id, user_name, content, is_status_change, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    // Fetch attachments
    const { data: attachments } = await admin
      .from('support_attachments')
      .select('id, file_name, file_size, mime_type, file_path, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    const attachmentsWithUrls = (attachments || []).map((att: any) => {
      const { data } = admin.storage.from('attachments').getPublicUrl(att.file_path);
      return { ...att, public_url: data.publicUrl };
    });

    return NextResponse.json({
      ticket,
      comments: comments || [],
      attachments: attachmentsWithUrls,
    });
  } catch (error: any) {
    console.error('Error fetching portal ticket detail:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
