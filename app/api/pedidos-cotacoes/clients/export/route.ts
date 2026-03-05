import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import * as XLSX from 'xlsx';
import { PC_CLIENT_STATUS_LABELS } from '@/lib/utils/labels';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status_sac = searchParams.get('status_sac');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');

    let query = admin
      .from('pc_clients')
      .select('*')
      .eq('organization_id', profile.organization_id);

    if (search) {
      query = query.ilike('fornecedor', `%${search}%`);
    }
    if (status_sac && status_sac !== 'all') {
      query = query.eq('status_sac', status_sac);
    }
    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to + 'T23:59:59');
    }

    const { data: clients, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (clients || []).map((c: any) => ({
      'Fornecedor': c.fornecedor || '',
      'CNPJ': c.cnpj || '',
      'Contato': c.contato || '',
      'Email': c.email || '',
      'Status SAC': PC_CLIENT_STATUS_LABELS[c.status_sac] || c.status_sac,
      'Filhos': c.filhos_count || 0,
      'Observacoes': c.notes || '',
      'Criado em': c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="clientes_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting pc_clients:', error);
    return NextResponse.json({ error: error.message || 'Erro ao exportar' }, { status: 500 });
  }
}
