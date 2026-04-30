// Apaga 5 participantes de teste interno do quiz feira (Comlink/JM Tecnologia).
// Mostra SELECT antes, faz DELETE e confirma com novo SELECT.
// Filtra por telefone — coluna unica e estavel — e por organization_id pra garantia.

import { loadSupabaseEnv } from './_lib/env.mjs';
const SB_URL = "https://edwkdrgferjbitxwlwrf.supabase.co";
const { SB_KEY } = loadSupabaseEnv();
const HEADERS = {
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "count=exact",
};

const TELEFONES = [
  "16992446581", // Marcelo Albino
  "16997497186", // Humberto Amenero
  "16991476854", // Fabiola Nobo
  "16982701436", // Josimar Mariano
  "16982701488", // mariano (JM Tecnologia)
];

const phoneFilter = `telefone=in.(${TELEFONES.join(",")})`;

async function listMatches() {
  const url = `${SB_URL}/rest/v1/quiz_participantes?${phoneFilter}&select=id,nome,empresa,telefone,palpite,dia_feira,quiz_config_id,created_at&order=created_at.desc`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    console.error("❌ SELECT falhou:", res.status, await res.text());
    process.exit(1);
  }
  return res.json();
}

async function deleteMatches() {
  const url = `${SB_URL}/rest/v1/quiz_participantes?${phoneFilter}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { ...HEADERS, Prefer: "return=representation" },
  });
  if (!res.ok) {
    console.error("❌ DELETE falhou:", res.status, await res.text());
    process.exit(1);
  }
  return res.json();
}

async function main() {
  console.log("=== PASSO 1 — Linhas que vao ser apagadas ===\n");
  const before = await listMatches();
  if (before.length === 0) {
    console.log("Nada encontrado com esses telefones. Saindo sem apagar.");
    return;
  }
  for (const r of before) {
    const dia = r.dia_feira ? `dia ${r.dia_feira}` : "sem dia";
    console.log(`  • ${r.nome} | ${r.empresa} | ${r.telefone} | palpite=${r.palpite} | ${dia} | ${r.created_at}`);
  }
  console.log(`\nTotal: ${before.length} linhas`);

  console.log("\n=== PASSO 2 — Executando DELETE ===\n");
  const deleted = await deleteMatches();
  console.log(`✅ Apagadas: ${deleted.length} linhas`);

  console.log("\n=== PASSO 3 — Verificando que sumiram ===\n");
  const after = await listMatches();
  if (after.length === 0) {
    console.log("✅ Confirmado: zero linhas restantes com esses telefones.");
  } else {
    console.log(`⚠️ Ainda restam ${after.length} linhas — investigar:`);
    for (const r of after) console.log(`  • ${r.nome} | ${r.telefone}`);
  }
}

main().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
