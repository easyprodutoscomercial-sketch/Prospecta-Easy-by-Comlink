import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/pedidos-cotacoes/clients/[id]/detail - Retorna dados 360 do cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const orgId = profile.organization_id;

    // Fetch client
    const { data: client, error: clientError } = await admin
      .from('pc_clients')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Cliente nao encontrado' }, { status: 404 });
    }

    // Fetch created_by name
    let created_by_name = null;
    if (client.created_by) {
      const { data: creatorProfile } = await admin
        .from('profiles')
        .select('name')
        .eq('user_id', client.created_by)
        .single();
      created_by_name = creatorProfile?.name || null;
    }

    // Fetch cotacoes linked to this client
    const { data: cotacoes } = await admin
      .from('pc_cotacoes')
      .select('*')
      .eq('organization_id', orgId)
      .eq('pc_client_id', id)
      .order('created_at', { ascending: false });

    // Fetch pedidos linked to this client
    const { data: pedidos } = await admin
      .from('pc_pedidos')
      .select('*')
      .eq('organization_id', orgId)
      .eq('pc_client_id', id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      client,
      cotacoes: cotacoes || [],
      pedidos: pedidos || [],
      created_by_name,
    });
  } catch (error: any) {
    console.error('Error fetching client detail:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar detalhes do cliente' },
      { status: 500 }
    );
  }
}
