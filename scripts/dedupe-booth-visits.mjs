// /furos #1: deleta booth_visits duplicadas (mesmo user/booth/event).
// Estrategia: pra cada (user_id, booth_id, event_id) com mais de 1 visita,
// MANTEM a mais antiga (created_at ASC) e DELETA as outras.
//
// Por que manter a mais antiga: o primeiro check-in e o "real" — os
// subsequentes sao retentativas que viraram duplicata. As fotos da 1a
// foram salvas antes; se as posteriores tem foto melhor, perdemos — mas
// e tradeoff aceito (fotos ja estao no contact, o que importa e a visita
// nao duplicar).
//
// Idempotente: re-rodar nao causa dano (depois da 1a passada, nao ha
// mais duplicatas).
//
// Salva backup separado dos ids deletados em backups/dedupe-booth-visits-<ts>.json.

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadSupabaseEnv } from './_lib/env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BACKUP_DIR = join(ROOT, 'backups');
if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

const APPLY = process.argv.includes('--apply');

const { SB_URL, SB_KEY } = loadSupabaseEnv();
const supa = createClient(SB_URL, SB_KEY);

// Pega TODAS as visitas (todos eventos). Idempotente — se nao tiver dup, nada deleta.
const { data: visits, error } = await supa
  .from('booth_visits')
  .select('id, user_id, booth_id, event_id, created_at, contact_id, organization_id')
  .order('created_at', { ascending: true });

if (error) { console.error('SELECT error:', error.message); process.exit(1); }

const groups = new Map();
for (const v of visits || []) {
  if (!v.user_id || !v.booth_id || !v.event_id) continue;
  const k = `${v.user_id}|${v.booth_id}|${v.event_id}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(v);
}

const toDelete = [];
const keepers = [];
for (const [, list] of groups) {
  if (list.length > 1) {
    keepers.push(list[0]); // mais antiga
    toDelete.push(...list.slice(1)); // resto
  }
}

console.log(`Total booth_visits: ${(visits || []).length}`);
console.log(`Pares unicos (user/booth/event): ${groups.size}`);
console.log(`Duplicatas a deletar: ${toDelete.length}`);
console.log(`Sera mantida a visita mais antiga em ${keepers.length} grupos.\n`);

if (toDelete.length === 0) {
  console.log('Nada a fazer. Banco ja esta limpo.');
  process.exit(0);
}

// Backup pre-delete
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFile = join(BACKUP_DIR, `dedupe-booth-visits-${ts}.json`);
writeFileSync(backupFile, JSON.stringify({
  taken_at: new Date().toISOString(),
  reason: 'pre-delete-duplicates-furos1',
  deleted_count: toDelete.length,
  to_delete: toDelete,
  keepers,
}, null, 2), 'utf8');
console.log(`📦 Backup do que vai deletar: backups/${backupFile.split(/[/\\]/).pop()}\n`);

if (!APPLY) {
  console.log('DRY RUN. Pra aplicar de verdade, re-rode com --apply');
  console.log('Exemplos do que seria deletado:');
  toDelete.slice(0, 5).forEach(v => console.log(`  ${v.id} (booth=${v.booth_id.slice(0,8)} user=${v.user_id.slice(0,8)} contact=${v.contact_id?.slice(0,8) || '-'})`));
  process.exit(0);
}

// Apply: delete em lotes de 100 (limite do supabase-js .in())
const batchSize = 100;
let deleted = 0;
for (let i = 0; i < toDelete.length; i += batchSize) {
  const ids = toDelete.slice(i, i + batchSize).map(v => v.id);
  const { error: dErr } = await supa.from('booth_visits').delete().in('id', ids);
  if (dErr) { console.error(`  Lote ${i}: ${dErr.message}`); }
  else { deleted += ids.length; console.log(`  Lote ${i / batchSize + 1}: ${ids.length} deletados`); }
}
console.log(`\n✅ ${deleted} visitas duplicadas deletadas.`);
