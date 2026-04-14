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

  // Busca contatos ligados via FK OU via campo texto legacy (associacao = sigla)
  const { data: contacts } = await admin
    .from('contacts')
    .select('id, name, company, cargo, phone, email, cidade, estado, stage_id, pipeline_id, temperatura, status, created_at, updated_at, assigned_to_user_id, associacao, association_id')
    .eq('organization_id', profile.organization_id)
    .or(`association_id.eq.${id},associacao.ilike.${data.sigla}`)
    .order('created_at', { ascending: false });

  const list = contacts || [];

  // Stats
  const byTemp: Record<string, number> = { QUENTE: 0, MORNO: 0, FRIO: 0 };
  const byStatus: Record<string, number> = {};
  let recent = 0;
  const now = Date.now();
  for (const c of list) {
    if (c.temperatura && byTemp[c.temperatura] !== undefined) byTemp[c.temperatura]++;
    if (c.status) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    if (c.updated_at && now - new Date(c.updated_at).getTime() < 7 * 24 * 60 * 60 * 1000) recent++;
  }

  return NextResponse.json({
    association: data,
    contacts: list,
    stats: {
      total_contacts: list.length,
      by_temperatura: byTemp,
      by_status: byStatus,
      recent_7d: recent,
    },
  });
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
