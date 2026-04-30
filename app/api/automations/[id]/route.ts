import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/automations/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();
    const { data: rule, error } = await admin
      .from('automation_rules')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !rule) return NextResponse.json({ error: 'Regra nao encontrada' }, { status: 404 });

    // Fetch recent executions
    const { data: executions } = await admin
      .from('automation_executions')
      .select('*')
      .eq('rule_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({ rule, executions: executions || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/automations/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas admins' }, { status: 403 });
    }

    const body = await request.json();
    const admin = getAdminClient();

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.trigger_type !== undefined) updateData.trigger_type = body.trigger_type;
    if (body.trigger_config !== undefined) updateData.trigger_config = body.trigger_config;
    if (body.action_type !== undefined) updateData.action_type = body.action_type;
    if (body.action_config !== undefined) updateData.action_config = body.action_config;
    if (body.pipeline_id !== undefined) updateData.pipeline_id = body.pipeline_id;

    const { data: rule, error } = await admin
      .from('automation_rules')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) throw error;
    if (!rule) return NextResponse.json({ error: 'Regra nao encontrada' }, { status: 404 });

    return NextResponse.json(rule);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/automations/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas admins' }, { status: 403 });
    }

    const admin = getAdminClient();
    // Filtra org_id pra impedir admin de uma org deletar automation de outra
    // sabendo o UUID. Isso ja esta protegido na pratica (sistema interno = 1 org),
    // mas R1 pede defense in depth.
    const { data, error } = await admin
      .from('automation_rules')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Automacao nao encontrada' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
