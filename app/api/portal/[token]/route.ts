import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/portal/[token] - Info publica do projeto (sem auth)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: 'Token obrigatorio' }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: project, error } = await admin
      .from('support_projects')
      .select('id, name, description, is_active, organization_id')
      .eq('token', token)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Projeto nao encontrado' }, { status: 404 });
    }

    if (!project.is_active) {
      return NextResponse.json({ error: 'Portal desativado', inactive: true }, { status: 410 });
    }

    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
    });
  } catch (error: any) {
    console.error('Error fetching portal info:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
