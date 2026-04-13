import { readFileSync } from 'fs';

const SB_URL = "https://edwkdrgferjbitxwlwrf.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkd2tkcmdmZXJqYml0eHdsd3JmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDcxMjA3OSwiZXhwIjoyMDg2Mjg4MDc5fQ.KILRshoC8XLuoJyx9Xrlz_Ve8-W9LOxYtsvWndyXfdc";
const HEADERS = {
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "count=exact"
};

async function query(table, params = "") {
  const url = `${SB_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, { headers: HEADERS });
  const count = res.headers.get("content-range");
  const data = await res.json();
  return { data, count };
}

async function rpc(fn, body = {}) {
  const url = `${SB_URL}/rest/v1/rpc/${fn}`;
  const res = await fetch(url, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
  return res.json();
}

async function main() {
  console.log("=== AUDIT DE CONSISTENCIA DO BANCO ===\n");

  // 1. Organizacoes
  const orgs = await query("organizations", "select=id,name&order=created_at");
  console.log(`1. ORGANIZACOES: ${orgs.data.length}`);
  orgs.data.forEach(o => console.log(`   - ${o.name} (${o.id})`));

  // 2. Total de contatos
  const contacts = await query("contacts", "select=id,name,organization_id,pipeline_id,stage_id,phone,email&limit=5000");
  console.log(`\n2. CONTATOS TOTAL: ${contacts.data.length}`);

  // Contatos por org
  const contactsByOrg = {};
  contacts.data.forEach(c => {
    contactsByOrg[c.organization_id] = (contactsByOrg[c.organization_id] || 0) + 1;
  });
  console.log("   Contatos por organizacao:");
  for (const [orgId, count] of Object.entries(contactsByOrg)) {
    const orgName = orgs.data.find(o => o.id === orgId)?.name || "DESCONHECIDA";
    console.log(`   - ${orgName}: ${count}`);
  }

  // 3. Pipelines
  const pipelines = await query("pipelines", "select=id,name,organization_id&order=created_at");
  console.log(`\n3. PIPELINES: ${pipelines.data.length}`);
  pipelines.data.forEach(p => {
    const orgName = orgs.data.find(o => o.id === p.organization_id)?.name || "DESCONHECIDA";
    console.log(`   - "${p.name}" (org: ${orgName}) [${p.id}]`);
  });

  // 4. Stages
  const stages = await query("pipeline_stages", "select=id,name,pipeline_id,position&order=pipeline_id,position&limit=500");
  console.log(`\n4. STAGES: ${stages.data.length}`);
  const stagesByPipeline = {};
  stages.data.forEach(s => {
    if (!stagesByPipeline[s.pipeline_id]) stagesByPipeline[s.pipeline_id] = [];
    stagesByPipeline[s.pipeline_id].push(s);
  });
  for (const [pipeId, stgs] of Object.entries(stagesByPipeline)) {
    const pipeName = pipelines.data.find(p => p.id === pipeId)?.name || "DESCONHECIDO";
    console.log(`   Pipeline "${pipeName}": ${stgs.map(s => `${s.name}(pos:${s.position})`).join(" -> ")}`);
  }

  // 5. INCONSISTENCIAS
  console.log("\n========================================");
  console.log("5. ANALISE DE INCONSISTENCIAS");
  console.log("========================================\n");

  // 5a. Contatos sem pipeline_id
  const noPipeline = contacts.data.filter(c => !c.pipeline_id);
  console.log(`5a. Contatos SEM pipeline_id: ${noPipeline.length}`);
  if (noPipeline.length > 0 && noPipeline.length <= 20) {
    noPipeline.forEach(c => console.log(`    - ${c.name} (${c.id})`));
  }

  // 5b. Contatos sem stage_id
  const noStage = contacts.data.filter(c => !c.stage_id);
  console.log(`5b. Contatos SEM stage_id: ${noStage.length}`);
  if (noStage.length > 0 && noStage.length <= 20) {
    noStage.forEach(c => console.log(`    - ${c.name} (${c.id})`));
  }

  // 5c. Contatos com pipeline_id que NAO existe
  const pipelineIds = new Set(pipelines.data.map(p => p.id));
  const orphanPipeline = contacts.data.filter(c => c.pipeline_id && !pipelineIds.has(c.pipeline_id));
  console.log(`5c. Contatos com pipeline_id INEXISTENTE: ${orphanPipeline.length}`);
  if (orphanPipeline.length > 0) {
    orphanPipeline.slice(0, 20).forEach(c => console.log(`    - ${c.name} | pipeline_id: ${c.pipeline_id}`));
  }

  // 5d. Contatos com stage_id que NAO existe
  const stageIds = new Set(stages.data.map(s => s.id));
  const orphanStage = contacts.data.filter(c => c.stage_id && !stageIds.has(c.stage_id));
  console.log(`5d. Contatos com stage_id INEXISTENTE: ${orphanStage.length}`);
  if (orphanStage.length > 0) {
    orphanStage.slice(0, 20).forEach(c => console.log(`    - ${c.name} | stage_id: ${c.stage_id}`));
  }

  // 5e. Contatos com stage_id que nao pertence ao pipeline_id
  const stageToPipeline = {};
  stages.data.forEach(s => { stageToPipeline[s.id] = s.pipeline_id; });
  const mismatch = contacts.data.filter(c => c.pipeline_id && c.stage_id && stageToPipeline[c.stage_id] && stageToPipeline[c.stage_id] !== c.pipeline_id);
  console.log(`5e. Contatos com stage_id de OUTRO pipeline (mismatch): ${mismatch.length}`);
  if (mismatch.length > 0) {
    mismatch.slice(0, 20).forEach(c => {
      const correctPipeline = pipelines.data.find(p => p.id === stageToPipeline[c.stage_id])?.name || "?";
      const currentPipeline = pipelines.data.find(p => p.id === c.pipeline_id)?.name || "?";
      console.log(`    - ${c.name} | pipeline="${currentPipeline}" mas stage pertence a "${correctPipeline}"`);
    });
  }

  // 5f. Contatos sem organization_id
  const noOrg = contacts.data.filter(c => !c.organization_id);
  console.log(`5f. Contatos SEM organization_id: ${noOrg.length}`);

  // 5g. Contatos com organization_id inexistente
  const orgIds = new Set(orgs.data.map(o => o.id));
  const orphanOrg = contacts.data.filter(c => c.organization_id && !orgIds.has(c.organization_id));
  console.log(`5g. Contatos com organization_id INEXISTENTE: ${orphanOrg.length}`);

  // 5h. Pipelines sem stages
  const pipelinesWithoutStages = pipelines.data.filter(p => !stagesByPipeline[p.id] || stagesByPipeline[p.id].length === 0);
  console.log(`5h. Pipelines SEM nenhum stage: ${pipelinesWithoutStages.length}`);
  pipelinesWithoutStages.forEach(p => console.log(`    - "${p.name}" (${p.id})`));

  // 5i. Contatos duplicados por phone
  const phoneCount = {};
  contacts.data.forEach(c => {
    if (c.phone) {
      const key = `${c.organization_id}|${c.phone}`;
      if (!phoneCount[key]) phoneCount[key] = [];
      phoneCount[key].push(c);
    }
  });
  const dupePhones = Object.entries(phoneCount).filter(([_, arr]) => arr.length > 1);
  console.log(`5i. Telefones DUPLICADOS (mesma org): ${dupePhones.length} grupos`);
  dupePhones.slice(0, 10).forEach(([key, arr]) => {
    console.log(`    Tel: ${key.split("|")[1]} -> ${arr.map(c => c.name).join(", ")}`);
  });

  // 5j. Contatos duplicados por email
  const emailCount = {};
  contacts.data.forEach(c => {
    if (c.email) {
      const key = `${c.organization_id}|${c.email.toLowerCase()}`;
      if (!emailCount[key]) emailCount[key] = [];
      emailCount[key].push(c);
    }
  });
  const dupeEmails = Object.entries(emailCount).filter(([_, arr]) => arr.length > 1);
  console.log(`5j. Emails DUPLICADOS (mesma org): ${dupeEmails.length} grupos`);
  dupeEmails.slice(0, 10).forEach(([key, arr]) => {
    console.log(`    Email: ${key.split("|")[1]} -> ${arr.map(c => c.name).join(", ")}`);
  });

  // 5k. Contatos sem nome
  const noName = contacts.data.filter(c => !c.name || c.name.trim() === "");
  console.log(`5k. Contatos SEM nome: ${noName.length}`);

  // 5l. Contatos sem telefone E sem email
  const noContact = contacts.data.filter(c => !c.phone && !c.email);
  console.log(`5l. Contatos sem telefone E sem email: ${noContact.length}`);

  // 6. Interactions / interactions
  console.log("\n========================================");
  console.log("6. INTERACOES");
  console.log("========================================\n");

  const interactions = await query("interactions", "select=id,contact_id&limit=5000");
  console.log(`Total interacoes: ${interactions.data.length}`);

  // Interacoes com contact_id inexistente
  const contactIds = new Set(contacts.data.map(c => c.id));
  const orphanInteractions = interactions.data.filter(i => !contactIds.has(i.contact_id));
  console.log(`Interacoes com contact_id INEXISTENTE (orfas): ${orphanInteractions.length}`);

  // 7. Profiles
  console.log("\n========================================");
  console.log("7. PROFILES");
  console.log("========================================\n");

  const profiles = await query("profiles", "select=id,user_id,organization_id,name,email,role&limit=500");
  console.log(`Total profiles: ${profiles.data.length}`);
  profiles.data.forEach(p => {
    const orgName = orgs.data.find(o => o.id === p.organization_id)?.name || "SEM ORG";
    console.log(`   - ${p.name || p.email} | role: ${p.role} | org: ${orgName}`);
  });

  // Profiles sem organization_id
  const noOrgProfiles = profiles.data.filter(p => !p.organization_id);
  console.log(`Profiles SEM organization_id: ${noOrgProfiles.length}`);

  console.log("\n=== FIM DO AUDIT ===");
}

main().catch(console.error);
