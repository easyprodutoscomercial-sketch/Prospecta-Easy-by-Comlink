import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import * as XLSX from 'xlsx';
import { PC_COTACAO_RESPOSTA_LABELS } from '@/lib/utils/labels';

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
    const resposta = searchParams.get('resposta');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');

    let query = admin
      .from('pc_cotacoes')
      .select('*')
      .eq('organization_id', profile.organization_id);

    if (search) {
      query = query.or(`fornecedor.ilike.%${search}%,cotacao_numero.ilike.%${search}%`);
    }
    if (resposta && resposta !== 'all') {
      query = query.eq('resposta', resposta);
    }
    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to + 'T23:59:59');
    }

    const { data: cotacoes, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (cotacoes || []).map((c: any) => ({
      'Numero': c.cotacao_numero || '',
      'Nome': c.cotacao_nome || '',
      'Fornecedor': c.fornecedor || '',
      'CNPJ': c.cnpj || '',
      'Resposta': PC_COTACAO_RESPOSTA_LABELS[c.resposta] || c.resposta,
      'Valor': c.valor != null ? Number(c.valor) : '',
      'Prazo Entrega': c.prazo_entrega ? new Date(c.prazo_entrega).toLocaleDateString('pt-BR') : '',
      'Condicoes Pagamento': c.condicoes_pagamento || '',
      'Informe': c.informe || '',
      'Criado em': c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cotacoes');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="cotacoes_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting pc_cotacoes:', error);
    return NextResponse.json({ error: error.message || 'Erro ao exportar' }, { status: 500 });
  }
}
