// Helper pra excluir contatos do Quiz Feira das visualizacoes da feira.
//
// Regra do dono (2026-04-30): Quiz e captacao COLETIVA via QR publico —
// ninguem "capturou" individualmente. Por isso esses contatos:
//   - nao contam no ranking de vendedor (filtrado em /sellers/route.ts)
//   - nao aparecem na aba Contatos do evento, Dashboard, Live, Relatorio,
//     Export — telas onde o foco e ver o trabalho dos vendedores.
//
// Continuam aparecendo nas telas globais (/contacts, /kanban, /pipeline)
// — quiz e marketing valido, so nao deve poluir a "visualizacao da feira".

/**
 * Retorna Set com os contact_id de TODOS os participantes do quiz feira
 * da organizacao. Usado pra `id NOT IN (quizContactIds)` nos endpoints da
 * feira em memoria (PostgREST nao suporta NOT IN com subquery direto).
 */
export async function getQuizContactIds(
  admin: any,
  organizationId: string
): Promise<Set<string>> {
  const { data, error } = await admin
    .from('quiz_participantes')
    .select('contact_id')
    .eq('organization_id', organizationId)
    .not('contact_id', 'is', null);

  if (error) {
    console.warn('[quiz-filter] erro ao buscar quiz_participantes:', error.message);
    return new Set();
  }

  return new Set((data || []).map((p: any) => p.contact_id).filter(Boolean));
}
