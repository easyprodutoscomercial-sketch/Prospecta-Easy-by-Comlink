import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { avancarBuscasParadas } from '@/lib/indicacoes/motor';

// toda tela do CRM consulta esta rota a cada 30s: depois de responder, ela tambem empurra
// buscas de indicacao que ficaram paradas (vendedor fechou a janela no meio). O empurrao
// pode processar uma rodada inteira (Receita + rascunhos), por isso os 60s.
export const maxDuration = 60;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    after(() => avancarBuscasParadas().catch((e) => console.warn('[indicacoes IA] empurrao', e instanceof Error ? e.message : e)));

    const admin = getAdminClient();

    const now = new Date().toISOString();

    const { count, error } = await admin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('organization_id', profile.organization_id)
      .eq('read', false)
      .eq('dismissed', false)
      .or(`scheduled_for.is.null,scheduled_for.lte.${now}`);

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
