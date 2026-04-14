import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

  const profile = await ensureProfile(supabase, user);
  if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('associations')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Nao encontrada' }, { status: 404 });

  const { count: contactsCount } = await admin
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('association_id', id)
    .eq('organization_id', profile.organization_id);

  return NextResponse.json({ association: data, contacts_count: contactsCount || 0 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

  const profile = await ensureProfile(supabase, user);
  if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

  if (profile.role !== 'admin' && profile.role !== 'gerente') {
    return NextResponse.json({ error: 'Somente admin/gerente' }, { status: 403 });
  }

  const body = await req.json();
  const updatable: any = {};
  for (const k of ['sigla', 'nome_completo', 'presidente', 'telefone', 'email', 'website', 'cidade', 'estado', 'endereco', 'cep', 'grupo', 'notas', 'logo_url']) {
    if (k in body) updatable[k] = body[k];
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('associations')
    .update(updatable)
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ association: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

  const profile = await ensureProfile(supabase, user);
  if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

  if (profile.role !== 'admin') {
    return NextResponse.json({ error: 'Somente admin' }, { status: 403 });
  }

  const admin = getAdminClient();
  const { error } = await admin
    .from('associations')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
