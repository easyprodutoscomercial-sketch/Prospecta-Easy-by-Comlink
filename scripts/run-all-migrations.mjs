// Runner pra rodar TODAS as migrations de supabase/migrations/ em ordem
// alfabetica. Todas elas usam IF NOT EXISTS / DROP IF EXISTS, entao rodar
// duas vezes nao quebra nada.
//
// Conecta via Supabase Management API (POST /v1/projects/{ref}/database/query)
// porque o pooler Postgres e bloqueado pelo firewall na rede do dono.
//
// USO:
//   # 1. Pega token em https://supabase.com/dashboard/account/tokens (sbp_*)
//   # 2. Roda dry-run pra ver o que vai aplicar:
//   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/run-all-migrations.mjs
//   # 3. Aplica de verdade:
//   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/run-all-migrations.mjs --apply

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const APPLY = process.argv.includes('--apply');
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const env = Object.fromEntries(
  readFileSync(resolve(ROOT, '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const TOKEN =
  process.env.SUPABASE_ACCESS_TOKEN ||
  env.SUPABASE_ACCESS_TOKEN ||
  env.SUPABASE_MANAGEMENT_TOKEN;

if (!TOKEN) {
  console.error(`
❌ SUPABASE_ACCESS_TOKEN nao encontrado.

Como pegar:
  1. Vai em https://supabase.com/dashboard/account/tokens
  2. "Generate new token" (pode dar nome "controlei-migrations")
  3. Copia o token (comeca com sbp_)
  4. Roda assim:
     SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/run-all-migrations.mjs --apply
`);
  process.exit(1);
}

const REF = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace('https://', '').split('.')[0];
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function execSql(sql) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
    return { ok: false, error: parsed.message || text };
  }
  return { ok: true, body: text };
}

async function main() {
  console.log(`=== RUN ALL MIGRATIONS ===  ${APPLY ? '🔥 APPLY' : '🧪 DRY RUN'}`);
  console.log(`Project: ${REF}\n`);

  const migDir = resolve(ROOT, 'supabase', 'migrations');
  const files = readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Encontradas ${files.length} migrations:`);
  for (const f of files) console.log(`  - ${f}`);
  console.log('');

  if (!APPLY) {
    console.log('💡 Roda com --apply pra executar.\n');
    return;
  }

  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const failed = [];

  for (const f of files) {
    const sql = readFileSync(join(migDir, f), 'utf8');
    process.stdout.write(`▶️  ${f}... `);
    const result = await execSql(sql);
    if (result.ok) {
      console.log('✅');
      okCount++;
    } else {
      const msg = result.error || '';
      // Erros idempotentes que indicam "ja aplicada"
      if (/already exists|duplicate column|duplicate object/i.test(msg)) {
        console.log(`⏭️  ja existia`);
        skipCount++;
      } else {
        console.log(`❌ ${msg.slice(0, 100)}`);
        failed.push({ file: f, error: msg });
        failCount++;
      }
    }
  }

  console.log('\n=== RESUMO ===');
  console.log(`✅ Aplicadas: ${okCount}`);
  console.log(`⏭️  Skip (idempotente): ${skipCount}`);
  console.log(`❌ Falhas: ${failCount}`);
  if (failed.length > 0) {
    console.log('\nFalhas detalhadas:');
    failed.forEach((f) => {
      console.log(`\n  ${f.file}:`);
      console.log(`    ${f.error}`);
    });
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FALHA:', err.message);
  process.exit(1);
});
