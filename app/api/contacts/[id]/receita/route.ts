import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import {
  buscarDadosReceita, limparCnpj, formatarCnpj, cnpjValido,
  CnpjNaoEncontrado, DadosReceita,
} from '@/lib/receita/cnpj';

// GET  /api/contacts/:id/receita  -> consulta a Receita pelo CNPJ ja cadastrado
// POST /api/contacts/:id/receita  -> o vendedor informa o CNPJ; salva e consulta na hora
//
// Em ambos os casos so sao preenchidos os campos VAZIOS do contato.
// Nada que uma pessoa digitou e sobrescrito.

const CAMPOS_SELECT =
  'id, organization_id, cnpj, cnpj_digits, company, endereco, cidade, estado, cep, phone, email, contato_nome, cargo';

const PREENCHIVEIS: { campo: string; rotulo: string; valor: (d: DadosReceita) => string | null }[] = [
  { campo: 'company',  rotulo: 'Empresa',  valor: (d) => d.razao_social },
  { campo: 'endereco', rotulo: 'Endereco', valor: (d) => d.endereco_completo },
  { campo: 'cidade',   rotulo: 'Cidade',   valor: (d) => d.municipio },
  { campo: 'estado',   rotulo: 'Estado',   valor: (d) => d.uf },
  { campo: 'cep',      rotulo: 'CEP',      valor: (d) => d.cep },
  { campo: 'phone',    rotulo: 'Telefone', valor: (d) => d.telefone },
  { campo: 'email',    rotulo: 'Email',    valor: (d) => d.email },
  { campo: 'contato_nome', rotulo: 'Nome do contato', valor: (d) => socioPrincipal(d)?.nome ?? null },
  { campo: 'cargo',        rotulo: 'Cargo',           valor: (d) => socioPrincipal(d)?.qualificacao ?? null },
];

function socioPrincipal(d: DadosReceita) {
  if (!d.socios.length) return null;
  const admin = d.socios.find((s) => /administrador|presidente|diretor/i.test(s.qualificacao || ''));
  return admin || d.socios[0];
}

function vazio(v: unknown) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

async function autorizar(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'Nao autorizado' }, { status: 401 }) };

  const profile = await ensureProfile(supabase, user);
  if (!profile) return { erro: NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 }) };

  const admin = getAdminClient();
  const { data: contato, error } = await admin.from('contacts').select(CAMPOS_SELECT).eq('id', id).single();
  if (error || !contato) return { erro: NextResponse.json({ error: 'Contato nao encontrado' }, { status: 404 }) };
  if (contato.organization_id !== profile.organization_id) {
    return { erro: NextResponse.json({ error: 'Nao autorizado' }, { status: 403 }) };
  }
  return { admin, contato: contato as Record<string, unknown> };
}

// consulta a Receita e preenche os campos vazios; devolve o corpo da resposta pronto
async function consultarEPreencher(
  admin: ReturnType<typeof getAdminClient>,
  contato: Record<string, unknown>,
  cnpj: string,
  extras: Record<string, string> = {}
) {
  let dados: DadosReceita;
  try {
    dados = await buscarDadosReceita(cnpj);
  } catch (e) {
    if (Object.keys(extras).length > 0) {
      await admin.from('contacts').update({ ...extras, updated_at: new Date().toISOString() }).eq('id', contato.id as string);
    }
    if (e instanceof CnpjNaoEncontrado) {
      return NextResponse.json({ dados: null, atualizados: [], erro: e.message });
    }
    return NextResponse.json({
      dados: null, atualizados: [],
      erro: 'As consultas gratuitas da Receita estao no limite agora. Tente de novo em um minuto.',
    });
  }

  const mudancas: Record<string, string> = { ...extras };
  const atualizados: string[] = [];
  for (const p of PREENCHIVEIS) {
    const novo = p.valor(dados);
    if (!vazio(novo) && vazio(contato[p.campo])) {
      mudancas[p.campo] = String(novo);
      atualizados.push(p.rotulo);
    }
  }

  if (Object.keys(mudancas).length > 0) {
    const { error } = await admin
      .from('contacts')
      .update({ ...mudancas, updated_at: new Date().toISOString() })
      .eq('id', contato.id as string);
    if (error) return NextResponse.json({ dados, atualizados: [], erro: 'Nao consegui salvar os campos preenchidos.' });
  }

  return NextResponse.json({ dados, atualizados });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await autorizar(id);
    if (auth.erro) return auth.erro;
    const { admin, contato } = auth;

    const cnpj = limparCnpj((contato.cnpj_digits as string) || (contato.cnpj as string));
    if (!cnpj) return NextResponse.json({ sem_cnpj: true, dados: null, atualizados: [] });

    return await consultarEPreencher(admin, contato, cnpj);
  } catch (e) {
    console.error('[receita GET]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await autorizar(id);
    if (auth.erro) return auth.erro;
    const { admin, contato } = auth;

    const body = await request.json().catch(() => ({}));
    const informado = limparCnpj(body?.cnpj);

    if (!informado) {
      return NextResponse.json({ erro: 'Informe os 14 digitos do CNPJ.', dados: null, atualizados: [] }, { status: 400 });
    }
    if (!cnpjValido(informado)) {
      return NextResponse.json({ erro: 'Esse CNPJ nao existe (digitos verificadores nao batem). Confira o numero.', dados: null, atualizados: [] }, { status: 400 });
    }

    // grava o CNPJ junto com o resultado da consulta, numa operacao so
    return await consultarEPreencher(admin, contato, informado, {
      cnpj: formatarCnpj(informado),
      cnpj_digits: informado,
    });
  } catch (e) {
    console.error('[receita POST]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
