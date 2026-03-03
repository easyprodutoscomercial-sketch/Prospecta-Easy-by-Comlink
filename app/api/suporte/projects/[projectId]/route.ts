import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { supportProjectUpdateSchema } from '@/lib/utils/validation';

// GET /api/suporte/projects/[projectId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const { data: project, error } = await admin
      .from('support_projects')
      .select('*')
      .eq('id', projectId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Projeto nao encontrado' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error: any) {
    console.error('Error fetching support project:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar projeto' },
      { status: 500 }
    );
  }
}

// PATCH /api/suporte/projects/[projectId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    // Verify project belongs to org
    const { data: existing } = await admin
      .from('support_projects')
      .select('id')
      .eq('id', projectId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Projeto nao encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validated = supportProjectUpdateSchema.parse(body);

    const { data: project, error } = await admin
      .from('support_projects')
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(project);
  } catch (error: any) {
    console.error('Error updating support project:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar projeto' },
      { status: 500 }
    );
  }
}

// DELETE /api/suporte/projects/[projectId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    // Verify project belongs to org
    const { data: existing } = await admin
      .from('support_projects')
      .select('id')
      .eq('id', projectId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Projeto nao encontrado' }, { status: 404 });
    }

    // Unlink tickets from project (don't delete them)
    await admin
      .from('support_tickets')
      .update({ project_id: null })
      .eq('project_id', projectId);

    // Delete project
    const { error } = await admin
      .from('support_projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting support project:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar projeto' },
      { status: 500 }
    );
  }
}
