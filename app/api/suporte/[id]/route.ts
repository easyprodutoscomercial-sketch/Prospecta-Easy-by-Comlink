import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { supportTicketUpdateSchema } from '@/lib/utils/validation';
import { SUPPORT_STATUS_LABELS } from '@/lib/utils/labels';

// GET /api/suporte/[id] - Buscar ticket com detalhes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    // Fetch ticket
    const { data: ticket, error } = await admin
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !ticket) {
      return NextResponse.json({ error: 'Chamado nao encontrado' }, { status: 404 });
    }

    // Fetch reporter profile
    const { data: reporterProfile } = await admin
      .from('profiles')
      .select('name')
      .eq('user_id', ticket.reported_by)
      .single();

    // Fetch assignee profile if assigned
    let assigneeName: string | null = null;
    if (ticket.assigned_to) {
      const { data: assigneeProfile } = await admin
        .from('profiles')
        .select('name')
        .eq('user_id', ticket.assigned_to)
        .single();
      assigneeName = assigneeProfile?.name || null;
    }

    // Fetch contact name if linked
    let contactName: string | null = null;
    if (ticket.contact_id) {
      const { data: contact } = await admin
        .from('contacts')
        .select('name')
        .eq('id', ticket.contact_id)
        .single();
      contactName = contact?.name || null;
    }

    // Fetch attachments with public URLs
    const { data: attachments } = await admin
      .from('support_attachments')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: false });

    const attachmentsWithUrls = (attachments || []).map((att: any) => {
      const { data } = admin.storage.from('attachments').getPublicUrl(att.file_path);
      return { ...att, public_url: data.publicUrl };
    });

    // Fetch comments
    const { data: comments } = await admin
      .from('support_comments')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      ticket: {
        ...ticket,
        reported_by_name: reporterProfile?.name || null,
        assigned_to_name: assigneeName,
        contact_name: contactName,
      },
      attachments: attachmentsWithUrls,
      comments: comments || [],
    });
  } catch (error: any) {
    console.error('Error fetching support ticket:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar chamado' },
      { status: 500 }
    );
  }
}

// PATCH /api/suporte/[id] - Atualizar ticket
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    // Fetch existing ticket
    const { data: existingTicket } = await admin
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existingTicket) {
      return NextResponse.json({ error: 'Chamado nao encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validated = supportTicketUpdateSchema.parse(body);

    const updateFields: any = { ...validated };

    // If status changed to RESOLVIDO or FECHADO, set resolved_at
    if (
      (updateFields.status === 'RESOLVIDO' || updateFields.status === 'FECHADO') &&
      existingTicket.status !== 'RESOLVIDO' &&
      existingTicket.status !== 'FECHADO'
    ) {
      updateFields.resolved_at = new Date().toISOString();
    }

    // If status changed from RESOLVIDO/FECHADO to something else, clear resolved_at
    if (
      updateFields.status &&
      updateFields.status !== 'RESOLVIDO' &&
      updateFields.status !== 'FECHADO' &&
      (existingTicket.status === 'RESOLVIDO' || existingTicket.status === 'FECHADO')
    ) {
      updateFields.resolved_at = null;
    }

    // Update ticket
    const { data: updatedTicket, error } = await admin
      .from('support_tickets')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If status changed, auto-create a status change comment
    if (updateFields.status && updateFields.status !== existingTicket.status) {
      const fromLabel = SUPPORT_STATUS_LABELS[existingTicket.status] || existingTicket.status;
      const toLabel = SUPPORT_STATUS_LABELS[updateFields.status] || updateFields.status;

      await admin
        .from('support_comments')
        .insert({
          ticket_id: id,
          user_id: user.id,
          user_name: profile.name,
          content: `Status alterado de "${fromLabel}" para "${toLabel}"`,
          is_status_change: true,
        });
    }

    return NextResponse.json(updatedTicket);
  } catch (error: any) {
    console.error('Error updating support ticket:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar chamado' },
      { status: 500 }
    );
  }
}

// DELETE /api/suporte/[id] - Deletar ticket
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    // Verify ticket exists and belongs to org
    const { data: ticket } = await admin
      .from('support_tickets')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: 'Chamado nao encontrado' }, { status: 404 });
    }

    // Delete attachments from storage first
    const { data: attachments } = await admin
      .from('support_attachments')
      .select('file_path')
      .eq('ticket_id', id);

    if (attachments && attachments.length > 0) {
      const filePaths = attachments.map((a: any) => a.file_path);
      await admin.storage.from('attachments').remove(filePaths);
    }

    // Delete attachment records
    await admin.from('support_attachments').delete().eq('ticket_id', id);

    // Delete comments
    await admin.from('support_comments').delete().eq('ticket_id', id);

    // Delete ticket
    const { error } = await admin.from('support_tickets').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting support ticket:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar chamado' },
      { status: 500 }
    );
  }
}
