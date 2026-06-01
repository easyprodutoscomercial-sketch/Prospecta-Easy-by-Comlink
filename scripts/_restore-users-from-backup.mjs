// Restaura os 16 usuarios do banco antigo no novo, preservando UUIDs e hashes
// bcrypt das senhas. Apos isso, religa os 2295 contatos aos donos originais
// usando o "ID Dono" do CSV.

import { readFileSync } from 'fs';
import XLSX from 'xlsx';

const SBP = process.env.SBP_TOKEN || '';
const API = `https://api.supabase.com/v1/projects/otemsbhhtygjwokvxlir/database/query`;
const ORG_ID = '86727616-4004-4604-b21b-25e8400d271d';
const PIPELINE_ID = 'ca0488f4-ae6d-4ce7-bc34-0afeeeb4a521';
const CSV_CONTACTS = 'C:/Users/josimar.silva/Downloads/Supabase Snippet Add Cover Image URL to Events (2).csv';

const USERS = [
  { id: 'ecf7c384-8329-4065-9cd5-25fae5793ae0', name: 'Angelica Benzi Frazão', email: 'angelica.frazao@comlinksa.com', role: 'user', hash: '$2a$10$zIq5cJtC2oTKJ555gTr5f.YbSHG.mPhckcDYB0Fo5t41ETy01B7q6' },
  { id: '1a22087a-7b2f-47cb-923f-f9eadf114ff9', name: 'Bhianka Martins', email: 'bhianka.martins@comlinksa.com', role: 'user', hash: '$2a$10$QiUvws/a53H26vu66urLAu4NR/hfBy4CEdzl/RlwQOPkHnLBog0qe' },
  { id: 'fe5d80f0-bd60-49fa-96e3-79344f119b95', name: 'Carla Santos', email: 'carla@comlinksa.com', role: 'user', hash: '$2a$10$wSjJhUQecc9K7SgiYaexFehse2fxrrjCZzb3oMKR6VF4pxJtNlOmG' },
  { id: '7147cffe-3efd-4bd3-8772-ef53d4094c1f', name: 'Claudia Gonzalez', email: 'claudia.gonzalez@comlinksa.com', role: 'user', hash: '$2a$10$tdDTV8tI1oUhaVsozU5sMupj/bVr2jlIL9sGGXFVjKEqQJnhx6/KW' },
  { id: 'c0aa3bb3-523b-4930-8947-cf245ac9bbbb', name: 'Daniel Lima', email: 'daniel.lima@easycomlink.com', role: 'user', hash: '$2a$10$lW.Sosm.Rimtl27riXWR8O.5O8TjXc9jQVfhaICRMulSXubv.p3LK' },
  { id: '4eae23ed-4d62-4370-90f3-765c546d6dfa', name: 'Emerson Alves', email: 'emerson.alves@comlinksa.com', role: 'user', hash: '$2a$10$TU3jQLGx4C8xusjSUYgx/uQZm8dBCHgoNfzBaQ.SKJAjP/zNASPvy' },
  { id: 'a2e6bb0f-3153-4b3c-8291-f058b75d5415', name: 'Fabiola Novo', email: 'fabiola.novo@comlinksa.com', role: 'user', hash: '$2a$10$Si7YNAFCqSgE0X10cNqP3uzL3fXUNdsuNAIb.sbGUltVT3M9ui/KC' },
  { id: '040d6d93-1067-4cec-ad23-05cc7175a724', name: 'Fernando Gomes', email: 'fernando.gomes@easycomlink.com', role: 'user', hash: '$2a$10$aPHxieA.uZXfRdl/JhJMUuKDlNDYYaUR1VaIyJDb/NFnvFacEcS9S' },
  { id: 'ec1e1aca-4199-4e75-8015-f5d4ca124a4a', name: 'Guilherme Tomaso Ferraz', email: 'guilherme.ferraz@comlinksa.com', role: 'user', hash: '$2a$10$KczoJ5PUYe0Jm2FHMTyd8ez5t7pGWR2mE65tlNRLCJlAqkVCHJhH2' },
  { id: '32219655-f4b5-4d0f-b5c3-cb4026af4956', name: 'Jean Gustavo', email: 'jean.gustavo@comlinksa.com', role: 'user', hash: '$2a$10$wmbA2qRbBxmweRThGM/5mu9KZUzWWumDBIAoAZCc81N1xtKdquGiS' },
  { id: 'e2c6b555-6132-4eee-bf3f-d48d81adde8d', name: 'Lucas Gutierres', email: 'lucas.gutierres@comlinksa.com', role: 'user', hash: '$2a$10$odprpxOfW9hjpXxlnIQvxeMQZm6fAisGZwuqfrudGImntW0QFOVuq' },
  { id: 'b2de11c5-1496-40fe-a685-d9b165a4d313', name: 'Mario Sergio Assumpção', email: 'mario.sergio@comlinksa.com', role: 'user', hash: '$2a$10$/v5qrk.0yyPm5w3a4eOSBOYhqB3H4ObIlIXrspl/XKnIXiVg61Mqu' },
  { id: '5cdbdd56-4397-4705-9503-9821cd533b64', name: 'Rodrigo Oliveira', email: 'rodrigo.oliveira@easycomlink.com', role: 'user', hash: '$2a$10$DpNOq0gnrcG7dYtHXK2eYuiTqRxlfbVSBToY9LFI2qQeDJN6Ak4LG' },
  { id: 'ad9330f9-3af8-4897-a4eb-d49d77e7468e', name: 'Sara Ribeiro', email: 'sara.ribeiro@comlinksa.com', role: 'user', hash: '$2a$10$VYpF/AxvJe7pMqe12TzXBOg52FWBFHaIC7fue6BpI5N4DRfQhDCJS' },
  { id: 'c15a6cf5-1c72-49f2-babb-cb0b481997a7', name: 'Tania Marcia Borges', email: 'tania.borges@comlinksa.com', role: 'user', hash: '$2a$10$CevG2XZQdbbIhZOdGsMbQOSRkunJY2oXtroG3J0B3nsY.HFjXdeee' },
  { id: 'a87915ba-da84-4555-b9b4-e191d6242427', name: 'Josimar Mariano', email: 'josimar@easycomlink.com', role: 'admin', hash: '$2a$10$dK9wzJtbnQdpKSu/MAw.Ou.V8/W3lzfj9OEM.LfzNdrZUOWEuvur6' },
];

