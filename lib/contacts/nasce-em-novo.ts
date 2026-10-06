import { getAdminClient } from '@/lib/supabase/admin';

// Regra do dono (06/10): TODO contato nasce na coluna Novo, venha de onde vier —
// cadastro, rascunho, importacao, link de captura, quiz, check-in/avulso/stand de
// feira, indicacao da IA. Antes cada caminho escolhia a coluna pela configuracao da
// feira, do quiz ou do link (desde 03/10, 15 contatos nasceram fora do Novo), e o
// avulso de feira gravava a coluna da feira com status 'NOVO' — card numa coluna
// dizendo estar em outra. Depois de criado, o vendedor move normalmente.
//
// Sem acesso de DDL nao da pra fazer isso com trigger no banco: por isso todo
// insert em contacts passa por aqui (procure por nasceEmNovo ao criar caminho novo).

type Admin = ReturnType<typeof getAdminClient>;
type Etapa = { pipeline_id: string; stage_id: string; status: string };

const cache = new Map<string, Etapa | null>();

// primeira coluna (menor posicao, nao terminal) do funil do contato; sem funil,
// o funil padrao de vendas da empresa
export async function etapaNovo(admin: Admin, pipelineId: string | null | undefined, organizationId?: string | null): Promise<Etapa | null> {
  let pid = pipelineId || null;
  if (!pid && organizationId) {
    const { data } = await admin.from('pipelines').select('id')
      .eq('organization_id', organizationId).eq('pipeline_type', 'PADRAO').limit(1).maybeSingle();
    pid = data?.id || null;
  }
  if (!pid) return null;
  if (cache.has(pid)) return cache.get(pid)!;

  const { data: etapa } = await admin.from('pipeline_stages').select('id, slug')
    .eq('pipeline_id', pid).eq('is_terminal', false)
    .order('position', { ascending: true }).limit(1).maybeSingle();
  // contacts.status acompanha o slug da coluna em maiusculas ('novo' -> 'NOVO')
  const r = etapa ? { pipeline_id: pid, stage_id: etapa.id as string, status: String(etapa.slug || 'novo').toUpperCase() } : null;
  cache.set(pid, r);
  return r;
}

// devolve o contato (ou a lista) com coluna e status trocados para Novo
export async function nasceEmNovo<T extends Record<string, unknown>>(admin: Admin, linha: T): Promise<T>;
export async function nasceEmNovo<T extends Record<string, unknown>>(admin: Admin, linha: T[]): Promise<T[]>;
export async function nasceEmNovo<T extends Record<string, unknown>>(admin: Admin, linha: T | T[]): Promise<T | T[]> {
  if (Array.isArray(linha)) return Promise.all(linha.map((l) => nasceEmNovo(admin, l)));
  const e = await etapaNovo(admin, linha.pipeline_id as string | null, linha.organization_id as string | null);
  if (!e) return linha; // sem funil configurado: grava como veio (melhor que nao gravar)
  return { ...linha, pipeline_id: e.pipeline_id, stage_id: e.stage_id, status: e.status };
}
