import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { accessRequestResolveSchema } from '@/lib/utils/validation';

// PATCH /api/access-requests/:id - Aprovar ou rejeitar
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();
    const body = await request.json();
    const validated = accessRequestResolveSchema.parse(body);

    // Buscar a solicitação
    const { data: accessRequest } = await admin
      .from('access_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (!accessRequest) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    if (accessRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Solicitação já foi resolvida' }, { status: 400 });
    }

    // Só o owner ou admin pode resolver
    if (accessRequest.owner_user_id !== user.id && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Sem permissão para resolver esta solicitação' }, { status: 403 });
    }

    // Atualizar status da solicitação
    const { error: updateError } = await admin
      .from('access_requests')
      .update({
        status: validated.status,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Se APPROVED, transferir o contato
    if (validated.status === 'APPROVED') {
      const { error: transferError } = await admin
        .from('contacts')
        .update({ assigned_to_user_id: accessRequest.requester_user_id })
        .eq('id', accessRequest.contact_id);

      if (transferError) throw transferError;
    }

    return NextResponse.json({ success: true, status: validated.status });
  } catch (error: any) {
    console.error('Error resolving access request:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados inválidos', details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: error.message || 'Erro ao resolver solicitação' }, { status: 500 });
  }
}
