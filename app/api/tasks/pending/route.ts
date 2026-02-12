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

    const { data: tasks, error } = await admin
      .from('contacts')
      .select('id, name, company, phone, proxima_acao_tipo, proxima_acao_data, status, temperatura')
      .eq('organization_id', profile.organization_id)
      .eq('assigned_to_user_id', user.id)
      .not('status', 'in', '("CONVERTIDO","PERDIDO")')
      .not('proxima_acao_data', 'is', null)
      .lte('proxima_acao_data', threeDaysFromNow.toISOString())
      .order('proxima_acao_data', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ tasks: tasks || [] });
  } catch (error: any) {
    console.error('Error listing tasks:', error);
    return NextResponse.json({ error: error.message || 'Erro ao listar tarefas' }, { status: 500 });
  }
}
