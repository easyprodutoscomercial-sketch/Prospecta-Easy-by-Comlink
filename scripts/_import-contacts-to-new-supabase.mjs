// Importa contatos do CSV exportado do banco antigo pro banco novo.
// Preserva UUIDs originais. Cria org/pipelines/stages/events extraidos do proprio CSV.
// assigned_to/created_by ficam NULL (vendedores serao recriados ao logarem).

import { readFileSync } from 'fs';
import XLSX from 'xlsx';

const SBP = process.env.SBP_TOKEN || '';
const REF = 'otemsbhhtygjwokvxlir';
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const CSV = 'C:/Users/josimar.silva/Downloads/Supabase Snippet Add Cover Image URL to Events (2).csv';

async function runSQL(query, label) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SBP}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await r.text();
  if (!r.ok) {
    console.error(`❌ ${label}: HTTP ${r.status} — ${body.slice(0, 300)}`);
    return false;
  }
  return true;
}

function sqlString(v) {
  if (v === null || v === undefined || v === '' || v === 'null') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}
function sqlUuid(v) {
  if (!v || v === 'null') return 'NULL';
  return `'${v}'::uuid`;
}
function sqlBool(v) {
  if (v === 'true' || v === true) return 'true';
  return 'false';
}
function sqlNumber(v) {
  if (v === null || v === undefined || v === '' || v === 'null') return 'NULL';
  const n = Number(v);
  return isNaN(n) ? 'NULL' : String(n);
}
function sqlDate(v) {
  // "15/04/2026 08:50" -> "2026-04-15 08:50"
  if (!v || v === 'null') return 'NULL';
  const m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return 'NULL';
  return `'${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}'::timestamptz`;
}
function sqlDateOnly(v) {
  if (!v || v === 'null') return 'NULL';
  const m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return 'NULL';
  return `'${m[3]}-${m[2]}-${m[1]}'::date`;
}
function sqlTipoArray(v) {
  if (!v || v === 'null') return 'NULL';
  const tipos = String(v).split(',').map(s => s.trim()).filter(Boolean);
  return `ARRAY[${tipos.map(t => `'${t.replace(/'/g, "''")}'`).join(',')}]::text[]`;
}

// === LE CSV (forca UTF-8 — XLSX por default leu como Latin-1 e corrompeu acentos) ===
console.log('=== Lendo CSV ===');
const buf = readFileSync(CSV);
const wb = XLSX.read(buf, { type: 'buffer', codepage: 65001 });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: null });
console.log(`Total de linhas: ${rows.length}`);
console.log(`Primeira coluna ID Organizacao: ${rows[0]['ID Organização']}\n`);

// === EXTRAI METADADOS ===
const orgId = rows[0]['ID Organização'];
console.log(`Organization ID: ${orgId}`);

const pipelinesMap = new Map();
const stagesMap = new Map();
const eventsMap = new Map();

for (const r of rows) {
  const pid = r['ID Pipeline'];
  if (pid && !pipelinesMap.has(pid)) {
    pipelinesMap.set(pid, { id: pid, name: r['Pipeline'] || 'Pipeline' });
  }
  const sid = r['ID Coluna'];
  if (sid && !stagesMap.has(sid)) {
    stagesMap.set(sid, {
      id: sid,
      pipeline_id: pid,
      name: r['Coluna Kanban']?.replace(/^\d+\.\s*/, '') || 'Coluna',
      tipo: r['Tipo Coluna'],
    });
  }
  const eid = r['ID Feira'];
  if (eid && !eventsMap.has(eid)) {
    eventsMap.set(eid, {
      id: eid,
      name: r['Feira de Origem'] || 'Feira',
      location: r['Local da Feira'],
      start_date: r['Início da Feira'], // "15/04/2026"
    });
  }
}

console.log(`Pipelines distintos: ${pipelinesMap.size}`);
console.log(`Stages distintos:    ${stagesMap.size}`);
console.log(`Events distintos:    ${eventsMap.size}`);
console.log('');

// === 1) ORGANIZATION ===
console.log('--- Criando organization ---');
await runSQL(
  `INSERT INTO organizations (id, name) VALUES (${sqlUuid(orgId)}, 'Josimar Silva''s Organization') ON CONFLICT (id) DO NOTHING`,
  'org'
);

// === 2) PIPELINES + STAGES ===
console.log('--- Criando pipelines ---');
for (const p of pipelinesMap.values()) {
  await runSQL(
    `INSERT INTO pipelines (id, organization_id, name, is_default) VALUES (${sqlUuid(p.id)}, ${sqlUuid(orgId)}, ${sqlString(p.name)}, true) ON CONFLICT (id) DO NOTHING`,
    `pipeline ${p.name}`
  );
}

