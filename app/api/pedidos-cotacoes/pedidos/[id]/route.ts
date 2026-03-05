import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { pcPedidoUpdateSchema } from '@/lib/utils/validation';

// PATCH /api/pedidos-cotacoes/pedidos/[id] - Atualizar pedido
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

    // Verify pedido exists and belongs to org
    const { data: existingPedido } = await admin
      .from('pc_pedidos')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existingPedido) {
      return NextResponse.json({ error: 'Pedido nao encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validated = pcPedidoUpdateSchema.parse(body);

    const updateFields: any = { ...validated };

    // Handle finalizado_at logic
    if (validated.finalizado !== undefined) {
      if (validated.finalizado === true && existingPedido.finalizado === false) {
        updateFields.finalizado_at = new Date().toISOString();
      } else if (validated.finalizado === false) {
        updateFields.finalizado_at = null;
      }
    }

    const { data: updatedPedido, error } = await admin
      .from('pc_pedidos')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updatedPedido);
  } catch (error: any) {
    console.error('Error updating pc_pedido:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar pedido' },
      { status: 500 }
    );
  }
}

// DELETE /api/pedidos-cotacoes/pedidos/[id] - Deletar pedido
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

    // Verify pedido exists and belongs to org
    const { data: pedido } = await admin
      .from('pc_pedidos')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido nao encontrado' }, { status: 404 });
    }

    const { error } = await admin.from('pc_pedidos').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting pc_pedido:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar pedido' },
      { status: 500 }
    );
  }
}
