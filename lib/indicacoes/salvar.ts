import { getAdminClient } from '@/lib/supabase/admin';
import { normalizeContactData } from '@/lib/utils/normalize';
import { EmpresaIndicada } from '@/lib/indicacoes/osm';
import { nasceEmNovo } from '@/lib/contacts/nasce-em-novo';

export const PIPELINE_PADRAO = 'ca0488f4-ae6d-4ce7-bc34-0afeeeb4a521';
export const ETAPA_NOVO = '66e2a4dc-b694-42f9-9d3e-0674c0d9e31e';

// vem do mapa (EmpresaIndicada) ou da IA (EmpresaIA, com mais campos)
export type EmpresaParaSalvar = EmpresaIndicada & Partial<Record<
  'razao_social' | 'cnpj' | 'segmento' | 'descricao' | 'whatsapp' | 'email' | 'instagram' |
  'bairro' | 'estado' | 'cep' | 'fonte' | 'motivo' | 'porte' | 'porte_indicio',
  string | null
>> & { nota?: number | null; porteConfirmado?: boolean };

// Grava uma empresa indicada como contato.
// rascunho=true: fica salva no banco, atribuida a quem buscou, mas FORA do funil
// (rascunho nao aparece em kanban, listagem, relatorio nem lead score — so na aba
// Rascunhos). Quem quiser trabalha-la joga pro funil, que vira is_draft=false.
export async function salvarComoContato(
  admin: ReturnType<typeof getAdminClient>,
  opcoes: {
    organizationId: string;
    userId: string;
    referencia: { name: string; company: string | null; cidade: string | null; estado: string | null; segmento: string | null };
    empresa: EmpresaParaSalvar;
    rascunho: boolean;
  }
): Promise<{ id: string | null; erro: string | null }> {
  const { empresa: e, referencia: ref } = opcoes;
  const veioDaIA = !!e.fonte;
  const endereco = [e.endereco, e.bairro].filter(Boolean).join(' - ') || null;
  const nota = [
    `Indicação a partir de ${ref.name}${ref.company && ref.company !== ref.name ? ` (${ref.company})` : ''}.`,
    veioDaIA ? `Fonte: pesquisa com IA na internet (${e.fonte}). Confira os dados antes de ligar.` : 'Fonte: OpenStreetMap.',
    e.nota != null ? `Nota da IA: ${e.nota}/10${e.motivo ? ` — ${e.motivo}` : ''}` : '',
    e.razao_social ? `Razão social: ${e.razao_social}.` : '',
    veioDaIA ? (e.porteConfirmado ? `Porte na Receita: ${e.porte}.` : 'Porte não confirmado na Receita.') : '',
    e.porte_indicio ? `Indício de porte: ${e.porte_indicio}` : '',
    e.descricao ? `O que faz: ${e.descricao}` : '',
  ].filter(Boolean).join('\n');

  // normalizeContactData preenche phone_normalized/email_normalized/cnpj_digits:
  // sem eles o indice unico nao enxergava duplicata
  const dados = normalizeContactData({
    name: e.nome,
    company: e.nome,
    phone: e.telefone,
    whatsapp: e.whatsapp,
    email: e.email,
    cnpj: e.cnpj,
    website: e.site,
    instagram: e.instagram,
    endereco,
    cidade: e.cidade || ref.cidade,
    estado: e.estado || ref.estado,
    cep: e.cep,
    segmento: e.segmento || ref.segmento,
    notes: nota,
  });

  const { data, error } = await admin.from('contacts').insert(await nasceEmNovo(admin, {
    ...dados,
    organization_id: opcoes.organizationId,
    status: 'NOVO',
    stage_id: ETAPA_NOVO,
    pipeline_id: PIPELINE_PADRAO,
    assigned_to_user_id: opcoes.userId,
    created_by_user_id: opcoes.userId,
    origem: 'INDICACAO',
    is_draft: opcoes.rascunho,
    updated_at: new Date().toISOString(),
  })).select('id').single();

  if (error) {
    console.warn('[indicacoes] nao salvou', e.nome, error.message);
    return { id: null, erro: error.message };
  }
  return { id: data.id, erro: null };
}
