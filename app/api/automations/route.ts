import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/automations - List automation rules
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();
    const { data: rules, error } = await admin
      .from('automation_rules')
      .select('*, automation_executions(count)')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ rules: rules || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/automations - Create automation rule (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas admins' }, { status: 403 });
    }

    const body = await request.json();
    const admin = getAdminClient();

    const { data: rule, error } = await admin
      .from('automation_rules')
      .insert({
        organization_id: profile.organization_id,
        pipeline_id: body.pipeline_id || null,
        name: body.name,
        description: body.description || null,
        trigger_type: body.trigger_type,
        trigger_config: body.trigger_config || {},
        action_type: body.action_type,
        action_config: body.action_config || {},
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
