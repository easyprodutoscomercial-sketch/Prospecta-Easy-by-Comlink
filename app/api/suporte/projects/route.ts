import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';
import { supportProjectSchema } from '@/lib/utils/validation';
import { randomBytes } from 'crypto';

function generateToken(): string {
  return randomBytes(9).toString('base64url').slice(0, 12);
}

// GET /api/suporte/projects - Listar projetos
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const { data: projects, error } = await admin
      .from('support_projects')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    // If table doesn't exist yet, return empty array gracefully
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.code === 'PGRST204') {
        return NextResponse.json({ projects: [] });
      }
      throw error;
    }

    // Enrich with contact names and ticket counts
    const contactIds = new Set<string>();
    const userIds = new Set<string>();
    (projects || []).forEach((p: any) => {
      if (p.contact_id) contactIds.add(p.contact_id);
      if (p.created_by) userIds.add(p.created_by);
    });

    let contactsMap: Record<string, string> = {};
    if (contactIds.size > 0) {
      const { data: contacts } = await admin
        .from('contacts')
        .select('id, name')
        .in('id', Array.from(contactIds));
      (contacts || []).forEach((c: any) => { contactsMap[c.id] = c.name; });
    }

    let profilesMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('user_id, name')
        .in('user_id', Array.from(userIds));
      (profiles || []).forEach((p: any) => { profilesMap[p.user_id] = p.name; });
    }

    // Count tickets per project
    const projectIdsArr = (projects || []).map((p: any) => p.id);
    let ticketCounts: Record<string, number> = {};
    if (projectIdsArr.length > 0) {
      const { data: counts } = await admin
        .from('support_tickets')
        .select('project_id')
        .in('project_id', projectIdsArr);
      (counts || []).forEach((t: any) => {
        if (t.project_id) {
          ticketCounts[t.project_id] = (ticketCounts[t.project_id] || 0) + 1;
        }
      });
    }

    const enriched = (projects || []).map((p: any) => ({
      ...p,
      contact_name: p.contact_id ? (contactsMap[p.contact_id] || null) : null,
      created_by_name: profilesMap[p.created_by] || null,
      ticket_count: ticketCounts[p.id] || 0,
    }));

    return NextResponse.json({ projects: enriched });
  } catch (error: any) {
    console.error('Error listing support projects:', error);
    // Graceful fallback: if the table simply doesn't exist, return empty
    return NextResponse.json({ projects: [] });
  }
}

// POST /api/suporte/projects - Criar projeto
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const body = await request.json();
    const validated = supportProjectSchema.parse(body);

    const token = generateToken();

    const { data: project, error } = await admin
      .from('support_projects')
      .insert({
        ...validated,
        organization_id: profile.organization_id,
        created_by: user.id,
        token,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    console.error('Error creating support project:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    // Check if table doesn't exist
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Execute a migration v20 (support_projects) antes de criar projetos.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao criar projeto' },
      { status: 500 }
    );
  }
}
