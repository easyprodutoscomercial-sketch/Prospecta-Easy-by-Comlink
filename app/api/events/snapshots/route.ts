import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/events/snapshots
// Lista todos os snapshots de feiras da org, ordenados por data de criacao desc.
// Inclui snapshots de feiras que ja foram apagadas (event_id = null).
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();

    const { data: snapshots, error } = await admin
      .from('event_snapshots')
      .select('id, event_id, event_name, event_location, event_start_date, event_end_date, snapshot_data, excel_url, created_at, created_by_name, trigger')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Devolve so os campos resumo do snapshot_data (nao o objeto inteiro)
    // pra lista ficar leve. O detalhe completo vai em /api/events/snapshots/[id].
    const lean = (snapshots || []).map((s: any) => ({
      id: s.id,
      event_id: s.event_id,
      event_name: s.event_name,
      event_location: s.event_location,
      event_start_date: s.event_start_date,
      event_end_date: s.event_end_date,
      event_exists: !!s.event_id,
      total_leads: s.snapshot_data?.total_leads || 0,
      total_stand_leads: s.snapshot_data?.total_stand_leads || 0,
      total_walk_ins: s.snapshot_data?.total_walk_ins || 0,
      visited_booths: s.snapshot_data?.visited_booths || 0,
      total_booths: s.snapshot_data?.total_booths || 0,
      coverage_pct: s.snapshot_data?.coverage_pct || 0,
      total_value: s.snapshot_data?.total_value || 0,
      sellers_count: (s.snapshot_data?.sellers || []).length,
      created_at: s.created_at,
      created_by_name: s.created_by_name,
      trigger: s.trigger,
      excel_url: s.excel_url,
    }));

    return NextResponse.json({ snapshots: lean });
  } catch (error: any) {
    console.error('[snapshots list] error:', error);
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
