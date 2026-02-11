import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { pipelineSettingsSchema } from '@/lib/utils/validation';

const DEFAULT_SETTINGS = {
  columns: {
    NOVO: { label: 'Novo', color: '#a3a3a3' },
    EM_PROSPECCAO: { label: 'Em Prospecção', color: '#f59e0b' },
    CONTATADO: { label: 'Contatado', color: '#3b82f6' },
    REUNIAO_MARCADA: { label: 'Reunião Marcada', color: '#22c55e' },
    CONVERTIDO: { label: 'Convertido', color: '#10b981' },
    PERDIDO: { label: 'Perdido', color: '#ef4444' },
  },
};

// GET /api/pipeline-settings
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const admin = getAdminClient();

    const { data: org } = await admin
      .from('organizations')
      .select('pipeline_settings')
      .eq('id', profile.organization_id)
      .single();

    const settings = org?.pipeline_settings && Object.keys(org.pipeline_settings).length > 0
      ? org.pipeline_settings
      : DEFAULT_SETTINGS;

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Error fetching pipeline settings:', error);
    return NextResponse.json({ error: error.message || 'Erro ao buscar configurações' }, { status: 500 });
  }
}

// PUT /api/pipeline-settings
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem alterar configurações do pipeline' }, { status: 403 });
    }

    const admin = getAdminClient();
    const body = await request.json();
    const validated = pipelineSettingsSchema.parse(body);

    const { error } = await admin
      .from('organizations')
      .update({ pipeline_settings: validated })
      .eq('id', profile.organization_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating pipeline settings:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados inválidos', details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: error.message || 'Erro ao salvar configurações' }, { status: 500 });
  }
}
