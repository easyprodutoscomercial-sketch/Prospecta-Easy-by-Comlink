import { getAdminClient } from '@/lib/supabase/admin';

// Quem pode buscar indicacoes com IA e quantas buscas por dia (regra do dono em 06/10:
// so busca quem o admin liberar, inclusive o proprio admin; sem registro = 0 = bloqueado).
//
// Fica em ai_analysis_cache (uma linha por usuario, cache_key = user_id) porque nao
// temos acesso de DDL pra criar coluna em profiles — mesmo motivo dos rascunhos.

type Admin = ReturnType<typeof getAdminClient>;

export const TIPO_PERMISSAO = 'INDICACOES_IA_PERMISSAO';
export const MAX_BUSCAS_DIA = 20; // teto do campo na tela: cada busca custa ~R$1

export async function buscasPermitidas(admin: Admin, orgId: string, userId: string) {
  const { data } = await admin.from('ai_analysis_cache').select('result')
    .eq('organization_id', orgId).eq('analysis_type', TIPO_PERMISSAO).eq('cache_key', userId)
    .maybeSingle();
  const n = Number((data?.result as { buscas_dia?: number } | null)?.buscas_dia);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_BUSCAS_DIA) : 0;
}

export async function todasPermissoes(admin: Admin, orgId: string) {
  const { data } = await admin.from('ai_analysis_cache').select('cache_key, result')
    .eq('organization_id', orgId).eq('analysis_type', TIPO_PERMISSAO);
  const mapa: Record<string, number> = {};
  for (const r of data || []) mapa[r.cache_key] = Number((r.result as { buscas_dia?: number }).buscas_dia) || 0;
  return mapa;
}

export async function gravarPermissao(admin: Admin, orgId: string, userId: string, buscasDia: number, porQuem: string) {
  const result = { user_id: userId, buscas_dia: buscasDia, alterado_por: porQuem, alterado_em: new Date().toISOString() };
  const { data: atual } = await admin.from('ai_analysis_cache').select('id')
    .eq('organization_id', orgId).eq('analysis_type', TIPO_PERMISSAO).eq('cache_key', userId).maybeSingle();
  const { error } = atual
    ? await admin.from('ai_analysis_cache').update({ result }).eq('id', atual.id)
    : await admin.from('ai_analysis_cache').insert({
        organization_id: orgId, analysis_type: TIPO_PERMISSAO, cache_key: userId, result,
        expires_at: new Date(Date.now() + 3650 * 864e5).toISOString(),
      });
  return error?.message || null;
}
