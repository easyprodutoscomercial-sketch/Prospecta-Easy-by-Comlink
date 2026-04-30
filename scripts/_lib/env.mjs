// Helper compartilhado pelos scripts/*.mjs pra carregar credenciais de
// .env.local SEM hardcodar chaves no codigo. Antes os scripts tinham a
// SUPABASE_SERVICE_ROLE_KEY colada inline, que ia parar no historico do git.
//
// Uso:
//   import { loadSupabaseEnv } from './_lib/env.mjs';
//   const { SB_URL, SB_KEY, HEADERS } = loadSupabaseEnv();

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

function parseEnvFile(content) {
  const out = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadDotenvLocal() {
  const candidates = [resolve(ROOT, '.env.local'), resolve(ROOT, '.env')];
  for (const path of candidates) {
    if (existsSync(path)) {
      try {
        return parseEnvFile(readFileSync(path, 'utf8'));
      } catch (e) {
        console.warn(`[scripts/_lib/env] falha ao ler ${path}:`, e.message);
      }
    }
  }
  return {};
}

const envFile = loadDotenvLocal();

function getEnv(key, { required = true } = {}) {
  const value = process.env[key] || envFile[key];
  if (!value && required) {
    console.error(`\n❌ Variavel de ambiente ${key} nao encontrada.`);
    console.error(`   Defina em .env.local ou exporte antes de rodar o script:`);
    console.error(`     export ${key}="..."`);
    console.error(`     node scripts/<arquivo>.mjs\n`);
    process.exit(1);
  }
  return value || '';
}

/**
 * Retorna URL + service_role key + headers prontos pra fetch contra a REST
 * API do Supabase. Aborta o script se as variaveis nao estiverem definidas.
 */
export function loadSupabaseEnv() {
  const SB_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const SB_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const HEADERS = {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'count=exact',
  };
  return { SB_URL, SB_KEY, HEADERS };
}

/**
 * Retorna o Personal Access Token (sbp_*) do Supabase pra Management API.
 * Usado por scripts de migration que rodam SQL via /v1/projects/{ref}/database/query.
 */
export function loadSupabaseManagementToken() {
  return getEnv('SUPABASE_MANAGEMENT_TOKEN');
}
