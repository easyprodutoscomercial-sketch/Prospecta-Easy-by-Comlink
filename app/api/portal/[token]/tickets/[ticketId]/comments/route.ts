import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/portal/[token]/tickets/[ticketId]/comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; ticketId: string }> }
) {
  try {
    const { token, ticketId } = await params;
    const admin = getAdminClient();

    // Validate token
    const { data: project } = await admin
      .from('support_projects')
      .select('id, is_active')
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

    const { data: comments, error } = await admin
      .from('support_comments')
      .select('id, user_name, content, is_status_change, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ comments: comments || [] });
  } catch (error: any) {
    console.error('Error listing portal comments:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST /api/portal/[token]/tickets/[ticketId]/comments
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
      .select('id, is_active, name')
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

    const body = await request.json();
    const { content, author_name } = body;

    if (!content || content.trim().length < 1) {
      return NextResponse.json({ error: 'Comentario e obrigatorio' }, { status: 400 });
    }

    const { data: comment, error } = await admin
      .from('support_comments')
      .insert({
        ticket_id: ticketId,
        user_id: '00000000-0000-0000-0000-000000000000', // portal user placeholder
        user_name: author_name?.trim()?.slice(0, 100) || `Portal: ${project.name}`,
        content: content.trim().slice(0, 5000),
        is_status_change: false,
      })
      .select('id, user_name, content, is_status_change, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json(comment, { status: 201 });
  } catch (error: any) {
    console.error('Error creating portal comment:', error);
    return NextResponse.json({ error: 'Erro ao adicionar comentario' }, { status: 500 });
  }
}
