// Diagnostica bug: "contatos da aba Contatos nao batem com a Pipeline".
// Read-only. Mede tamanho do problema com numeros reais.

import { loadSupabaseEnv } from './_lib/env.mjs';

const { SB_URL, HEADERS } = loadSupabaseEnv();

async function q(table, params) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers: HEADERS });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    console.error('ERR', table, r.status, txt.slice(0, 200));
    return [];
  }
  return r.json();
}

async function count(table, params) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}&select=id`, {
    headers: { ...HEADERS, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!r.ok) {
    console.error('COUNT ERR', table, r.status);
    return 0;
  }
  const range = r.headers.get('content-range') || '';
  const total = range.split('/')[1];
  return Number(total) || 0;
}

console.log('=== DIAGNOSTICO: /contacts vs /kanban ===\n');

// Org Josimar (achada via _find-active-org.mjs — unica com contatos ativos)
const orgId = '86727616-4004-4604-b21b-25e8400d271d';
const orgName = "Josimar Silva's Organization";
console.log(`Org: ${orgName} (${orgId.slice(0, 8)})\n`);

const orgFilter = `organization_id=eq.${orgId}`;

// ===================
// CONTAGEM TOTAL (espelha o /contacts com filtro 'all')
// ===================
console.log('--- /contacts (filtro: Todos Pipelines) ---');
const totalAtivos = await count('contacts', `${orgFilter}&is_draft=eq.false&inexistente=eq.false`);
console.log(`  Total ativos (is_draft=false, inexistente=false): ${totalAtivos}`);

// ===================
// PIPELINES da org
// ===================
console.log('\n--- Pipelines da org ---');
const pipelines = await q('pipelines', `${orgFilter}&select=id,name,pipeline_type,is_default&order=created_at.asc`);
for (const p of pipelines) {
  const c = await count(
    'contacts',
    `${orgFilter}&is_draft=eq.false&inexistente=eq.false&pipeline_id=eq.${p.id}`
  );
  const flags = [p.is_default ? 'DEFAULT' : '', p.pipeline_type !== 'PADRAO' ? p.pipeline_type : '']
    .filter(Boolean)
    .join(', ');
  console.log(`  ${p.name.padEnd(30)} ${c.toString().padStart(5)} contatos ${flags ? `[${flags}]` : ''}`);
}
console.log(`  TOTAL DE PIPELINES: ${pipelines.length}`);

// ===================
// CAUSA #1: Contatos SEM pipeline_id
// ===================
console.log('\n--- CAUSA #1: Contatos SEM pipeline_id (somem do kanban) ---');
const semPipeline = await count(
  'contacts',
  `${orgFilter}&is_draft=eq.false&inexistente=eq.false&pipeline_id=is.null`
);
console.log(`  Contatos ativos sem pipeline_id: ${semPipeline}`);
console.log(`  → Aparecem em /contacts (filtro 'all'), SOMEM no /kanban (qualquer pipeline)`);

// ===================
// CAUSA #2: Contatos em pipelines tipo SUPORTE (filtrado do contexto kanban)
// ===================
console.log('\n--- CAUSA #2: Contatos em pipeline tipo SUPORTE (filtrado do kanban) ---');
const suportePipelines = pipelines.filter((p) => p.pipeline_type === 'SUPORTE');
let suporteContacts = 0;
for (const p of suportePipelines) {
  const c = await count(
    'contacts',
    `${orgFilter}&is_draft=eq.false&inexistente=eq.false&pipeline_id=eq.${p.id}`
  );
  suporteContacts += c;
  console.log(`  ${p.name}: ${c} contatos`);
}
console.log(`  TOTAL em pipelines SUPORTE: ${suporteContacts}`);
console.log(`  → Pipeline-context filtra 'SUPORTE' do dropdown do kanban`);
console.log(`     Se vendedor tem contato so em pipeline SUPORTE, nao consegue ver no kanban`);

// ===================
// CAUSA #3: Contatos em colunas terminais (CONVERTIDO/PERDIDO)
// ===================
console.log('\n--- CAUSA #3: Contatos em colunas terminais (colapsadas por default) ---');
const stages = await q('pipeline_stages', `select=id,name,pipeline_id,is_terminal,terminal_type&pipeline_id=in.(${pipelines.map((p) => p.id).join(',')})`);
const terminalIds = stages.filter((s) => s.is_terminal).map((s) => s.id);
let totalTerminais = 0;
if (terminalIds.length > 0) {
  totalTerminais = await count(
    'contacts',
    `${orgFilter}&is_draft=eq.false&inexistente=eq.false&stage_id=in.(${terminalIds.join(',')})`
  );
}
console.log(`  Contatos ativos em colunas terminais: ${totalTerminais}`);
console.log(`  → Aparecem em /contacts, mas no /kanban ficam em colunas COLAPSADAS por default`);
console.log(`     Vendedor nao ve, acha que sumiram (sao CONVERTIDO/PERDIDO)`);

// ===================
// CAUSA #4: Contatos sem stage_id
// ===================
console.log('\n--- CAUSA #4: Contatos sem stage_id ---');
const semStage = await count(
  'contacts',
  `${orgFilter}&is_draft=eq.false&inexistente=eq.false&stage_id=is.null`
);
console.log(`  Contatos ativos sem stage_id: ${semStage}`);
console.log(`  → No kanban sao jogados no PRIMEIRO stage do pipeline (parecem 'NOVO')`);
console.log(`     Em /contacts aparecem com status real do banco`);

// ===================
// CAUSA #5: pipeline_members (filtragem por vendedor non-admin)
// ===================
console.log('\n--- CAUSA #5: pipeline_members (filtragem para non-admin) ---');
const profiles = await q('profiles', `${orgFilter}&select=user_id,name,role&order=created_at.asc`);
const pipelineMembers = await q('pipeline_members', `select=user_id,pipeline_id&pipeline_id=in.(${pipelines.map((p) => p.id).join(',')})`);
console.log(`  Total de profiles na org: ${profiles.length}`);
console.log(`  Total de memberships: ${pipelineMembers.length}`);
const naoAdmins = profiles.filter((p) => p.role !== 'admin');
console.log(`  Vendedores non-admin: ${naoAdmins.length}`);
for (const v of naoAdmins.slice(0, 10)) {
  const meusPipelines = pipelineMembers.filter((m) => m.user_id === v.user_id);
  console.log(`    ${(v.name || v.user_id.slice(0, 8)).padEnd(30)} role=${v.role.padEnd(10)} pipelines=${meusPipelines.length}`);
}
if (naoAdmins.length > 10) console.log(`    ... e mais ${naoAdmins.length - 10}`);
console.log(`  → Non-admin sem membership em NENHUM pipeline ve LISTA VAZIA em ambas`);
console.log(`     Mas se tem membership em 1 e nao em outro, ve diferente do esperado`);

// ===================
// CAUSA #6: Total > 10000 (limite hardcoded no kanban)
// ===================
console.log('\n--- CAUSA #6: Limite 10.000 do kanban ---');
const maiorPipeline = pipelines[0];
if (totalAtivos > 10000) {
  console.log(`  ⚠️ Org tem ${totalAtivos} contatos ativos > 10.000`);
  console.log(`     Kanban TRUNCA silenciosamente em 10.000 contatos`);
} else {
  console.log(`  OK — org tem ${totalAtivos} contatos < 10.000 (sem truncamento no kanban)`);
}

// ===================
// CAUSA #7: contatos rascunho (is_draft) — algum vendedor pode ter muitos
// ===================
console.log('\n--- BONUS: contagens auxiliares ---');
const rascunhos = await count('contacts', `${orgFilter}&is_draft=eq.true`);
const descartados = await count('contacts', `${orgFilter}&inexistente=eq.true`);
console.log(`  Rascunhos: ${rascunhos} (excluidos por default em /contacts e /kanban)`);
console.log(`  Descartados: ${descartados} (excluidos por default em /contacts e /kanban)`);
console.log(`  Total bruto na tabela: ${rascunhos + descartados + totalAtivos} (estimado)`);

// ===================
// FECHAMENTO: somar a divergencia
// ===================
console.log('\n=== RESUMO DA DIVERGENCIA POTENCIAL ===\n');
console.log(`  /contacts (filtro 'all') mostra:                         ${totalAtivos.toString().padStart(5)} contatos`);
console.log(`  /kanban (pipeline padrao, todas colunas) mostra:         ${(totalAtivos - semPipeline - suporteContacts).toString().padStart(5)} contatos`);
console.log(`  Diferenca causada por SUM(causas acima):                 ${(semPipeline + suporteContacts).toString().padStart(5)} contatos\n`);

console.log(`  Adicionalmente OCULTOS visualmente no kanban:`);
console.log(`    - Em colunas terminais (colapsadas):                   ${totalTerminais.toString().padStart(5)} contatos`);
console.log(`    - Sem stage_id (vao pra coluna NOVO disfarcados):      ${semStage.toString().padStart(5)} contatos\n`);

console.log('  Os numeros NAO BATEM porque:');
console.log('    1. /contacts mostra todos pipelines da org');
console.log('    2. /kanban mostra so 1 pipeline + esconde colunas terminais');
console.log('    3. Contatos sem pipeline_id ficam invisiveis no kanban');
console.log('    4. Pipelines SUPORTE somem do dropdown do kanban (mas estao em /contacts)\n');
