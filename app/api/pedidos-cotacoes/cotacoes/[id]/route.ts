import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { pcCotacaoUpdateSchema } from '@/lib/utils/validation';

// PATCH /api/pedidos-cotacoes/cotacoes/[id] - Atualizar cotacao
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

    // Verify cotacao exists and belongs to org
    const { data: existingCotacao } = await admin
      .from('pc_cotacoes')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existingCotacao) {
      return NextResponse.json({ error: 'Cotacao nao encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const validated = pcCotacaoUpdateSchema.parse(body);

    const { data: updatedCotacao, error } = await admin
      .from('pc_cotacoes')
      .update(validated)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updatedCotacao);
  } catch (error: any) {
    console.error('Error updating pc_cotacao:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar cotacao' },
      { status: 500 }
    );
  }
}

// DELETE /api/pedidos-cotacoes/cotacoes/[id] - Deletar cotacao
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

    // Verify cotacao exists and belongs to org
    const { data: cotacao } = await admin
      .from('pc_cotacoes')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!cotacao) {
      return NextResponse.json({ error: 'Cotacao nao encontrada' }, { status: 404 });
    }

    const { error } = await admin.from('pc_cotacoes').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting pc_cotacao:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar cotacao' },
      { status: 500 }
    );
  }
}
