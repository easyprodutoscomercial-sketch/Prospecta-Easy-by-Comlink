import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const admin = getAdminClient();

    const { count, error } = await admin
      .from('access_requests')
      .select('*', { count: 'exact', head: true })
      .eq('owner_user_id', user.id)
      .eq('status', 'PENDING');

    if (error) throw error;

    return NextResponse.json({ count: count || 0 });
  } catch (error: any) {
    console.error('Error counting access requests:', error);
    return NextResponse.json({ error: error.message || 'Erro ao contar solicitações' }, { status: 500 });
  }
}
