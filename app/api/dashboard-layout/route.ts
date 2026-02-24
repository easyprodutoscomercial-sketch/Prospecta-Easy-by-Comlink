import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/dashboard-layout
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('dashboard_layouts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return NextResponse.json(data || null);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/dashboard-layout
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Perfil nao encontrado' }, { status: 403 });

    const { layout } = await request.json();
    if (!layout) return NextResponse.json({ error: 'layout obrigatorio' }, { status: 400 });

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('dashboard_layouts')
      .upsert({
        user_id: user.id,
        organization_id: profile.organization_id,
        layout,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
