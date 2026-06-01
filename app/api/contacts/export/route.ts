import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { applyContactFilters } from '@/lib/contacts/filters';
import * as XLSX from 'xlsx';

// GET /api/contacts/export - Exportar contatos como Excel
// Usa o mesmo applyContactFilters da listagem — antes divergia e
// planilha trazia descartados/rascunhos que a tela escondia.
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

    // Para non-admin, descobre pipelines permitidas (mesma logica da listagem)
    let allowedPipelineIds: string[] | null = null;
    if (profile.role !== 'admin') {
      const { data: myMemberships } = await admin
        .from('pipeline_members')
        .select('pipeline_id')
        .eq('user_id', user.id);
      allowedPipelineIds = (myMemberships || []).map((m: any) => m.pipeline_id);
    }

    let query = admin
      .from('contacts')
      .select('*')
      .eq('organization_id', profile.organization_id);

    query = applyContactFilters(query, {
      search: searchParams.get('search') || '',
      status: searchParams.get('status'),
      tipo: searchParams.get('tipo'),
      pipeline_id: searchParams.get('pipeline_id'),
      stage_id: searchParams.get('stage_id'),
      assigned: searchParams.get('assigned'),
      created_by: searchParams.get('created_by'),
      userId: user.id,
      allowedPipelineIds,
      temperatura: searchParams.get('temperatura'),
      origem: searchParams.get('origem'),
      classe: searchParams.get('classe'),
      cidade: searchParams.get('cidade'),
      estado: searchParams.get('estado'),
      telefone: searchParams.get('telefone'),
      cpf: searchParams.get('cpf'),
      cnpj: searchParams.get('cnpj'),
      whatsapp: searchParams.get('whatsapp'),
      empresa: searchParams.get('empresa'),
      referencia: searchParams.get('referencia'),
      contato_nome: searchParams.get('contato_nome'),
      cargo: searchParams.get('cargo'),
      endereco: searchParams.get('endereco'),
      cep: searchParams.get('cep'),
      website: searchParams.get('website'),
      instagram: searchParams.get('instagram'),
      proxima_acao_tipo: searchParams.get('proxima_acao_tipo'),
      produtos_fornecidos: searchParams.get('produtos_fornecidos'),
      event_id: searchParams.get('event_id'),
      draft_mode: (searchParams.get('drafts') === 'true' ? 'only' : searchParams.get('drafts') === 'all' ? 'all' : 'exclude'),
      inexistente_mode: (searchParams.get('descartados') === 'only' ? 'only' : searchParams.get('descartados') === 'all' ? 'all' : 'exclude'),
    });

    // Filtros antigos (temperatura, origem, telefone, cpf, etc) foram removidos —
    // todos ja estao em applyContactFilters acima. Era ~70 linhas duplicadas.

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
