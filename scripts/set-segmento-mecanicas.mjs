import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://edwkdrgferjbitxwlwrf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY no ambiente');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Buscar contatos criados hoje (09/03/2026) que nao tem segmento
const today = '2026-03-09T00:00:00.000Z';
const tomorrow = '2026-03-10T00:00:00.000Z';

const { data: contacts, error: fetchError } = await supabase
  .from('contacts')
  .select('id, name, segmento, created_at')
  .gte('created_at', today)
  .lt('created_at', tomorrow);

if (fetchError) {
  console.error('Erro ao buscar contatos:', fetchError.message);
  process.exit(1);
}

console.log(`Encontrados ${contacts.length} contatos criados hoje:`);
contacts.forEach(c => console.log(`  - ${c.name} | segmento atual: ${c.segmento || '(vazio)'}`));

const semSegmento = contacts.filter(c => !c.segmento);
console.log(`\n${semSegmento.length} contatos sem segmento — atualizando para "Mecanicas"...`);

if (semSegmento.length === 0) {
  console.log('Nenhum contato para atualizar.');
  process.exit(0);
}

const ids = semSegmento.map(c => c.id);

const { data: updated, error: updateError } = await supabase
  .from('contacts')
  .update({ segmento: 'Mecanicas' })
  .in('id', ids)
  .select('id, name, segmento');

if (updateError) {
  console.error('Erro ao atualizar:', updateError.message);
  process.exit(1);
}

console.log(`\nAtualizado ${updated.length} contatos:`);
updated.forEach(c => console.log(`  ✔ ${c.name} → segmento: ${c.segmento}`));
