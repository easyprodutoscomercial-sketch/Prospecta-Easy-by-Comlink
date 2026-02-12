import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const admin = getAdminClient();

    const { count, error } = await admin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('organization_id', profile.organization_id)
      .eq('read', false)
      .eq('dismissed', false);

    if (error) {
      // Table may not exist yet — return 0 instead of crashing
      console.warn('Notifications table not ready:', error.message);
      return NextResponse.json({ count: 0 });
    }
    return NextResponse.json({ count: count || 0 });
  } catch (error: any) {
    console.error('Error fetching notification count:', error);
    return NextResponse.json({ count: 0 });
  }
}
