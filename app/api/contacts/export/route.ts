import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import * as XLSX from 'xlsx';

// GET /api/contacts/export - Exportar contatos como Excel
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
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const tipo = searchParams.get('tipo');
    const assigned = searchParams.get('assigned');

    let query = admin
      .from('contacts')
      .select('*')
      .eq('organization_id', profile.organization_id);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%`);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (tipo && tipo !== 'all') {
      query = query.contains('tipo', [tipo]);
    }
    if (assigned === 'me') {
      query = query.eq('assigned_to_user_id', user.id);
    } else if (assigned === 'unassigned') {
      query = query.is('assigned_to_user_id', null);
    }

    const { data: contacts, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const STATUS_LABELS: Record<string, string> = {
      NOVO: 'Novo', EM_PROSPECCAO: 'Em Prospecção', CONTATADO: 'Contatado',
      REUNIAO_MARCADA: 'Reunião Marcada', CONVERTIDO: 'Convertido', PERDIDO: 'Perdido',
    };

    const rows = (contacts || []).map((c) => ({
      Nome: c.name || '',
      Email: c.email || '',
      Telefone: c.phone || '',
      CPF: c.cpf || '',
      CNPJ: c.cnpj || '',
      Empresa: c.company || '',
      Tipo: (c.tipo || []).join(', '),
      Classe: c.classe || '',
      Status: STATUS_LABELS[c.status] || c.status,
      'Referência': c.referencia || '',
      'Contato Nome': c.contato_nome || '',
      Cargo: c.cargo || '',
      'Endereço': c.endereco || '',
      Cidade: c.cidade || '',
      Estado: c.estado || '',
      CEP: c.cep || '',
      Website: c.website || '',
      Instagram: c.instagram || '',
      WhatsApp: c.whatsapp || '',
      'Produtos Fornecidos': c.produtos_fornecidos || '',
      'Observações': c.notes || '',
      'Criado em': c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="contatos_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });

  } catch (error: any) {
    console.error('Error exporting contacts:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao exportar contatos' },
      { status: 500 }
    );
  }
}
