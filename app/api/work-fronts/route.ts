import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { workFrontSchema } from '@/lib/utils/validation';

// GET /api/work-fronts - Listar frentes de trabalho da org
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);

    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    // Buscar work fronts da organizacao
    const { data: workFronts, error } = await admin
      .from('work_fronts')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Se NAO e admin, filtrar apenas work fronts onde o usuario e membro
    let filteredWorkFronts = workFronts || [];
    if (profile.role !== 'admin') {
      const wfIds = filteredWorkFronts.map((wf: any) => wf.id);
      if (wfIds.length > 0) {
        const { data: myMemberships } = await admin
          .from('work_front_members')
          .select('work_front_id')
          .eq('user_id', user.id)
          .in('work_front_id', wfIds);

        const myWfIds = new Set((myMemberships || []).map((m: any) => m.work_front_id));
        filteredWorkFronts = filteredWorkFronts.filter((wf: any) => myWfIds.has(wf.id));
      }
    }

    // Enriquecer com membros e bugs
    const enriched = await Promise.all(
      filteredWorkFronts.map(async (wf: any) => {
        const { data: members } = await admin
          .from('work_front_members')
          .select('user_id, role')
          .eq('work_front_id', wf.id);

        const { count: bugCount } = await admin
          .from('bug_reports')
          .select('id', { count: 'exact', head: true })
          .eq('work_front_id', wf.id);

        // Get active sprint
        const { data: activeSprint } = await admin
          .from('work_front_sprints')
          .select('*')
          .eq('work_front_id', wf.id)
          .eq('status', 'ATIVA')
          .limit(1)
          .maybeSingle();

        // Get member names
        const memberUserIds = (members || []).map((m: any) => m.user_id);
        let memberProfiles: Record<string, string> = {};
        if (memberUserIds.length > 0) {
          const { data: profiles } = await admin
            .from('profiles')
            .select('user_id, name')
            .in('user_id', memberUserIds);
          (profiles || []).forEach((p: any) => { memberProfiles[p.user_id] = p.name; });
        }

        return {
          ...wf,
          members: (members || []).map((m: any) => ({ ...m, user_name: memberProfiles[m.user_id] || null })),
          bug_count: bugCount || 0,
          active_sprint: activeSprint || null,
        };
      })
    );

    return NextResponse.json({ work_fronts: enriched });
  } catch (error: any) {
    console.error('Error listing work fronts:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar frentes de trabalho' },
      { status: 500 }
    );
  }
}

// POST /api/work-fronts - Criar frente de trabalho
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);

    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validated = workFrontSchema.parse(body);

    const { data: workFront, error } = await admin
      .from('work_fronts')
      .insert({
        organization_id: profile.organization_id,
        ...validated,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(workFront, { status: 201 });
  } catch (error: any) {
    console.error('Error creating work front:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao criar frente de trabalho' },
      { status: 500 }
    );
  }
}
