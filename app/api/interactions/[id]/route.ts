import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const interactionUpdateSchema = z.object({
  type: z.enum([
    'LIGACAO', 'WHATSAPP', 'EMAIL', 'REUNIAO', 'OUTRO',
    'VISITA', 'PROPOSTA_ENVIADA', 'FOLLOW_UP', 'NEGOCIACAO',
    'POS_VENDA', 'SUPORTE', 'INDICACAO', 'APRESENTACAO', 'ORCAMENTO',
  ]).optional(),
  outcome: z.enum([
    'SEM_RESPOSTA', 'RESPONDEU', 'REUNIAO_MARCADA', 'NAO_INTERESSADO', 'CONVERTIDO', 'SEGUIR_TENTANDO',
    'PROPOSTA_ACEITA', 'AGUARDANDO_RETORNO', 'EM_NEGOCIACAO', 'INDICOU_TERCEIRO', 'FECHADO_PARCIAL',
  ]).optional(),
  note: z.string().optional().nullable(),
  happened_at: z.string().datetime().optional(),
});

// PATCH /api/interactions/:id - Editar interação
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

    const admin = getAdminClient();
    const body = await request.json();
    const validated = interactionUpdateSchema.parse(body);

    const { data: interaction, error } = await admin
      .from('interactions')
      .update(validated)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(interaction);

  } catch (error: any) {
    console.error('Error updating interaction:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar interação' },
      { status: 500 }
    );
  }
}

// DELETE /api/interactions/:id - Deletar interação
export async function DELETE(
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

    const admin = getAdminClient();

    const { error } = await admin
      .from('interactions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error deleting interaction:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar interação' },
      { status: 500 }
    );
  }
}
