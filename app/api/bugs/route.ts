import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { bugReportSchema } from '@/lib/utils/validation';

// GET /api/bugs - Listar bugs com filtros
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
    const severity = searchParams.get('severity');
    const priority = searchParams.get('priority');
    const work_front_id = searchParams.get('work_front_id');
    const assigned_to = searchParams.get('assigned_to');
    const search = searchParams.get('search');
    const sprint_id = searchParams.get('sprint_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Se NAO e admin, filtrar bugs apenas de work_fronts onde e membro
    let allowedWorkFrontIds: string[] | null = null;
    if (profile.role !== 'admin') {
      const { data: myMemberships } = await admin
        .from('work_front_members')
        .select('work_front_id')
        .eq('user_id', user.id);

      allowedWorkFrontIds = (myMemberships || []).map((m: any) => m.work_front_id);
    }

    let query = admin
      .from('bug_reports')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id);

    // Filtrar por work_fronts permitidas (non-admin)
    if (allowedWorkFrontIds !== null) {
      if (allowedWorkFrontIds.length > 0) {
        query = query.in('work_front_id', allowedWorkFrontIds);
      } else {
        // Sem membership em nenhum work front — nao retorna nada
        return NextResponse.json({ bugs: [], total: 0, page, limit, totalPages: 0 });
      }
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (severity && severity !== 'all') {
      query = query.eq('severity', severity);
    }

    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }

    if (work_front_id) {
      query = query.eq('work_front_id', work_front_id);
    }

    if (assigned_to) {
      query = query.eq('assigned_to', assigned_to);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    if (sprint_id) {
      query = query.eq('sprint_id', sprint_id);
    }

    const { data: bugs, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Fetch reporter and assignee names for each bug
    const userIds = new Set<string>();
    (bugs || []).forEach((bug: any) => {
      if (bug.reported_by) userIds.add(bug.reported_by);
      if (bug.assigned_to) userIds.add(bug.assigned_to);
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

    const bugsWithNames = (bugs || []).map((bug: any) => ({
      ...bug,
      reported_by_name: profilesMap[bug.reported_by] || null,
      assigned_to_name: bug.assigned_to ? (profilesMap[bug.assigned_to] || null) : null,
    }));

    return NextResponse.json({
      bugs: bugsWithNames,
      total: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error: any) {
    console.error('Error listing bugs:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar bugs' },
      { status: 500 }
    );
  }
}

// POST /api/bugs - Criar bug report
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const body = await request.json();
    const validated = bugReportSchema.parse(body);

    const { tag_ids, ...bugData } = validated;

    const { data: bug, error } = await admin
      .from('bug_reports')
      .insert({
        ...bugData,
        reported_by: user.id,
        organization_id: profile.organization_id,
        status: 'ABERTO',
      })
      .select()
      .single();

    if (error) throw error;

    // Insert tags if provided
    if (tag_ids && tag_ids.length > 0) {
      const tagRows = tag_ids.map((tagId: string) => ({
        bug_report_id: bug.id,
        tag_id: tagId,
      }));

      const { error: tagError } = await admin
        .from('bug_report_tags')
        .insert(tagRows);

      if (tagError) {
        console.error('Error inserting bug tags:', tagError);
      }
    }

    return NextResponse.json(bug, { status: 201 });
  } catch (error: any) {
    console.error('Error creating bug:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao criar bug' },
      { status: 500 }
    );
  }
}
