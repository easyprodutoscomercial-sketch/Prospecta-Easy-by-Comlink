import { loadSupabaseEnv } from './_lib/env.mjs';
const SB_URL = "https://edwkdrgferjbitxwlwrf.supabase.co";
const { SB_KEY } = loadSupabaseEnv();
const HEADERS = {
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};

async function q(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: HEADERS });
  return res.json();
}

async function main() {
  // 1. Profiles
  console.log("=== PROFILES ===");
  const profiles = await q("profiles?select=user_id,organization_id,name,email,role&limit=100");
  console.log("Total:", Array.isArray(profiles) ? profiles.length : JSON.stringify(profiles));
  if (Array.isArray(profiles)) {
    profiles.forEach(p => console.log(`  ${p.name || p.email} | role: ${p.role} | org: ${p.organization_id}`));
  }

  // 2. Orphan interactions
  console.log("\n=== INTERACOES ORFAS ===");
  const interactions = await q("interactions?select=id,contact_id,type,created_at&limit=5000");
  const contacts = await q("contacts?select=id&limit=5000");
  const contactIds = new Set(contacts.map(c => c.id));
  const orphans = interactions.filter(i => !contactIds.has(i.contact_id));
  console.log(`Total interacoes: ${interactions.length}`);
  console.log(`Orfas (contact_id nao existe): ${orphans.length}`);
  orphans.forEach(o => {
    console.log(`  id: ${o.id} | contact_id: ${o.contact_id} | type: ${o.type} | ${o.created_at}`);
  });

  // 3. Total real de contatos (pode ter mais de 1000)
  console.log("\n=== TOTAL CONTATOS (com paginacao) ===");
  const res = await fetch(`${SB_URL}/rest/v1/contacts?select=id&limit=1`, {
    headers: { ...HEADERS, "Prefer": "count=exact", "Range": "0-0" }
  });
  const range = res.headers.get("content-range");
  console.log("Content-Range:", range);

  // 4. Contatos que nao estao em nenhum pipeline visivel
  console.log("\n=== CONTATOS SOS TELEFONE/EMAIL ===");
  const contactsFull = await q("contacts?select=id,name,phone,email,phone_normalized&phone=is.null&email=is.null&limit=20");
  console.log(`Contatos sem phone E sem email (amostra):`, contactsFull.length);
  contactsFull.slice(0, 10).forEach(c => console.log(`  ${c.name} | phone: ${c.phone} | email: ${c.email}`));
}

main().catch(console.error);
