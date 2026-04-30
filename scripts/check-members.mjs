import { loadSupabaseEnv } from './_lib/env.mjs';
const SB_URL = "https://edwkdrgferjbitxwlwrf.supabase.co";
const { SB_KEY } = loadSupabaseEnv();
const H = { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` };

async function q(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function main() {
  // 1. Pipeline members
  console.log("=== PIPELINE MEMBERS ===");
  const members = await q("pipeline_members?select=*&limit=100");
  console.log("Total members:", members.length);

  // 2. Profiles
  const profiles = await q("profiles?select=user_id,name,role&limit=100");
  const profileMap = {};
  profiles.forEach(p => { profileMap[p.user_id] = p; });

  // 3. Pipelines
  const pipelines = await q("pipelines?select=id,name&limit=100");
  const pipeMap = {};
  pipelines.forEach(p => { pipeMap[p.id] = p.name; });

  // 4. Group members by pipeline
  const byPipeline = {};
  members.forEach(m => {
    const key = m.pipeline_id;
    if (!byPipeline[key]) byPipeline[key] = [];
    byPipeline[key].push(m);
  });

  for (const [pId, mems] of Object.entries(byPipeline)) {
    const pipeName = pipeMap[pId] || "DESCONHECIDO";
    console.log(`\nPipeline: "${pipeName}" (${pId})`);
    mems.forEach(m => {
      const p = profileMap[m.user_id];
      console.log(`  - ${p ? p.name : m.user_id} | member_role: ${m.role || 'member'} | profile_role: ${p ? p.role : '?'}`);
    });
  }

  // 5. Quem NAO e membro de nenhum pipeline?
  console.log("\n=== USUARIOS SEM MEMBERSHIP EM PIPELINE ===");
  const memberUserIds = new Set(members.map(m => m.user_id));
  const noMembership = profiles.filter(p => !memberUserIds.has(p.user_id));
  noMembership.forEach(p => {
    console.log(`  - ${p.name} | role: ${p.role} | user_id: ${p.user_id}`);
  });

  // 6. Admins
  console.log("\n=== ADMINS (bypass pipeline_members) ===");
  const admins = profiles.filter(p => p.role === 'admin');
  admins.forEach(p => console.log(`  - ${p.name}`));

  // 7. Quem sao os que reclamam? Verificar pipeline do contato Danilo
  console.log("\n=== PIPELINE DO CONTATO DANILO ===");
  const danilo = await q("contacts?select=id,name,pipeline_id,stage_id&name=ilike.*Danilo*Baependi*");
  console.log(JSON.stringify(danilo, null, 2));

  // O pipeline do Danilo é ca0488f4. Quem é membro?
  const daniloMembers = members.filter(m => m.pipeline_id === 'ca0488f4-ae6d-4ce7-bc34-0afeeeb4a521');
  console.log("\nMembros do pipeline 'Vendas Easybycomlink':");
  daniloMembers.forEach(m => {
    const p = profileMap[m.user_id];
    console.log(`  - ${p ? p.name : m.user_id}`);
  });

  // 8. Verificar se o pipeline_context do kanban carrega stages corretamente
  console.log("\n=== STAGES DO PIPELINE VENDAS EASYBYCOMLINK ===");
  const stages = await q("pipeline_stages?select=id,name,position&pipeline_id=eq.ca0488f4-ae6d-4ce7-bc34-0afeeeb4a521&order=position");
  stages.forEach(s => console.log(`  pos:${s.position} | ${s.name} | ${s.id}`));

  // 9. Quantos contatos por user (assigned_to)
  console.log("\n=== CONTATOS POR RESPONSAVEL ===");
  const contacts1 = await q("contacts?select=id,assigned_to_user_id&limit=1000&offset=0");
  const contacts2 = await q("contacts?select=id,assigned_to_user_id&limit=1000&offset=1000");
  const allContacts = [...contacts1, ...contacts2];
  const byUser = {};
  allContacts.forEach(c => {
    const key = c.assigned_to_user_id || '_sem_responsavel';
    byUser[key] = (byUser[key] || 0) + 1;
  });
  for (const [uid, count] of Object.entries(byUser)) {
    const name = uid === '_sem_responsavel' ? 'SEM RESPONSAVEL' : (profileMap[uid]?.name || uid);
    console.log(`  ${name}: ${count}`);
  }
}

main().catch(console.error);
