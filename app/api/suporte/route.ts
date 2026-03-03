import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { supportTicketSchema } from '@/lib/utils/validation';

// GET /api/suporte - Listar tickets com filtros
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const ticket_type = searchParams.get('ticket_type');
    const category = searchParams.get('category');
    const assigned_to = searchParams.get('assigned_to');
    const search = searchParams.get('search');
    const overdue = searchParams.get('overdue');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = admin
      .from('support_tickets')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }

    if (ticket_type && ticket_type !== 'all') {
      query = query.eq('ticket_type', ticket_type);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (assigned_to) {
      query = query.eq('assigned_to', assigned_to);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    if (overdue === 'true') {
      query = query.lt('due_date', new Date().toISOString().split('T')[0])
        .not('status', 'in', '("RESOLVIDO","FECHADO")');
    }

    const { data: tickets, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Fetch reporter and assignee names
    const userIds = new Set<string>();
    const contactIds = new Set<string>();
    (tickets || []).forEach((t: any) => {
      if (t.reported_by) userIds.add(t.reported_by);
      if (t.assigned_to) userIds.add(t.assigned_to);
      if (t.contact_id) contactIds.add(t.contact_id);
    });

    let profilesMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('user_id, name')
        .in('user_id', Array.from(userIds));

      (profiles || []).forEach((p: any) => {
        profilesMap[p.user_id] = p.name;
      });
    }

    let contactsMap: Record<string, string> = {};
    if (contactIds.size > 0) {
      const { data: contacts } = await admin
        .from('contacts')
        .select('id, name')
        .in('id', Array.from(contactIds));

      (contacts || []).forEach((c: any) => {
        contactsMap[c.id] = c.name;
      });
    }

    const ticketsWithNames = (tickets || []).map((t: any) => ({
      ...t,
      reported_by_name: profilesMap[t.reported_by] || null,
      assigned_to_name: t.assigned_to ? (profilesMap[t.assigned_to] || null) : null,
      contact_name: t.contact_id ? (contactsMap[t.contact_id] || null) : null,
    }));

    return NextResponse.json({
      tickets: ticketsWithNames,
      total: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error: any) {
    console.error('Error listing support tickets:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar chamados' },
      { status: 500 }
    );
  }
}

// POST /api/suporte - Criar ticket
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const body = await request.json();
    const validated = supportTicketSchema.parse(body);

    const { data: ticket, error } = await admin
      .from('support_tickets')
      .insert({
        ...validated,
        reported_by: user.id,
        organization_id: profile.organization_id,
        status: 'ABERTO',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(ticket, { status: 201 });
  } catch (error: any) {
    console.error('Error creating support ticket:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao criar chamado' },
      { status: 500 }
    );
  }
}
