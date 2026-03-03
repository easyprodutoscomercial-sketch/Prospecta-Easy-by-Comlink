import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/portal/[token]/tickets - Listar tickets do projeto (sem auth)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const admin = getAdminClient();

    // Validate token and get project
    const { data: project, error: projError } = await admin
      .from('support_projects')
      .select('id, is_active, organization_id')
      .eq('token', token)
      .single();

    if (projError || !project) {
      return NextResponse.json({ error: 'Projeto nao encontrado' }, { status: 404 });
    }

    if (!project.is_active) {
      return NextResponse.json({ error: 'Portal desativado' }, { status: 410 });
    }

    // Fetch tickets for this project
    const { data: tickets, error } = await admin
      .from('support_tickets')
      .select('id, title, ticket_type, category, priority, severity, status, created_at, updated_at')
      .eq('project_id', project.id)
      .eq('organization_id', project.organization_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ tickets: tickets || [] });
  } catch (error: any) {
    console.error('Error listing portal tickets:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST /api/portal/[token]/tickets - Criar ticket pelo portal (sem auth)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const admin = getAdminClient();

    // Validate token and get project
    const { data: project, error: projError } = await admin
      .from('support_projects')
      .select('id, is_active, organization_id, created_by')
      .eq('token', token)
      .single();

    if (projError || !project) {
      return NextResponse.json({ error: 'Projeto nao encontrado' }, { status: 404 });
    }

    if (!project.is_active) {
      return NextResponse.json({ error: 'Portal desativado' }, { status: 410 });
    }

    const body = await request.json();
    const { title, description, ticket_type, priority, category } = body;

    if (!title || title.trim().length < 3) {
      return NextResponse.json({ error: 'Titulo e obrigatorio (min 3 caracteres)' }, { status: 400 });
    }

    const validTypes = ['SUPORTE', 'TAREFA', 'BUG'];
    const validPriorities = ['URGENTE', 'ALTA', 'NORMAL', 'BAIXA'];
    const validCategories = ['ERRO', 'DUVIDA', 'MELHORIA', 'ENTREGA', 'CONFIGURACAO', 'GERAL'];

    // Lookup default SUPORTE pipeline and first stage
    const insertData: Record<string, any> = {
      organization_id: project.organization_id,
      project_id: project.id,
      title: title.trim().slice(0, 200),
      description: description?.trim()?.slice(0, 5000) || null,
      ticket_type: validTypes.includes(ticket_type) ? ticket_type : 'SUPORTE',
      priority: validPriorities.includes(priority) ? priority : 'NORMAL',
      category: validCategories.includes(category) ? category : 'GERAL',
      status: 'ABERTO',
      reported_by: project.created_by,
    };

    try {
      const { data: suportePipeline } = await admin
        .from('pipelines')
        .select('id')
        .eq('organization_id', project.organization_id)
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
      // Pipeline may not exist yet
    }

    const { data: ticket, error } = await admin
      .from('support_tickets')
      .insert(insertData)
      .select('id, title, status, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json(ticket, { status: 201 });
  } catch (error: any) {
    console.error('Error creating portal ticket:', error);
    return NextResponse.json({ error: 'Erro ao criar chamado' }, { status: 500 });
  }
}