console.log('--- Criando stages ---');
let stageIdx = 0;
for (const s of stagesMap.values()) {
  // pipeline_stages tem: id, pipeline_id, name, position, slug, is_terminal, terminal_type
  const isTerminal = (s.tipo === 'won' || s.tipo === 'lost');
  await runSQL(
    `INSERT INTO pipeline_stages (id, pipeline_id, name, position, slug, is_terminal, terminal_type)
     VALUES (${sqlUuid(s.id)}, ${sqlUuid(s.pipeline_id)}, ${sqlString(s.name)}, ${stageIdx++}, ${sqlString(s.name.toLowerCase().replace(/\s+/g, '_'))}, ${isTerminal}, ${isTerminal ? sqlString(s.tipo) : 'NULL'})
     ON CONFLICT (id) DO NOTHING`,
    `stage ${s.name}`
  );
}

// === 3) EVENTS ===
console.log('--- Criando events ---');
for (const e of eventsMap.values()) {
  // start_date eh NOT NULL — fallback pra hoje se nao tem
  const startSql = sqlDateOnly(e.start_date) === 'NULL' ? "CURRENT_DATE" : sqlDateOnly(e.start_date);
  await runSQL(
    `INSERT INTO events (id, organization_id, name, location, status, start_date, end_date)
     VALUES (${sqlUuid(e.id)}, ${sqlUuid(orgId)}, ${sqlString(e.name)}, ${sqlString(e.location)}, 'ATIVO', ${startSql}, ${startSql})
     ON CONFLICT (id) DO NOTHING`,
    `event ${e.name}`
  );
}

// === 4) CONTATOS ===
console.log(`\n--- Importando ${rows.length} contatos (em lotes de 100) ---`);
const BATCH = 100;
let inserted = 0;
let errors = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const values = batch.map((r) => {
    return `(
      ${sqlUuid(r['ID do Contato'])},
      ${sqlUuid(r['ID Organização'])},
      ${sqlString(r['Empresa / Nome'])},
      ${sqlString(r['Empresa (campo company)'])},
      ${sqlString(r['Pessoa de Contato'])},
      ${sqlString(r['Cargo'])},
      ${sqlString(r['CPF'])},
      ${sqlString(r['CNPJ'])},
      ${sqlString(r['Telefone Principal'])},
      ${sqlString(r['WhatsApp'])},
      ${sqlString(r['Email'])},
      ${sqlString(r['Endereço'])},
      ${sqlString(r['Cidade'])},
      ${sqlString(r['UF'])},
      ${sqlString(r['CEP'])},
      ${sqlString(r['Website'])},
      ${sqlString(r['Instagram'])},
      ${sqlString(r['Foto / Avatar URL'])},
      ${sqlTipoArray(r['Tipo (Fornecedor/Comprador)'])},
      ${sqlString(r['Referência'])},
      ${sqlString(r['Classe'])},
      ${sqlString(r['Produtos Fornecidos'])},
      ${sqlString(r['Segmento'])},
      ${sqlString(r['Temperatura'])},
      ${sqlString(r['Origem'])},
      ${sqlNumber(r['Lead Score'])},
      ${sqlNumber(r['Valor Estimado (R$)'])},
      ${sqlString(r['Status'])},
      ${sqlBool(r['Marcado Inexistente?'])},
      ${sqlBool(r['É Rascunho?'])},
      ${sqlString(r['Próxima Ação - Tipo'])},
      ${sqlDate(r['Próxima Ação - Data'])},
      ${sqlString(r['Motivo Ganho/Perdido'])},
      ${sqlUuid(r['ID Pipeline'])},
      ${sqlUuid(r['ID Coluna'])},
      ${sqlUuid(r['ID Feira'])},
      ${sqlString(r['Observações'])},
      ${sqlDate(r['Criado em'])},
      ${sqlDate(r['Atualizado em'])},
      ${sqlString(r['Nome Normalizado'])},
      ${sqlString(r['Telefone Normalizado'])},
      ${sqlString(r['Email Normalizado'])},
      ${sqlString(r['CPF Dígitos'])},
      ${sqlString(r['CNPJ Dígitos'])}
    )`;
  }).join(',\n    ');

  const sql = `
    INSERT INTO contacts (
      id, organization_id, name, company, contato_nome, cargo, cpf, cnpj,
      phone, whatsapp, email, endereco, cidade, estado, cep, website, instagram,
      avatar_url, tipo, referencia, classe, produtos_fornecidos, segmento,
      temperatura, origem, lead_score, valor_estimado, status,
      inexistente, is_draft, proxima_acao_tipo, proxima_acao_data,
      motivo_ganho_perdido, pipeline_id, stage_id, event_id, notes,
      created_at, updated_at,
      name_normalized, phone_normalized, email_normalized, cpf_digits, cnpj_digits
    ) VALUES
    ${values}
    ON CONFLICT (id) DO NOTHING
  `;

  const ok = await runSQL(sql, `batch ${i}-${i + batch.length}`);
  if (ok) inserted += batch.length;
  else errors += batch.length;
}

console.log(`\n=== RESUMO ===`);
console.log(`Inseridos: ${inserted}`);
console.log(`Erros:     ${errors}`);

// Contagem final
const checkR = await fetch(API, {
  method: 'POST',
  headers: { Authorization: `Bearer ${SBP}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: "SELECT count(*) as n FROM contacts" }),
});
const check = await checkR.json();
console.log(`Total no banco: ${check[0]?.n}`);
