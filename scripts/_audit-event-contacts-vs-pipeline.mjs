// Verifica se TODOS os contatos do evento estao na pipeline.
// Read-only. Mostra contatos da feira que NAO estao em pipeline e por que.

import { loadSupabaseEnv } from './_lib/env.mjs';

const { SB_URL, HEADERS } = loadSupabaseEnv();
const EVENT_ID = '0e331665-e083-429c-9fae-9e67888a9a80';

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
  if (!r.ok) return 0;
  const range = r.headers.get('content-range') || '';
  return Number(range.split('/')[1]) || 0;
}

console.log('=== AUDITORIA: contatos da feira vs pipeline ===\n');

// 1. Info do evento
const events = await q('events', `id=eq.${EVENT_ID}&select=id,name,status,pipeline_id,stage_id,organization_id`);
if (events.length === 0) {
  console.error('Evento nao encontrado');
  process.exit(1);
}
const ev = events[0];
console.log(`Evento: ${ev.name} (${ev.status})`);
console.log(`  pipeline_id default: ${ev.pipeline_id || 'NENHUM'}`);
console.log(`  stage_id default:    ${ev.stage_id || 'NENHUM'}`);
console.log(`  org_id:              ${ev.organization_id}\n`);

// 2. Contagens base
const totalRaw = await count('contacts', `event_id=eq.${EVENT_ID}`);
const totalAtivos = await count('contacts', `event_id=eq.${EVENT_ID}&is_draft=eq.false&inexistente=eq.false`);
const draft = await count('contacts', `event_id=eq.${EVENT_ID}&is_draft=eq.true`);
const descartado = await count('contacts', `event_id=eq.${EVENT_ID}&inexistente=eq.true`);
console.log('--- Contatos do evento (todos) ---');
console.log(`  Total bruto na tabela:               ${totalRaw}`);
console.log(`  Ativos (is_draft=F, inexistente=F):  ${totalAtivos}`);
console.log(`  Rascunhos (is_draft=true):           ${draft}`);
console.log(`  Descartados (inexistente=true):      ${descartado}`);

// 3. Quantos NAO estao em pipeline
const semPipelineAtivos = await count('contacts', `event_id=eq.${EVENT_ID}&is_draft=eq.false&inexistente=eq.false&pipeline_id=is.null`);
const semStageAtivos = await count('contacts', `event_id=eq.${EVENT_ID}&is_draft=eq.false&inexistente=eq.false&stage_id=is.null`);
console.log('\n--- Contatos ATIVOS do evento sem pipeline/stage ---');
console.log(`  Sem pipeline_id:  ${semPipelineAtivos}  ← SOMEM do kanban`);
console.log(`  Sem stage_id:     ${semStageAtivos}  ← caem no primeiro stage no kanban`);

// 4. Distribuicao por pipeline
console.log('\n--- Distribuicao por pipeline (so contatos ativos) ---');
const all = await q(
  'contacts',
  `event_id=eq.${EVENT_ID}&is_draft=eq.false&inexistente=eq.false&select=id,pipeline_id,stage_id&limit=10000`
);
const pipelineCounts = {};
for (const c of all) {
  const k = c.pipeline_id || 'NULL';
  pipelineCounts[k] = (pipelineCounts[k] || 0) + 1;
}
const pipelineIds = Object.keys(pipelineCounts).filter((k) => k !== 'NULL');
const pipelineNames = {};
if (pipelineIds.length > 0) {
  const ps = await q('pipelines', `id=in.(${pipelineIds.join(',')})&select=id,name,pipeline_type`);
  for (const p of ps) pipelineNames[p.id] = `${p.name}${p.pipeline_type !== 'PADRAO' ? ` [${p.pipeline_type}]` : ''}`;
}
for (const [pid, c] of Object.entries(pipelineCounts).sort((a, b) => b[1] - a[1])) {
  const name = pid === 'NULL' ? '(sem pipeline)' : (pipelineNames[pid] || `desconhecido ${pid.slice(0, 8)}`);
  const flag = pid === ev.pipeline_id ? ' ← pipeline default da feira' : '';
  console.log(`  ${c.toString().padStart(5)}  ${name}${flag}`);
}

// 5. Quem sao os "sem pipeline" (amostra)
if (semPipelineAtivos > 0) {
  console.log('\n--- Amostra dos sem pipeline (max 10) ---');
  const orfos = await q(
    'contacts',
    `event_id=eq.${EVENT_ID}&is_draft=eq.false&inexistente=eq.false&pipeline_id=is.null&select=id,name,company,phone,created_at,origem,assigned_to_user_id&limit=10&order=created_at.desc`
  );
  for (const o of orfos) {
    console.log(`  ${o.created_at.slice(0, 10)} | ${(o.name || '(sem nome)').padEnd(35)} | ${(o.company || '').padEnd(25)} | origem=${o.origem || '-'} | assigned=${o.assigned_to_user_id ? 'SIM' : 'NAO'}`);
  }
}

// 6. Verifica contatos do quiz (que ficam com created_by_user_id NULL)
console.log('\n--- Contatos do quiz da feira (separadamente) ---');
const quizParts = await q(
  'quiz_participantes',
  `select=contact_id&limit=5000`
);
const quizContactIds = new Set(quizParts.map((p) => p.contact_id).filter(Boolean));
const allContactIds = new Set(all.map((c) => c.id));
let quizDoEventoComPipeline = 0;
let quizDoEventoSemPipeline = 0;
for (const c of all) {
  if (quizContactIds.has(c.id)) {
    if (c.pipeline_id) quizDoEventoComPipeline++;
    else quizDoEventoSemPipeline++;
  }
}
console.log(`  Contatos da feira que vieram do quiz: ${quizDoEventoComPipeline + quizDoEventoSemPipeline}`);
console.log(`    Em pipeline:    ${quizDoEventoComPipeline}`);
console.log(`    Sem pipeline:   ${quizDoEventoSemPipeline}`);

// 7. Conclusao
console.log('\n=== CONCLUSAO ===\n');
const okPercent = totalAtivos > 0 ? Math.round(((totalAtivos - semPipelineAtivos) / totalAtivos) * 100) : 0;
console.log(`  ${totalAtivos - semPipelineAtivos} de ${totalAtivos} contatos da feira ESTAO em pipeline (${okPercent}%)`);
if (semPipelineAtivos === 0) {
  console.log('  ✅ TODOS os contatos ativos da feira tem pipeline_id setado.');
  console.log('     Aparecem no kanban se vendedor selecionar o pipeline correto.');
} else {
  console.log(`  ❌ ${semPipelineAtivos} contatos ativos da feira NAO TEM pipeline_id`);
  console.log('     Esses contatos aparecem em /contacts mas SOMEM do kanban.');
}
