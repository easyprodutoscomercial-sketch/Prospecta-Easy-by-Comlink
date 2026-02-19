import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { bugCommentSchema } from '@/lib/utils/validation';

// GET /api/bugs/[id]/comments - Listar comentarios do bug
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

    const { data: comments, error } = await admin
      .from('bug_comments')
      .select('*')
      .eq('bug_report_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ comments: comments || [] });
  } catch (error: any) {
    console.error('Error listing bug comments:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar comentarios' },
      { status: 500 }
    );
  }
}

// POST /api/bugs/[id]/comments - Criar comentario
export async function POST(
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

    // Verify bug exists and belongs to same org
    const { data: bug } = await admin
      .from('bug_reports')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!bug) {
      return NextResponse.json({ error: 'Bug nao encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validated = bugCommentSchema.parse(body);

    const { data: comment, error } = await admin
      .from('bug_comments')
      .insert({
        bug_report_id: id,
        user_id: user.id,
        user_name: profile.name,
        content: validated.content,
        is_status_change: false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(comment, { status: 201 });
  } catch (error: any) {
    console.error('Error creating bug comment:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao criar comentario' },
      { status: 500 }
    );
  }
}
