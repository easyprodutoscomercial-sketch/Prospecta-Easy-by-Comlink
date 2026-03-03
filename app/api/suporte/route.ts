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
    const project_id = searchParams.get('project_id');
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

    if (project_id) {
      query = query.eq('project_id', project_id);
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
    const projectIds = new Set<string>();
    (tickets || []).forEach((t: any) => {
      if (t.reported_by) userIds.add(t.reported_by);
      if (t.assigned_to) userIds.add(t.assigned_to);
      if (t.contact_id) contactIds.add(t.contact_id);
      if (t.project_id) projectIds.add(t.project_id);
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

    // Fetch project names (graceful if table doesn't exist)
    let projectsMap: Record<string, string> = {};
    if (projectIds.size > 0) {
      try {
        const { data: projects } = await admin
          .from('support_projects')
          .select('id, name')
          .in('id', Array.from(projectIds));

        (projects || []).forEach((p: any) => {
          projectsMap[p.id] = p.name;
        });
      } catch {
        // support_projects table may not exist yet
      }
    }

    const ticketsWithNames = (tickets || []).map((t: any) => ({
      ...t,
      reported_by_name: profilesMap[t.reported_by] || null,
      assigned_to_name: t.assigned_to ? (profilesMap[t.assigned_to] || null) : null,
      contact_name: t.contact_id ? (contactsMap[t.contact_id] || null) : null,
      project_name: t.project_id ? (projectsMap[t.project_id] || null) : null,
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

    // Build insert data, stripping fields that may not exist in DB yet
    const insertData: Record<string, any> = {
      title: validated.title,
      description: validated.description,
      ticket_type: validated.ticket_type,
      category: validated.category,
      priority: validated.priority,
      contact_id: validated.contact_id,
      assigned_to: validated.assigned_to,
      due_date: validated.due_date,
      reported_by: user.id,
      organization_id: profile.organization_id,
      status: 'ABERTO',
    };

    // Add optional new columns only if they have values
    if (validated.severity) insertData.severity = validated.severity;
    if (validated.project_id) insertData.project_id = validated.project_id;

    // Lookup default SUPORTE pipeline and first stage
    try {
      const { data: suportePipeline } = await admin
        .from('pipelines')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .eq('pipeline_type', 'SUPORTE')
        .eq('is_default', true)
        .limit(1)
        .single();

      if (suportePipeline) {
        insertData.pipeline_id = suportePipeline.id;
        const { data: firstStage } = await admin
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', suportePipeline.id)
          .order('position', { ascending: true })
          .limit(1)
          .single();

        if (firstStage) {
          insertData.stage_id = firstStage.id;
        }
      }
    } catch {
      // Pipeline may not exist yet — continue without it
    }

    // Try insert with all fields first
    let { data: ticket, error } = await admin
      .from('support_tickets')
      .insert(insertData)
      .select()
      .single();

    // If failed because of new columns, retry without them
    if (error && (error.message?.includes('severity') || error.message?.includes('project_id'))) {
      console.warn('Insert with new columns failed, retrying without:', error.message);
      delete insertData.severity;
      delete insertData.project_id;
      const retry = await admin
        .from('support_tickets')
        .insert(insertData)
        .select()
        .single();
      ticket = retry.data;
      error = retry.error;
    }

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
