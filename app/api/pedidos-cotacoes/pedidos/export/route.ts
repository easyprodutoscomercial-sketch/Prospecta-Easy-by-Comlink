import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import * as XLSX from 'xlsx';
import { PC_PEDIDO_SITUACAO_LABELS } from '@/lib/utils/labels';

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
    const situacao = searchParams.get('situacao');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');

    let query = admin
      .from('pc_pedidos')
      .select('*')
      .eq('organization_id', profile.organization_id);

    if (search) {
      query = query.or(`empresa.ilike.%${search}%,pedido_numero.ilike.%${search}%`);
    }
    if (situacao && situacao !== 'all') {
      query = query.eq('situacao', situacao);
    }
    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to + 'T23:59:59');
    }

    const { data: pedidos, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (pedidos || []).map((p: any) => ({
      'Numero': p.pedido_numero || '',
      'Empresa': p.empresa || '',
      'Situacao': PC_PEDIDO_SITUACAO_LABELS[p.situacao] || p.situacao,
      'Finalizado': p.finalizado ? 'Sim' : 'Nao',
      'Valor': p.valor != null ? Number(p.valor) : '',
      'Prazo Entrega': p.prazo_entrega ? new Date(p.prazo_entrega).toLocaleDateString('pt-BR') : '',
      'Condicoes Pagamento': p.condicoes_pagamento || '',
      'Informe': p.informe || '',
      'Criado em': p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '',
      'Finalizado em': p.finalizado_at ? new Date(p.finalizado_at).toLocaleDateString('pt-BR') : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="pedidos_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting pc_pedidos:', error);
    return NextResponse.json({ error: error.message || 'Erro ao exportar' }, { status: 500 });
  }
}