async function sql(query, label) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SBP}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await r.text();
  if (!r.ok) {
    console.error(`❌ ${label}: ${body.slice(0, 300)}`);
    return null;
  }
  console.log(`✅ ${label}`);
  try { return JSON.parse(body); } catch { return null; }
}

// === 1) DELETAR user temp criado anteriormente (UUID novo a9d8f356...) ===
console.log('=== Limpando user temporario criado anteriormente ===');
await sql(`DELETE FROM pipeline_members WHERE user_id = 'a9d8f356-5c9a-4f49-aa87-e8497751c474'::uuid`, 'pipeline_members do user temp');
await sql(`DELETE FROM profiles WHERE user_id = 'a9d8f356-5c9a-4f49-aa87-e8497751c474'::uuid`, 'profile do user temp');
await sql(`DELETE FROM auth.users WHERE id = 'a9d8f356-5c9a-4f49-aa87-e8497751c474'::uuid`, 'auth.user do temp');

// === 2) CRIAR os 16 users em auth.users com UUIDs e hashes originais ===
console.log('\n=== Criando 16 users em auth.users ===');
for (const u of USERS) {
  const meta = JSON.stringify({ name: u.name, email_verified: true }).replace(/'/g, "''");
  const q = `
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      '${u.id}'::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      '${u.email}',
      '${u.hash}',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '${meta}'::jsonb,
      now(),
      now()
    ) ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      encrypted_password = EXCLUDED.encrypted_password,
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, EXCLUDED.email_confirmed_at)
  `;
  await sql(q, `auth.users: ${u.name}`);
}

// === 3) CRIAR/atualizar profiles ===
console.log('\n=== Criando profiles ===');
for (const u of USERS) {
  const q = `
    INSERT INTO profiles (user_id, organization_id, name, email, role)
    VALUES ('${u.id}'::uuid, '${ORG_ID}'::uuid, '${u.name.replace(/'/g, "''")}', '${u.email}', '${u.role}')
    ON CONFLICT (user_id) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role
  `;
  await sql(q, `profile: ${u.name}`);
}

// === 4) Adicionar como membros do pipeline ===
console.log('\n=== Adicionando como pipeline_members ===');
for (const u of USERS) {
  await sql(
    `INSERT INTO pipeline_members (pipeline_id, user_id) VALUES ('${PIPELINE_ID}'::uuid, '${u.id}'::uuid) ON CONFLICT DO NOTHING`,
    `pipeline_member: ${u.name}`
  );
}

// === 5) RELIGAR contatos aos donos originais (assigned_to + created_by) ===
console.log('\n=== Religando contatos aos donos originais via CSV ===');
const buf = readFileSync(CSV_CONTACTS);
const wb = XLSX.read(buf, { type: 'buffer', codepage: 65001 });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: null });

const validUserIds = new Set(USERS.map((u) => u.id));
let updates = 0;
let batchUpdates = [];

for (const r of rows) {
  const contactId = r['ID do Contato'];
  if (!contactId) continue;
  const dono = r['ID Dono'];
  const criador = r['ID Criador'];
  const sets = [];
  if (dono && validUserIds.has(dono)) sets.push(`assigned_to_user_id = '${dono}'::uuid`);
  if (criador && validUserIds.has(criador)) sets.push(`created_by_user_id = '${criador}'::uuid`);
  if (sets.length === 0) continue;
  batchUpdates.push(`UPDATE contacts SET ${sets.join(', ')} WHERE id = '${contactId}'::uuid`);
}

console.log(`Total de UPDATEs a fazer: ${batchUpdates.length}`);

// Roda em batches de 50 statements (semicolon separated)
const BATCH = 50;
for (let i = 0; i < batchUpdates.length; i += BATCH) {
  const chunk = batchUpdates.slice(i, i + BATCH).join(';\n');
  const r = await sql(chunk, `batch update ${i}-${i + BATCH}`);
  if (r !== null) updates += Math.min(BATCH, batchUpdates.length - i);
}

// === 6) VERIFICACAO FINAL ===
console.log('\n=== Verificacao final ===');
const final = await sql(`
  SELECT
    (SELECT count(*) FROM auth.users) as auth_users,
    (SELECT count(*) FROM profiles) as profiles,
    (SELECT count(*) FROM pipeline_members) as pipeline_members,
    (SELECT count(*) FROM contacts WHERE assigned_to_user_id IS NOT NULL) as contatos_com_dono,
    (SELECT count(*) FROM contacts WHERE created_by_user_id IS NOT NULL) as contatos_com_criador
`, 'contagem final');
console.log(JSON.stringify(final, null, 2));
