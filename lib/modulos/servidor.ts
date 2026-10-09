import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { normalizarDesligados, type ChaveModulo } from './regras';

// Quais modulos estao desligados na empresa. Fica em ai_analysis_cache (uma linha
// por organizacao) porque nao temos acesso de DDL — mesmo motivo das permissoes da IA.
// Sem linha = DESLIGADOS_PADRAO (decisao do dono em 09/10/2026).

type Admin = ReturnType<typeof getAdminClient>;

export const TIPO_MODULOS = 'MODULOS_DESLIGADOS';
const CHAVE = 'org';

// cache(): o layout logado e o layout do modulo pedem na mesma requisicao -> 1 consulta so
export const modulosDesligados = cache(async (orgId: string): Promise<ChaveModulo[]> => {
  const { data, error } = await getAdminClient().from('ai_analysis_cache').select('result')
    .eq('organization_id', orgId).eq('analysis_type', TIPO_MODULOS).eq('cache_key', CHAVE)
    .maybeSingle();
  if (error) console.error('[modulos] leitura', error.message);
  return normalizarDesligados((data?.result as { desligados?: unknown } | null)?.desligados);
});

export async function gravarDesligados(admin: Admin, orgId: string, desligados: ChaveModulo[], porQuem: string) {
  const result = { desligados, alterado_por: porQuem, alterado_em: new Date().toISOString() };
  const { data: atual } = await admin.from('ai_analysis_cache').select('id')
    .eq('organization_id', orgId).eq('analysis_type', TIPO_MODULOS).eq('cache_key', CHAVE).maybeSingle();
  const { error } = atual
    ? await admin.from('ai_analysis_cache').update({ result }).eq('id', atual.id)
    : await admin.from('ai_analysis_cache').insert({
        organization_id: orgId, analysis_type: TIPO_MODULOS, cache_key: CHAVE, result,
        expires_at: new Date(Date.now() + 3650 * 864e5).toISOString(),
      });
  return error?.message || null;
}

/** Layout de pagina logada: modulo desligado manda pro Dashboard. */
export async function exigirModulo(chave: ChaveModulo) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await ensureProfile(supabase, user);
  if (profile && (await modulosDesligados(profile.organization_id)).includes(chave)) redirect('/dashboard');
}

/**
 * Link publico (quiz, portal, captura, ficha de visitante): descobre a empresa pelo
 * token e diz se o modulo esta ligado. Token que nao existe passa: a propria pagina
 * ja mostra "nao encontrado".
 */
export async function moduloPublicoLigado(chave: ChaveModulo, tabela: string, coluna: string, valor: string) {
  const { data } = await getAdminClient().from(tabela).select('organization_id').eq(coluna, valor).maybeSingle();
  const orgId = (data as { organization_id?: string } | null)?.organization_id;
  if (!orgId) return true;
  return !(await modulosDesligados(orgId)).includes(chave);
}
