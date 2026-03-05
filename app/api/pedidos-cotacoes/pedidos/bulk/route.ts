import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const body = await request.json();
    const { action, ids, situacao } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs obrigatorios' }, { status: 400 });
    }

    if (action === 'delete') {
      const { error } = await admin
        .from('pc_pedidos')
        .delete()
        .in('id', ids)
        .eq('organization_id', profile.organization_id);
      if (error) throw error;
      return NextResponse.json({ success: true, affected: ids.length });
    }

    if (action === 'change_status' && situacao) {
      const { error } = await admin
        .from('pc_pedidos')
        .update({ situacao })
        .in('id', ids)
        .eq('organization_id', profile.organization_id);
      if (error) throw error;
      return NextResponse.json({ success: true, affected: ids.length });
    }

    if (action === 'finalize') {
      const { error } = await admin
        .from('pc_pedidos')
        .update({ finalizado: true, finalizado_at: new Date().toISOString() })
        .in('id', ids)
        .eq('organization_id', profile.organization_id);
      if (error) throw error;
      return NextResponse.json({ success: true, affected: ids.length });
    }

    return NextResponse.json({ error: 'Acao invalida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error bulk pc_pedidos:', error);
    return NextResponse.json({ error: error.message || 'Erro na operacao em massa' }, { status: 500 });
  }
}
