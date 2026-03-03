import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/reports/export - Export report data as CSV
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();
    const orgId = profile.organization_id;
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = searchParams.get('to') || new Date().toISOString().split('T')[0];

    const fromDate = `${from}T00:00:00`;
    const toDate = `${to}T23:59:59`;

    // Fetch contacts
    const { data: contacts } = await admin
      .from('contacts')
      .select('name, company, status, temperatura, origem, valor_estimado, assigned_to_user_id, lead_score, created_at')
      .eq('organization_id', orgId);

    // Fetch profiles for user names
    const { data: profiles } = await admin
      .from('profiles')
      .select('user_id, name')
      .eq('organization_id', orgId);

    const userMap = new Map((profiles || []).map((p: any) => [p.user_id, p.name]));

    // Build CSV
    const header = 'Nome,Empresa,Status,Temperatura,Origem,Valor Estimado,Lead Score,Responsavel,Criado em\n';
    const rows = (contacts || []).map((c) => {
      return [
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.company || '').replace(/"/g, '""')}"`,
        c.status,
        c.temperatura || '',
        c.origem || '',
        c.valor_estimado || 0,
        c.lead_score || '',
        `"${userMap.get(c.assigned_to_user_id || '') || ''}"`,
        c.created_at?.split('T')[0] || '',
      ].join(',');
    }).join('\n');

    const csv = header + rows;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=relatorio-${from}-${to}.csv`,
      },
    });
  } catch (error: any) {
    console.error('Error in report export:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
