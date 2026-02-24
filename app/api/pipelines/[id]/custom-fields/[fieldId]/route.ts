import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// PATCH /api/pipelines/:id/custom-fields/:fieldId
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const { fieldId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas admins' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, any> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.slug !== undefined) updates.slug = body.slug;
    if (body.field_type !== undefined) updates.field_type = body.field_type;
    if (body.options !== undefined) updates.options = body.options;
    if (body.is_required !== undefined) updates.is_required = body.is_required;
    if (body.position !== undefined) updates.position = body.position;
    updates.updated_at = new Date().toISOString();

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('pipeline_custom_fields')
      .update(updates)
      .eq('id', fieldId)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/pipelines/:id/custom-fields/:fieldId
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const { fieldId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas admins' }, { status: 403 });
    }

    const admin = getAdminClient();
    const { error } = await admin
      .from('pipeline_custom_fields')
      .delete()
      .eq('id', fieldId)
      .eq('organization_id', profile.organization_id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
