import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/pedidos-cotacoes/setup - Create tables if not exist
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas admin pode executar setup' }, { status: 403 });
    }

    // Test if tables exist by querying them
    const results: string[] = [];

    // Try pc_clients
    const { error: e1 } = await admin.from('pc_clients').select('id').limit(1);
    if (e1) {
      results.push(`pc_clients: ${e1.message}`);
    } else {
      results.push('pc_clients: OK');
    }

    // Try pc_cotacoes
    const { error: e2 } = await admin.from('pc_cotacoes').select('id').limit(1);
    if (e2) {
      results.push(`pc_cotacoes: ${e2.message}`);
    } else {
      results.push('pc_cotacoes: OK');
    }

    // Try pc_pedidos
    const { error: e3 } = await admin.from('pc_pedidos').select('id').limit(1);
    if (e3) {
      results.push(`pc_pedidos: ${e3.message}`);
    } else {
      results.push('pc_pedidos: OK');
    }

    const allOk = !e1 && !e2 && !e3;

    return NextResponse.json({
      success: allOk,
      message: allOk
        ? 'Todas as tabelas existem e estao acessiveis'
        : 'Algumas tabelas nao existem. Execute o SQL de migration no Supabase Dashboard > SQL Editor',
      results,
      migration_sql_path: 'supabase/migrations/20250304_pedidos_cotacoes.sql',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
