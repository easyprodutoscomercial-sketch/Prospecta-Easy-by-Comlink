// Importa expositores Agrishow 2026 (scripts/agrishow-exhibitors.json)
// como event_booths no evento AGRISHOW 2026 do Controlei.
//
// Idempotente: se já existem booths com o mesmo external_id (swapcard_id),
// atualiza em vez de duplicar.
//
// Usage: node scripts/import-agrishow-booths.mjs

import fs from 'node:fs';
import path from 'node:path';

import { loadSupabaseEnv } from './_lib/env.mjs';
const SUPABASE_URL = 'https://edwkdrgferjbitxwlwrf.supabase.co';
const { SB_KEY: SERVICE_ROLE_KEY } = loadSupabaseEnv();

const EVENT_ID = '0e331665-e083-429c-9fae-9e67888a9a80'; // AGRISHOW 2026
const ORG_ID   = '86727616-4004-4604-b21b-25e8400d271d'; // EASY COMLINK

const HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function sb(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} — ${text}`);
  return text ? JSON.parse(text) : null;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
  const inputPath = path.join(process.cwd(), 'scripts', 'agrishow-exhibitors.json');
  const exhibitors = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  console.log(`📥 ${exhibitors.length} expositores carregados de ${inputPath}`);

  // Check existing by external_id
  const existing = await sb(
    `/event_booths?event_id=eq.${EVENT_ID}&select=id,external_id&external_id=not.is.null`
  );
  const byExternalId = new Map(existing.map(b => [b.external_id, b.id]));
  console.log(`📋 já existem ${existing.length} booths com external_id vinculado`);

  const toInsert = [];
  const toUpdate = [];

  for (const e of exhibitors) {
    const row = {
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      company_name: e.name,
      booth_number: e.booth,
      sector: e.type,
      logo_url: e.logo_url,
      external_id: e.swapcard_id,
      status: 'PENDENTE',
    };
    if (byExternalId.has(e.swapcard_id)) {
      toUpdate.push({ id: byExternalId.get(e.swapcard_id), row });
    } else {
      toInsert.push(row);
    }
  }

  console.log(`   ⊕ inserir: ${toInsert.length}`);
  console.log(`   ↻ atualizar: ${toUpdate.length}`);

  // Insert em chunks de 100
  let inserted = 0;
  for (const batch of chunk(toInsert, 100)) {
    await sb('/event_booths', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(batch),
    });
    inserted += batch.length;
    process.stdout.write(`   inserindo… ${inserted}/${toInsert.length}\r`);
  }
  if (toInsert.length) console.log();

  // Update um por um (PostgREST não faz bulk update por PK facilmente)
  let updated = 0;
  for (const { id, row } of toUpdate) {
    const patch = {
      company_name: row.company_name,
      booth_number: row.booth_number,
      sector: row.sector,
      logo_url: row.logo_url,
    };
    await sb(`/event_booths?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    });
    updated++;
    if (updated % 50 === 0) process.stdout.write(`   atualizando… ${updated}/${toUpdate.length}\r`);
  }
  if (toUpdate.length) console.log(`   atualizando… ${updated}/${toUpdate.length}`);

  // Final count
  const finalCount = await sb(
    `/event_booths?event_id=eq.${EVENT_ID}&select=id&limit=0`,
    { headers: { Prefer: 'count=exact' } }
  );

  console.log(`\n✅ Pronto — inseridos ${inserted}, atualizados ${updated}.`);
  console.log(`   Total de booths no evento AGRISHOW 2026 agora.`);
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
