import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { contactUpdateSchema } from '@/lib/utils/validation';

// GET /api/contacts/:id - Buscar contato
export async function GET(
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

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !contact) {
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    // Buscar interações
    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('contact_id', id)
      .order('happened_at', { ascending: false });

    return NextResponse.json({ contact, interactions: interactions || [] });

  } catch (error: any) {
    console.error('Error fetching contact:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar contato' },
      { status: 500 }
    );
  }
}

// PATCH /api/contacts/:id - Atualizar contato (status, atribuição)
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

    const body = await request.json();
    const validated = contactUpdateSchema.parse(body);

    const { data: contact, error } = await supabase
      .from('contacts')
      .update(validated)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(contact);

  } catch (error: any) {
    console.error('Error updating contact:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar contato' },
      { status: 500 }
    );
  }
}
