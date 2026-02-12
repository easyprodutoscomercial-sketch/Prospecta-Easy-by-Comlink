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

    const temperatura = searchParams.get('temperatura');
    if (temperatura && temperatura !== 'all') {
      query = query.eq('temperatura', temperatura);
    }
    const origem = searchParams.get('origem');
    if (origem && origem !== 'all') {
      query = query.eq('origem', origem);
    }
    const classe = searchParams.get('classe');
    if (classe && classe !== 'all') {
      query = query.eq('classe', classe);
    }
    const cidade = searchParams.get('cidade');
    if (cidade) {
      query = query.ilike('cidade', `%${cidade}%`);
    }
    const estado = searchParams.get('estado');
    if (estado && estado !== 'all') {
      query = query.eq('estado', estado);
    }
    const telefone = searchParams.get('telefone');
    if (telefone) {
      query = query.ilike('phone', `%${telefone}%`);
    }
    const cpf = searchParams.get('cpf');
    if (cpf) { query = query.ilike('cpf', `%${cpf}%`); }
    const cnpj = searchParams.get('cnpj');
    if (cnpj) { query = query.ilike('cnpj', `%${cnpj}%`); }
    const whatsapp = searchParams.get('whatsapp');
    if (whatsapp) { query = query.ilike('whatsapp', `%${whatsapp}%`); }
    const empresa = searchParams.get('empresa');
    if (empresa) { query = query.ilike('company', `%${empresa}%`); }
    const referencia = searchParams.get('referencia');
    if (referencia) { query = query.ilike('referencia', `%${referencia}%`); }
    const contato_nome = searchParams.get('contato_nome');
    if (contato_nome) { query = query.ilike('contato_nome', `%${contato_nome}%`); }
    const cargo = searchParams.get('cargo');
    if (cargo) { query = query.ilike('cargo', `%${cargo}%`); }
    const endereco = searchParams.get('endereco');
    if (endereco) { query = query.ilike('endereco', `%${endereco}%`); }
    const cep = searchParams.get('cep');
    if (cep) { query = query.ilike('cep', `%${cep}%`); }
    const website = searchParams.get('website');
    if (website) { query = query.ilike('website', `%${website}%`); }
    const instagram = searchParams.get('instagram');
    if (instagram) { query = query.ilike('instagram', `%${instagram}%`); }
    const proxima_acao_tipo = searchParams.get('proxima_acao_tipo');
    if (proxima_acao_tipo && proxima_acao_tipo !== 'all') { query = query.eq('proxima_acao_tipo', proxima_acao_tipo); }
    const produtos_fornecidos = searchParams.get('produtos_fornecidos');
    if (produtos_fornecidos) { query = query.ilike('produtos_fornecidos', `%${produtos_fornecidos}%`); }

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
