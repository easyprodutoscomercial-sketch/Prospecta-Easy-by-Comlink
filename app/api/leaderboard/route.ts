import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { LeaderboardEntry } from '@/lib/types';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();
    const orgId = profile.organization_id;

    // Current month range
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    // Get all profiles in the organization
    const { data: profiles } = await admin
      .from('profiles')
      .select('user_id, name, email')
      .eq('organization_id', orgId);

    if (!profiles || profiles.length === 0) {
      return NextResponse.json([]);
    }

    // Get contacts created this month
    const { data: contacts } = await admin
      .from('contacts')
      .select('created_by_user_id')
      .eq('organization_id', orgId)
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd);

    // Get interactions this month
    const { data: interactions } = await admin
      .from('interactions')
      .select('created_by_user_id, type, outcome')
      .eq('organization_id', orgId)
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd);

    // Calculate per-user metrics
    const leaderboard: LeaderboardEntry[] = profiles.map((p) => {
      const userContacts = (contacts || []).filter((c) => c.created_by_user_id === p.user_id);
      const userInteractions = (interactions || []).filter((i) => i.created_by_user_id === p.user_id);

      return {
        user_id: p.user_id,
        name: p.name,
        email: p.email,
        contacts_created: userContacts.length,
        interactions_count: userInteractions.length,
        meetings_count: userInteractions.filter((i) => i.type === 'REUNIAO' || i.type === 'VISITA').length,
        conversions_count: userInteractions.filter((i) =>
          i.outcome === 'CONVERTIDO' || i.outcome === 'PROPOSTA_ACEITA' || i.outcome === 'FECHADO_PARCIAL'
        ).length,
      };
    });

    // Sort by total interactions descending
    leaderboard.sort((a, b) => b.interactions_count - a.interactions_count);

    return NextResponse.json(leaderboard);
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar ranking' },
      { status: 500 }
    );
  }
}
