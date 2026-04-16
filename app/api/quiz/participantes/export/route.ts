import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/quiz/participantes/export — Export CSV (auth required)
export async function GET(request: NextRequest) {
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
    const orgId = profile.organization_id;
    const quizId = request.nextUrl.searchParams.get('quiz_id');

    let query = admin
      .from('quiz_participantes')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    if (quizId) query = query.eq('quiz_config_id', quizId);

    const { data: participantes, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Erro ao exportar' }, { status: 500 });
    }

    // Build CSV
    const header = 'Nome,Empresa,Telefone,Palpite,Evento,Data';
    const rows = (participantes || []).map((p: any) => {
      const date = new Date(p.created_at).toLocaleString('pt-BR');
      return `"${(p.nome || '').replace(/"/g, '""')}","${(p.empresa || '').replace(/"/g, '""')}","${(p.telefone || '').replace(/"/g, '""')}",${p.palpite},"${(p.evento_nome || '').replace(/"/g, '""')}","${date}"`;
    });

    const csv = [header, ...rows].join('\n');

    // Add BOM for Excel compatibility with accents
    const bom = '\uFEFF';
    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="quiz-participantes-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting participants:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
