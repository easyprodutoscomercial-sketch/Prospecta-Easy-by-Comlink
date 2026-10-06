import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

export type ContatoReferencia = {
  id: string; organization_id: string; name: string; company: string | null;
  cidade: string | null; estado: string | null; segmento: string | null; pipeline_id: string | null;
  // o resto do cadastro: a busca com IA usa tudo que estiver preenchido
  tipo: string[] | null; produtos_fornecidos: string | null; referencia: string | null; classe: string | null;
  notes: string | null; website: string | null; cnpj: string | null; cep: string | null; endereco: string | null;
  cargo: string | null; instagram: string | null; temperatura: string | null; valor_estimado: number | null;
  assigned_to_user_id: string | null;
  status: string | null; // coluna atual ('NOVO' = coluna Novo)
};

export const CAMPOS_CONTATO_REFERENCIA =
  'id, organization_id, name, company, cidade, estado, segmento, pipeline_id, tipo, produtos_fornecidos, ' +
  'referencia, classe, notes, website, cnpj, cep, endereco, cargo, instagram, temperatura, valor_estimado, assigned_to_user_id, status';

// Sessao + contato da mesma empresa do usuario. Compartilhado pelas rotas de indicacao.
export async function contexto(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: 'Nao autorizado' }, { status: 401 }) };

  const profile = await ensureProfile(supabase, user);
  if (!profile) return { erro: NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 }) };

  const admin = getAdminClient();
  const { data } = await admin
    .from('contacts')
    .select(CAMPOS_CONTATO_REFERENCIA)
    .eq('id', id)
    .single();
  // select com string montada perde a tipagem do supabase-js
  const contato = data as unknown as ContatoReferencia | null;

  if (!contato) return { erro: NextResponse.json({ error: 'Contato nao encontrado' }, { status: 404 }) };
  if (contato.organization_id !== profile.organization_id) {
    return { erro: NextResponse.json({ error: 'Nao autorizado' }, { status: 403 }) };
  }
  return { admin, contato, profile };
}
