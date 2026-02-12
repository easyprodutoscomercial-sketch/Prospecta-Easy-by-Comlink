import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Perfil nao encontrado' }, { status: 403 });
    }

    const admin = getAdminClient();

    // Tasks = contacts where proxima_acao_data <= today+3days AND assigned_to = user AND status NOT IN (CONVERTIDO, PERDIDO)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const { count, error } = await admin
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .eq('assigned_to_user_id', user.id)
      .not('status', 'in', '("CONVERTIDO","PERDIDO")')
      .not('proxima_acao_data', 'is', null)
      .lte('proxima_acao_data', threeDaysFromNow.toISOString());

    if (error) throw error;

    return NextResponse.json({ count: count || 0 });
  } catch (error: any) {
    console.error('Error counting tasks:', error);
    return NextResponse.json({ error: error.message || 'Erro ao contar tarefas' }, { status: 500 });
  }
}
