import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { bugReportUpdateSchema } from '@/lib/utils/validation';

// GET /api/bugs/[id] - Buscar bug com detalhes
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

    // Fetch bug
    const { data: bug, error } = await admin
      .from('bug_reports')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !bug) {
      return NextResponse.json({ error: 'Bug nao encontrado' }, { status: 404 });
    }

    // Fetch reporter profile
    const { data: reporterProfile } = await admin
      .from('profiles')
      .select('name')
      .eq('user_id', bug.reported_by)
      .single();

    // Fetch assignee profile if assigned
    let assigneeName: string | null = null;
    if (bug.assigned_to) {
      const { data: assigneeProfile } = await admin
        .from('profiles')
        .select('name')
        .eq('user_id', bug.assigned_to)
        .single();
      assigneeName = assigneeProfile?.name || null;
    }

    // Fetch work front name if present
    let workFrontName: string | null = null;
    if (bug.work_front_id) {
      const { data: wf } = await admin
        .from('work_fronts')
        .select('name')
        .eq('id', bug.work_front_id)
        .single();
      workFrontName = wf?.name || null;
    }

    // Fetch tags via junction table
    const { data: bugTags } = await admin
      .from('bug_report_tags')
      .select('tag_id')
      .eq('bug_report_id', id);

    let tags: any[] = [];
    if (bugTags && bugTags.length > 0) {
      const tagIds = bugTags.map((bt: any) => bt.tag_id);
      const { data: tagData } = await admin
        .from('work_front_tags')
        .select('*')
        .in('id', tagIds);
      tags = tagData || [];
    }

    // Fetch attachments with public URLs
    const { data: attachments } = await admin
      .from('bug_attachments')
      .select('*')
      .eq('bug_report_id', id)
      .order('created_at', { ascending: false });

    const attachmentsWithUrls = (attachments || []).map((att: any) => {
      const { data } = admin.storage.from('attachments').getPublicUrl(att.file_path);
      return { ...att, public_url: data.publicUrl };
    });

    // Fetch comments
    const { data: comments } = await admin
      .from('bug_comments')
      .select('*')
      .eq('bug_report_id', id)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      bug: {
        ...bug,
        reported_by_name: reporterProfile?.name || null,
        assigned_to_name: assigneeName,
        work_front_name: workFrontName,
        tags,
      },
      attachments: attachmentsWithUrls,
      comments: comments || [],
    });
  } catch (error: any) {
    console.error('Error fetching bug:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar bug' },
      { status: 500 }
    );
  }
}

// PATCH /api/bugs/[id] - Atualizar bug
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

    // Fetch existing bug
    const { data: existingBug } = await admin
      .from('bug_reports')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existingBug) {
      return NextResponse.json({ error: 'Bug nao encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validated = bugReportUpdateSchema.parse(body);

    const { tag_ids, ...updateFields } = validated;

    // If status changed to RESOLVIDO, set resolved_at
    if (updateFields.status === 'RESOLVIDO' && existingBug.status !== 'RESOLVIDO') {
      (updateFields as any).resolved_at = new Date().toISOString();
    }

    // If status changed from RESOLVIDO to something else, clear resolved_at
    if (updateFields.status && updateFields.status !== 'RESOLVIDO' && existingBug.status === 'RESOLVIDO') {
      (updateFields as any).resolved_at = null;
    }

    // Update bug
    const { data: updatedBug, error } = await admin
      .from('bug_reports')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If status changed, auto-create a status change comment
    if (updateFields.status && updateFields.status !== existingBug.status) {
      const statusLabels: Record<string, string> = {
        ABERTO: 'Aberto',
        EM_ANALISE: 'Em Analise',
        CORRIGINDO: 'Corrigindo',
        TESTE: 'Teste',
        RESOLVIDO: 'Resolvido',
      };
      const fromLabel = statusLabels[existingBug.status] || existingBug.status;
      const toLabel = statusLabels[updateFields.status] || updateFields.status;

      await admin
        .from('bug_comments')
        .insert({
          bug_report_id: id,
          user_id: user.id,
          user_name: profile.name,
          content: `Status alterado de "${fromLabel}" para "${toLabel}"`,
          is_status_change: true,
        });
    }

    // Handle tag_ids: delete existing and re-insert
    if (tag_ids !== undefined) {
      await admin
        .from('bug_report_tags')
        .delete()
        .eq('bug_report_id', id);

      if (tag_ids && tag_ids.length > 0) {
        const tagRows = tag_ids.map((tagId: string) => ({
          bug_report_id: id,
          tag_id: tagId,
        }));

        const { error: tagError } = await admin
          .from('bug_report_tags')
          .insert(tagRows);

        if (tagError) {
          console.error('Error updating bug tags:', tagError);
        }
      }
    }

    return NextResponse.json(updatedBug);
  } catch (error: any) {
    console.error('Error updating bug:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar bug' },
      { status: 500 }
    );
  }
}

// DELETE /api/bugs/[id] - Deletar bug
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

    // Verify bug exists and belongs to org
    const { data: bug } = await admin
      .from('bug_reports')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!bug) {
      return NextResponse.json({ error: 'Bug nao encontrado' }, { status: 404 });
    }

    // Delete attachments from storage first
    const { data: attachments } = await admin
      .from('bug_attachments')
      .select('file_path')
      .eq('bug_report_id', id);

    if (attachments && attachments.length > 0) {
      const filePaths = attachments.map((a: any) => a.file_path);
      await admin.storage.from('attachments').remove(filePaths);
    }

    // Delete attachment records
    await admin.from('bug_attachments').delete().eq('bug_report_id', id);

    // Delete comments
    await admin.from('bug_comments').delete().eq('bug_report_id', id);

    // Delete tags junction
    await admin.from('bug_report_tags').delete().eq('bug_report_id', id);

    // Delete bug
    const { error } = await admin.from('bug_reports').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting bug:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar bug' },
      { status: 500 }
    );
  }
}
