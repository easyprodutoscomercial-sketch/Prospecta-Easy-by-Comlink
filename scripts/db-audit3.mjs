const SB_URL = "https://edwkdrgferjbitxwlwrf.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkd2tkcmdmZXJqYml0eHdsd3JmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDcxMjA3OSwiZXhwIjoyMDg2Mjg4MDc5fQ.KILRshoC8XLuoJyx9Xrlz_Ve8-W9LOxYtsvWndyXfdc";
const HEADERS = {
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};

async function q(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: HEADERS });
  return res.json();
}

async function qRange(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { ...HEADERS, "Prefer": "count=exact", "Range": "0-0" }
  });
  const range = res.headers.get("content-range");
  return range;
}

async function main() {
  // 1. Quantos contatos por pipeline?
  console.log("=== CONTATOS POR PIPELINE ===");
  const pipelines = await q("pipelines?select=id,name,organization_id&order=created_at");
  for (const p of pipelines) {
    const range = await qRange(`contacts?select=id&pipeline_id=eq.${p.id}`);
    console.log(`  "${p.name}" (${p.id}): ${range}`);
  }

  // 2. Quantos contatos existem que NAO estao nos 1000 retornados? Pegar os 494 extras
  console.log("\n=== CONTATOS TOTAIS - PAGINACAO ===");
  const page1 = await q("contacts?select=id,name,pipeline_id,stage_id,created_at&order=created_at&limit=1000&offset=0");
  const page2 = await q("contacts?select=id,name,pipeline_id,stage_id,created_at&order=created_at&limit=1000&offset=1000");
  console.log(`Pagina 1 (0-999): ${page1.length} contatos`);
  console.log(`Pagina 2 (1000+): ${page2.length} contatos`);

  if (page1.length > 0) {
    console.log(`  Primeiro contato: ${page1[0].name} - ${page1[0].created_at}`);
    console.log(`  Ultimo da pagina 1: ${page1[page1.length-1].name} - ${page1[page1.length-1].created_at}`);
  }
  if (page2.length > 0) {
    console.log(`  Primeiro da pagina 2: ${page2[0].name} - ${page2[0].created_at}`);
    console.log(`  Ultimo contato: ${page2[page2.length-1].name} - ${page2[page2.length-1].created_at}`);
  }

  const allContacts = [...page1, ...page2];
  console.log(`\nTotal real: ${allContacts.length}`);

  // 3. Contatos por pipeline (com todos os dados)
  console.log("\n=== DISTRIBUICAO COMPLETA POR PIPELINE ===");
  const byPipeline = {};
  allContacts.forEach(c => {
    const key = c.pipeline_id || "SEM_PIPELINE";
    if (!byPipeline[key]) byPipeline[key] = 0;
    byPipeline[key]++;
  });
  for (const [pId, count] of Object.entries(byPipeline)) {
    const pName = pipelines.find(p => p.id === pId)?.name || pId;
    console.log(`  ${pName}: ${count} contatos`);
  }

  // 4. Investigar as interacoes orfas -- quando foram criadas vs quando contatos foram deletados
  console.log("\n=== INTERACOES ORFAS - INVESTIGACAO ===");
  const interactions = await q("interactions?select=id,contact_id,type,created_at,user_id&order=created_at&limit=5000");
  const contactIds = new Set(allContacts.map(c => c.id));
  const orphans = interactions.filter(i => !contactIds.has(i.contact_id));

  // Agrupar orfas por contact_id
  const orphansByContact = {};
  orphans.forEach(o => {
    if (!orphansByContact[o.contact_id]) orphansByContact[o.contact_id] = [];
    orphansByContact[o.contact_id].push(o);
  });

  console.log(`Contatos deletados que tinham interacoes: ${Object.keys(orphansByContact).length}`);
  console.log(`Total interacoes orfas: ${orphans.length}`);

  // Quando foram criadas as orfas?
  const orphanDates = orphans.map(o => o.created_at.split("T")[0]);
  const dateCounts = {};
  orphanDates.forEach(d => { dateCounts[d] = (dateCounts[d] || 0) + 1; });
  console.log("\nInteracoes orfas por data:");
  Object.entries(dateCounts).sort().forEach(([d, c]) => console.log(`  ${d}: ${c}`));

  // 5. Verificar se os contact_ids orfaos eram da mesma org ou de outra
  // Checar se existe algum contato deletado que pode ter sido de import
  console.log("\n=== VERIFICAR DELETED_CONTACTS ou LOGS ===");
  const delContacts = await q("deleted_contacts?select=id&limit=1");
  console.log("deleted_contacts table:", Array.isArray(delContacts) ? `${delContacts.length} registros` : JSON.stringify(delContacts));

  // 6. Checar stages por pipeline e se contatos estao em stages corretos
  console.log("\n=== CONTATOS POR STAGE (Pipeline Vendas Easybycomlink) ===");
  const mainPipeline = "ca0488f4-ae6d-4ce7-bc34-0afeeeb4a521";
  const stages = await q(`pipeline_stages?select=id,name,position&pipeline_id=eq.${mainPipeline}&order=position`);
  for (const s of stages) {
    const range = await qRange(`contacts?select=id&stage_id=eq.${s.id}`);
    console.log(`  ${s.name} (pos:${s.position}): ${range}`);
  }

  // 7. Pipeline Suporte
  console.log("\n=== CONTATOS POR STAGE (Pipeline Suporte) ===");
  const suportePipeline = "da9f8581-0126-4ca8-a653-e9fda392b3bf";
  const stagesSuporte = await q(`pipeline_stages?select=id,name,position&pipeline_id=eq.${suportePipeline}&order=position`);
  for (const s of stagesSuporte) {
    const range = await qRange(`contacts?select=id&stage_id=eq.${s.id}`);
    console.log(`  ${s.name} (pos:${s.position}): ${range}`);
  }

  // 8. Contatos duplicados por nome na mesma org
  console.log("\n=== NOMES DUPLICADOS (mesma org) ===");
  const nameCount = {};
  allContacts.forEach(c => {
    if (c.name) {
      const key = c.name.trim().toUpperCase();
      if (!nameCount[key]) nameCount[key] = [];
      nameCount[key].push(c);
    }
  });
  const dupeNames = Object.entries(nameCount).filter(([_, arr]) => arr.length > 1);
  console.log(`Nomes duplicados: ${dupeNames.length} grupos`);
  dupeNames.slice(0, 15).forEach(([name, arr]) => {
    const pipIds = arr.map(c => {
      const p = pipelines.find(p => p.id === c.pipeline_id);
      return p ? p.name : "?";
    });
    console.log(`  "${name}" x${arr.length} -> pipelines: ${pipIds.join(", ")}`);
  });
}

main().catch(console.error);
