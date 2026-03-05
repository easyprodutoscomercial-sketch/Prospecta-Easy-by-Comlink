import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextResponse } from 'next/server';

const CLIENTS_DATA = [
  { fornecedor: 'Tracbel Agro', cnpj: '03.258.870/0001-53', cnpj_digits: '03258870000153', notes: 'Fornece para Agricana' },
  { fornecedor: 'Jonh Deere Brasil', cnpj: '89.674.782/0017-15', cnpj_digits: '89674782001715', notes: 'Fornece para Agricana' },
  { fornecedor: 'TerraVerde', cnpj: '09.282.594/0001-45', cnpj_digits: '09282594000145', notes: 'Fornece para Agricana' },
  { fornecedor: 'Retipeças Baurus', cnpj: '02.746.723/0001-60', cnpj_digits: '02746723000160', notes: 'Fornece para Agricana' },
  { fornecedor: 'Verde Cana', cnpj: '49.686.416/0001-02', cnpj_digits: '49686416000102', notes: 'Fornece para Agricana' },
  { fornecedor: 'Terra Verde (filial 1)', cnpj: '09.282.594/0002-26', cnpj_digits: '09282594000226', notes: 'Fornece para Agricana e Tecnocana' },
  { fornecedor: 'Terra Verde (filial 2)', cnpj: '09.282.594/0022-70', cnpj_digits: '09282594002270', notes: 'Fornece para Agricana e Tecnocana' },
  { fornecedor: 'Minas Verde (casa da vaca)', cnpj: '02.541.934/0001-66', cnpj_digits: '02541934000166', notes: 'Fornece para Agricana' },
  { fornecedor: 'Coopercitrus', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Parceagro', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Forte & Fertil', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Agrogalaxy', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'PneusTok', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Pneustore', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Campneus', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Coplacana', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'CAMDA', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Cimoagro', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Nikkeypar', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Construmarques', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Casa dos Abrasivos', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Bayer S.A', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Termolar', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Serv Agro', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Epis Online Comercio', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'LR COMERCIO', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Protektus', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'DALSON EQUIPAMENTOS', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'FERRAGENS SÃO CARLOS', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana e Tecnocana' },
  { fornecedor: 'LOJA DO CAFEICULTOR', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Irimag', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Canal Agrícola', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Casa da Borracha Marília', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Comercial Jauense', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'ALAGRO TECN AGRICOLA', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'DSR', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Casa da Borracha Bauru', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Casa da Borracha Botucatu', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'COMERCIAL DEVIDES', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'DALSON EQUIPAMENTOS DE PROTEÇÃO', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'TEKNOLUVAS', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'RCD CONEXOES', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Hidrara', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana e Tecnocana' },
  { fornecedor: 'APOIOTEC', cnpj: null, cnpj_digits: null, notes: 'Fornece para Agricana' },
  { fornecedor: 'Clube da Borracha', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Dpaschoal', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'HC Pneus', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Distribuidora Pneutop', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Zagar', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Grupo Ferragista', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Auto Pecas Romolar', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Casa do Oleo Ribeirão Preto', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Bandeirantes Bauru', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Onofre Barbosa', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Casa do Oleo', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'NetPosto', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'All Shine', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Piatã', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Petroposhe', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Sil Soluções em Lubr', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Geomaq', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'Racine Tratores', cnpj: null, cnpj_digits: null, notes: 'Fornece para Tecnocana' },
  { fornecedor: 'TESTE COMLINK', cnpj: null, cnpj_digits: null, notes: 'Fornece para Comlink' },
];

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const orgId = profile.organization_id;
    const userId = user.id;

    // Limpa clientes existentes
    await admin.from('pc_clients').delete().eq('organization_id', orgId);

    // Insere todos os clientes
    const rows = CLIENTS_DATA.map((c) => ({
      organization_id: orgId,
      fornecedor: c.fornecedor,
      cnpj: c.cnpj,
      cnpj_digits: c.cnpj_digits,
      notes: c.notes,
      status_sac: 'PRE_CADASTRO' as const,
      created_by: userId,
    }));

    const { error } = await admin.from('pc_clients').insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      clients_created: rows.length,
    });
  } catch (error: any) {
    console.error('Seed clients error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
