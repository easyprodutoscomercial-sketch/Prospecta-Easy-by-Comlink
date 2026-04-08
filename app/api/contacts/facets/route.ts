import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/contacts/facets - Returns faceted counts for filter dropdowns
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);

    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();

    // Check pipeline membership for non-admins
    let allowedPipelineIds: string[] | null = null;
    if (profile.role !== 'admin') {
      const { data: myMemberships } = await admin
        .from('pipeline_members')
        .select('pipeline_id')
        .eq('user_id', user.id);

      allowedPipelineIds = (myMemberships || []).map((m: any) => m.pipeline_id);

      if (allowedPipelineIds.length === 0) {
        return NextResponse.json({
          statusCounts: {},
          tipoCounts: {},
          temperaturaCounts: {},
          origemCounts: {},
          classeCounts: {},
        });
      }
    }

    // Fetch only the fields we need for counting (lightweight query)
    let query = admin
      .from('contacts')
      .select('status, tipo, temperatura, origem, classe')
      .eq('organization_id', profile.organization_id);

    if (allowedPipelineIds !== null && allowedPipelineIds.length > 0) {
      query = query.in('pipeline_id', allowedPipelineIds);
    }

    const { data: contacts, error } = await query;

    if (error) throw error;

    // Calculate counts
    const statusCounts: Record<string, number> = {};
    const tipoCounts: Record<string, number> = {};
    const temperaturaCounts: Record<string, number> = {};
    const origemCounts: Record<string, number> = {};
    const classeCounts: Record<string, number> = {};

    for (const c of contacts || []) {
      // Status
      if (c.status) {
        statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      }

      // Tipo is an array field
      if (c.tipo && Array.isArray(c.tipo)) {
        for (const t of c.tipo) {
          tipoCounts[t] = (tipoCounts[t] || 0) + 1;
        }
      }

      // Temperatura
      if (c.temperatura) {
        temperaturaCounts[c.temperatura] = (temperaturaCounts[c.temperatura] || 0) + 1;
      }

      // Origem
      if (c.origem) {
        origemCounts[c.origem] = (origemCounts[c.origem] || 0) + 1;
      }

      // Classe
      if (c.classe) {
        classeCounts[c.classe] = (classeCounts[c.classe] || 0) + 1;
      }
    }

    return NextResponse.json({
      statusCounts,
      tipoCounts,
      temperaturaCounts,
      origemCounts,
      classeCounts,
    });

  } catch (error: any) {
    console.error('Error fetching contact facets:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar facetas' },
      { status: 500 }
    );
  }
}
