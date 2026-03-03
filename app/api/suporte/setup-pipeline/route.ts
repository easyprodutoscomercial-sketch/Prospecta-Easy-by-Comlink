import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_SUPORTE_STAGES = [
  { name: 'Aberto', slug: 'ABERTO', color: '#ef4444', position: 0, is_terminal: false, terminal_type: null },
  { name: 'Em Andamento', slug: 'EM_ANDAMENTO', color: '#3b82f6', position: 1, is_terminal: false, terminal_type: null },
  { name: 'Aguardando', slug: 'AGUARDANDO', color: '#f59e0b', position: 2, is_terminal: false, terminal_type: null },
  { name: 'Resolvido', slug: 'RESOLVIDO', color: '#10b981', position: 3, is_terminal: true, terminal_type: 'won' as const },
  { name: 'Fechado', slug: 'FECHADO', color: '#6b7280', position: 4, is_terminal: true, terminal_type: 'lost' as const },
];

// Status-to-slug mapping for backfill
const STATUS_TO_SLUG: Record<string, string> = {
  ABERTO: 'ABERTO',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  AGUARDANDO: 'AGUARDANDO',
  RESOLVIDO: 'RESOLVIDO',
  FECHADO: 'FECHADO',
};

// POST /api/suporte/setup-pipeline - Auto-create default SUPORTE pipeline
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const orgId = profile.organization_id;

    // Check if SUPORTE pipeline already exists
    const { data: existing } = await admin
      .from('pipelines')
      .select('id')
      .eq('organization_id', orgId)
      .eq('pipeline_type', 'SUPORTE')
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ message: 'Pipeline SUPORTE ja existe', pipeline_id: existing[0].id });
    }

    // Get next position
    const { data: posData } = await admin
      .from('pipelines')
      .select('position')
      .eq('organization_id', orgId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = posData && posData.length > 0 ? posData[0].position + 1 : 0;

    // Create pipeline
    const { data: pipeline, error: pipError } = await admin
      .from('pipelines')
      .insert({
        organization_id: orgId,
        name: 'Suporte',
        description: 'Pipeline padrao de chamados de suporte',
        pipeline_type: 'SUPORTE',
        is_default: true,
        position: nextPosition,
      })
      .select()
      .single();

    if (pipError) throw pipError;

    // Create stages
    const stagesToInsert = DEFAULT_SUPORTE_STAGES.map((s) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      slug: s.slug,
      color: s.color,
      position: s.position,
      is_terminal: s.is_terminal,
      terminal_type: s.terminal_type,
    }));

    const { data: stages, error: stagesError } = await admin
      .from('pipeline_stages')
      .insert(stagesToInsert)
      .select();

    if (stagesError) throw stagesError;

    // Add creator as pipeline member
    await admin.from('pipeline_members').insert({
      pipeline_id: pipeline.id,
      user_id: user.id,
    });

    // Backfill existing tickets with pipeline_id and stage_id
    const stageBySlug: Record<string, string> = {};
    (stages || []).forEach((s: any) => {
      stageBySlug[s.slug] = s.id;
    });

    // Get all tickets without pipeline_id
    const { data: ticketsToUpdate } = await admin
      .from('support_tickets')
      .select('id, status')
      .eq('organization_id', orgId)
      .is('pipeline_id', null);

    if (ticketsToUpdate && ticketsToUpdate.length > 0) {
      for (const ticket of ticketsToUpdate) {
        const slug = STATUS_TO_SLUG[ticket.status] || 'ABERTO';
        const stageId = stageBySlug[slug] || stageBySlug['ABERTO'];
        if (stageId) {
          await admin
            .from('support_tickets')
            .update({ pipeline_id: pipeline.id, stage_id: stageId })
            .eq('id', ticket.id);
        }
      }
    }

    return NextResponse.json({
      pipeline: { ...pipeline, stages: stages || [] },
      backfilled: ticketsToUpdate?.length || 0,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error setting up support pipeline:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar pipeline de suporte' },
      { status: 500 }
    );
  }
}
