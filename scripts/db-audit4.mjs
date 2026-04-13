const SB_URL = "https://edwkdrgferjbitxwlwrf.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkd2tkcmdmZXJqYml0eHdsd3JmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDcxMjA3OSwiZXhwIjoyMDg2Mjg4MDc5fQ.KILRshoC8XLuoJyx9Xrlz_Ve8-W9LOxYtsvWndyXfdc";
const HEADERS = {
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};

async function q(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: HEADERS });
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.log("  [WARN] Resposta nao e array:", JSON.stringify(data).slice(0, 200));
    return [];
  }
  return data;
}

async function qRange(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { ...HEADERS, "Prefer": "count=exact", "Range": "0-0" }
  });
  return res.headers.get("content-range");
}

async function main() {
  // 1. Interacoes - check columns first
  console.log("=== INTERACTIONS SCHEMA ===");
  const sample = await q("interactions?select=*&limit=1");
  if (sample.length > 0) {
    console.log("Colunas:", Object.keys(sample[0]).join(", "));
  }

  // 2. Total interacoes
  const totalRange = await qRange("interactions?select=id");
  console.log(`\nTotal interacoes: ${totalRange}`);

  // 3. Pegar TODAS as interacoes (pode ter mais de 1000)
  const int1 = await q("interactions?select=id,contact_id,created_at&order=created_at&limit=1000&offset=0");
  const int2 = await q("interactions?select=id,contact_id,created_at&order=created_at&limit=1000&offset=1000");
  const allInteractions = [...int1, ...int2];
  console.log(`Interacoes carregadas: ${allInteractions.length}`);

  // 4. Pegar TODOS os contatos
  const c1 = await q("contacts?select=id&limit=1000&offset=0");
  const c2 = await q("contacts?select=id&limit=1000&offset=1000");
  const allContactIds = new Set([...c1, ...c2].map(c => c.id));
  console.log(`Contatos carregados: ${allContactIds.size}`);

  // 5. Interacoes orfas
  const orphans = allInteractions.filter(i => !allContactIds.has(i.contact_id));
  console.log(`\n=== INTERACOES ORFAS: ${orphans.length} de ${allInteractions.length} ===`);

  // Agrupar por contact_id
  const byContact = {};
  orphans.forEach(o => {
    if (!byContact[o.contact_id]) byContact[o.contact_id] = [];
    byContact[o.contact_id].push(o);
  });
  console.log(`Contatos deletados que tinham interacoes: ${Object.keys(byContact).length}`);

  // Datas das orfas
  const dates = {};
  orphans.forEach(o => {
    const d = o.created_at.split("T")[0];
    dates[d] = (dates[d] || 0) + 1;
  });
  console.log("\nInteracoes orfas por data:");
  Object.entries(dates).sort().forEach(([d, c]) => console.log(`  ${d}: ${c} interacoes`));

  // 6. Contatos por stage no pipeline principal
  console.log("\n=== CONTATOS POR STAGE (Vendas Easybycomlink) ===");
  const mainPipeline = "ca0488f4-ae6d-4ce7-bc34-0afeeeb4a521";
  const stages = await q(`pipeline_stages?select=id,name,position&pipeline_id=eq.${mainPipeline}&order=position`);
  for (const s of stages) {
    const range = await qRange(`contacts?select=id&stage_id=eq.${s.id}`);
    console.log(`  ${s.name} (pos:${s.position}): ${range}`);
  }

  // 7. Contatos por stage no Suporte
  console.log("\n=== CONTATOS POR STAGE (Suporte) ===");
  const suportePipeline = "da9f8581-0126-4ca8-a653-e9fda392b3bf";
  const stagesSuporte = await q(`pipeline_stages?select=id,name,position&pipeline_id=eq.${suportePipeline}&order=position`);
  for (const s of stagesSuporte) {
    const range = await qRange(`contacts?select=id&stage_id=eq.${s.id}`);
    console.log(`  ${s.name} (pos:${s.position}): ${range}`);
  }

  // 8. Nomes duplicados
  console.log("\n=== NOMES DUPLICADOS ===");
  const allContacts = [
    ...await q("contacts?select=id,name,phone,pipeline_id,created_at&limit=1000&offset=0"),
    ...await q("contacts?select=id,name,phone,pipeline_id,created_at&limit=1000&offset=1000")
  ];

  const nameCount = {};
  allContacts.forEach(c => {
    if (c.name) {
      const key = c.name.trim().toUpperCase();
      if (!nameCount[key]) nameCount[key] = [];
      nameCount[key].push(c);
    }
  });
  const dupes = Object.entries(nameCount).filter(([_, arr]) => arr.length > 1);
  console.log(`Total nomes duplicados: ${dupes.length} grupos`);
  dupes.forEach(([name, arr]) => {
    console.log(`  "${arr[0].name}" x${arr.length} | phones: ${arr.map(c => c.phone || 'null').join(', ')} | created: ${arr.map(c => c.created_at.split('T')[0]).join(', ')}`);
  });

  // 9. Verificar se a tabela tem ON DELETE CASCADE
  console.log("\n=== FOREIGN KEY CHECK ===");
  console.log("(verificar se interactions.contact_id tem CASCADE)");
  // Nao da pra checar FK pelo REST, mas podemos inferir pelo comportamento
  console.log("INFERENCIA: Contatos foram deletados mas interacoes ficaram -> NAO tem ON DELETE CASCADE");
}

main().catch(console.error);
