import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { pcClientUpdateSchema } from '@/lib/utils/validation';

// GET /api/pedidos-cotacoes/clients/[id] - Buscar cliente por ID
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

    const { data: client, error } = await admin
      .from('pc_clients')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: 'Cliente nao encontrado' }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error: any) {
    console.error('Error fetching pc_client:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar cliente' },
      { status: 500 }
    );
  }
}

// PATCH /api/pedidos-cotacoes/clients/[id] - Atualizar cliente
export async function PATCH(
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

    // Verify client exists and belongs to org
    const { data: existingClient } = await admin
      .from('pc_clients')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existingClient) {
      return NextResponse.json({ error: 'Cliente nao encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validated = pcClientUpdateSchema.parse(body);

    const updateFields: any = { ...validated };

    // If cnpj changes, re-extract cnpj_digits
    if (validated.cnpj !== undefined) {
      updateFields.cnpj_digits = validated.cnpj ? validated.cnpj.replace(/\D/g, '') : null;
    }

    const { data: updatedClient, error } = await admin
      .from('pc_clients')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updatedClient);
  } catch (error: any) {
    console.error('Error updating pc_client:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar cliente' },
      { status: 500 }
    );
  }
}

// DELETE /api/pedidos-cotacoes/clients/[id] - Deletar cliente
export async function DELETE(
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

    // Verify client exists and belongs to org
    const { data: client } = await admin
      .from('pc_clients')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Cliente nao encontrado' }, { status: 404 });
    }

    const { error } = await admin.from('pc_clients').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting pc_client:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar cliente' },
      { status: 500 }
    );
  }
}
