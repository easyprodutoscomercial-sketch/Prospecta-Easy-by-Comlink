import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/quiz/participantes — List participants (auth required)
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

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('date_from') || '';
    const dateTo = searchParams.get('date_to') || '';
    const diaParam = searchParams.get('dia') || '';
    const quizId = searchParams.get('quiz_id') || '';

    let query = admin
      .from('quiz_participantes')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (quizId) {
      query = query.eq('quiz_config_id', quizId);
    }
    if (diaParam) {
      query = query.eq('dia_feira', parseInt(diaParam));
    }

    if (search) {
      query = query.or(`nome.ilike.%${search}%,empresa.ilike.%${search}%,telefone.ilike.%${search}%`);
    }

    if (dateFrom) {
      query = query.gte('created_at', `${dateFrom}T00:00:00`);
    }
    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: participantes, error, count } = await query;

    if (error) {
      console.error('Error fetching participants:', error);
      return NextResponse.json({ error: 'Erro ao listar participantes' }, { status: 500 });
    }

    return NextResponse.json({
      participantes: participantes || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('Error fetching participants:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

// DELETE /api/quiz/participantes — Delete participants (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const admin = getAdminClient();
    const orgId = profile.organization_id;
    const diaParam = request.nextUrl.searchParams.get('dia');
    const quizId = request.nextUrl.searchParams.get('quiz_id');

    // Count before deleting
    let countQuery = admin
      .from('quiz_participantes')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);
    if (quizId) countQuery = countQuery.eq('quiz_config_id', quizId);
    if (diaParam) countQuery = countQuery.eq('dia_feira', parseInt(diaParam));
    const { count } = await countQuery;

    // Delete participants (filtered by quiz and day if specified)
    let deleteQuery = admin
      .from('quiz_participantes')
      .delete()
      .eq('organization_id', orgId);
    if (quizId) deleteQuery = deleteQuery.eq('quiz_config_id', quizId);
    if (diaParam) deleteQuery = deleteQuery.eq('dia_feira', parseInt(diaParam));
    const { error } = await deleteQuery;

    if (error) {
      console.error('Error deleting participants:', error);
      return NextResponse.json({ error: 'Erro ao deletar participantes' }, { status: 500 });
    }

    return NextResponse.json({ deleted: count || 0 });
  } catch (error: any) {
    console.error('Error deleting participants:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
