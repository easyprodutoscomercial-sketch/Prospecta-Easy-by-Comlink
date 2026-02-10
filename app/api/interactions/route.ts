import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { interactionSchema } from '@/lib/utils/validation';

// POST /api/interactions - Criar interação
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, name, email')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validated = interactionSchema.parse(body);

    // Pegar contact para verificar organization_id
    const { data: contact } = await supabase
      .from('contacts')
      .select('organization_id, status')
      .eq('id', validated.contact_id)
      .single();

    if (!contact) {
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    // Criar interação
    const { data: interaction, error } = await supabase
      .from('interactions')
      .insert({
        organization_id: contact.organization_id,
        contact_id: validated.contact_id,
        type: validated.type,
        outcome: validated.outcome,
        note: validated.note || null,
        happened_at: validated.happened_at || new Date().toISOString(),
        created_by_user_id: user.id,
        created_by_name: profile.name,
        created_by_email: profile.email,
      })
      .select()
      .single();

    if (error) throw error;

    // Atualizar status do contato baseado no outcome
    let newStatus = contact.status;
    if (validated.outcome === 'REUNIAO_MARCADA') {
      newStatus = 'REUNIAO_MARCADA';
    } else if (validated.outcome === 'CONVERTIDO') {
      newStatus = 'CONVERTIDO';
    } else if (validated.outcome === 'NAO_INTERESSADO') {
      newStatus = 'PERDIDO';
    } else if (validated.outcome === 'RESPONDEU' && contact.status === 'NOVO') {
      newStatus = 'CONTATADO';
    }

    if (newStatus !== contact.status) {
      await supabase
        .from('contacts')
        .update({ status: newStatus })
        .eq('id', validated.contact_id);
    }

    return NextResponse.json(interaction, { status: 201 });

  } catch (error: any) {
    console.error('Error creating interaction:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Erro ao criar interação' },
      { status: 500 }
    );
  }
}
