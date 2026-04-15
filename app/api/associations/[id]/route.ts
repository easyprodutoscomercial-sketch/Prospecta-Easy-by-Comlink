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

  // Busca ultima interacao por contato (uma query so)
  const lastByContact: Record<string, { type: string; at: string }> = {};
  if (list.length > 0) {
    const { data: interactions } = await admin
      .from('interactions')
      .select('contact_id, type, happened_at, created_at')
      .eq('organization_id', profile.organization_id)
      .in('contact_id', list.map(c => c.id))
      .order('happened_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    for (const i of interactions || []) {
      if (!i.contact_id || lastByContact[i.contact_id]) continue;
      lastByContact[i.contact_id] = { type: i.type, at: i.happened_at || i.created_at };
    }
  }

  // Stats
  const byTemp: Record<string, number> = { QUENTE: 0, MORNO: 0, FRIO: 0 };
  const byStatus: Record<string, number> = {};
  let recent = 0;
  let comInteracao = 0;
  const now = Date.now();
  const enriched = list.map(c => {
    if (c.temperatura && byTemp[c.temperatura] !== undefined) byTemp[c.temperatura]++;
    if (c.status) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    if (c.updated_at && now - new Date(c.updated_at).getTime() < 7 * 24 * 60 * 60 * 1000) recent++;
    const last_interaction = lastByContact[c.id] || null;
    if (last_interaction) comInteracao++;
    return { ...c, last_interaction };
  });

  return NextResponse.json({
    association: data,
    contacts: enriched,
    stats: {
      total_contacts: list.length,
      by_temperatura: byTemp,
      by_status: byStatus,
      recent_7d: recent,
      contatos_com_interacao: comInteracao,
      contatos_sem_interacao: list.length - comInteracao,
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
