import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/pipelines/:id/custom-fields
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pipelineId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('pipeline_custom_fields')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/pipelines/:id/custom-fields
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pipelineId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas admins' }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, field_type, options, is_required, position } = body;

    if (!name || !slug || !field_type) {
      return NextResponse.json({ error: 'name, slug e field_type sao obrigatorios' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('pipeline_custom_fields')
      .insert({
        organization_id: profile.organization_id,
        pipeline_id: pipelineId,
        name,
        slug,
        field_type,
        options: options || null,
        is_required: is_required || false,
        position: position ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
