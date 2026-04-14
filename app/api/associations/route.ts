import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

  const profile = await ensureProfile(supabase, user);
  if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('associations')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('sigla', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ associations: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

  const profile = await ensureProfile(supabase, user);
  if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

  if (profile.role !== 'admin' && profile.role !== 'gerente') {
    return NextResponse.json({ error: 'Somente admin/gerente pode criar associacoes' }, { status: 403 });
  }

  const body = await request.json();
  const sigla = (body.sigla || '').trim();
  const nome_completo = (body.nome_completo || '').trim();
  if (!sigla || !nome_completo) {
    return NextResponse.json({ error: 'sigla e nome_completo sao obrigatorios' }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('associations')
    .insert({
      organization_id: profile.organization_id,
      sigla,
      nome_completo,
      presidente: body.presidente || null,
      telefone: body.telefone || null,
      email: body.email || null,
      website: body.website || null,
      cidade: body.cidade || null,
      estado: body.estado || null,
      endereco: body.endereco || null,
      cep: body.cep || null,
      grupo: body.grupo || null,
      notas: body.notas || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ja existe uma associacao com essa sigla' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ association: data });
}
