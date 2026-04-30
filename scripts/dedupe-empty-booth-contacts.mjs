// Dedupe de contatos placeholders criados pelo auto_create antes do fix.
//
// Sintoma: dois contatos pra mesmo (event_id + company), onde um tem
// contato_nome/phone preenchido (criado pelo "Registrar Check-in") e outro
// e VAZIO (criado pelo auto_create do panel-open ou ensureContactForVisit).
//
// Estrategia:
//   1. Agrupa contatos com origem=FEIRA por (event_id, company normalizado)
//   2. Pra cada grupo com 2+:
//      - Se exatamente 1 tem contato_nome+phone preenchido → mantem esse,
//        deleta o vazio (mas so se o vazio nao tiver booth_visits linkadas
//        e nem interactions/meetings/attachments)
//      - Se 2+ tem dados → NAO deleta (precisa decisao manual)
//      - Se todos vazios → mantem o mais antigo, deleta o resto
//
// USO:
//   node scripts/dedupe-empty-booth-contacts.mjs            # dry-run
//   node scripts/dedupe-empty-booth-contacts.mjs --apply    # executa

import { loadSupabaseEnv } from './_lib/env.mjs';

const APPLY = process.argv.includes('--apply');
const { SB_URL, HEADERS } = loadSupabaseEnv();

async function q(table, params = '') {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers: HEADERS });
  if (!res.ok) {
    console.error(`[ERR ${res.status}] ${table}?${params}`, await res.text());
    return [];
  }
  return res.json();
}

async function del(table, id) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`DELETE ${table}/${id} ${res.status}: ${await res.text()}`);
}

function isEmpty(c) {
  // Vazio = sem pessoa, sem telefone, sem email
  return !c.contato_nome && !c.phone && !c.email;
}

async function main() {
  console.log(`=== DEDUPE PLACEHOLDERS DE FEIRA ===  ${APPLY ? '🔥 APPLY' : '🧪 DRY RUN'}\n`);

  // Pega todos contatos com origem=FEIRA + event_id (so onde tem booth)
  const contacts = await q(
    'contacts',
    'select=id,name,contato_nome,company,phone,email,event_id,created_at,created_by_user_id&origem=eq.FEIRA&event_id=not.is.null&limit=10000'
  );
  console.log(`Contatos de feira analisados: ${contacts.length}`);

  // Agrupa por (event_id + company normalizado)
  const groups = {};
  for (const c of contacts) {
    const key = `${c.event_id}::${(c.company || c.name || '').toLowerCase().trim()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  const dupGroups = Object.entries(groups).filter(([, arr]) => arr.length > 1);
  console.log(`Grupos com 2+ contatos pra mesma empresa+evento: ${dupGroups.length}`);

  let toDelete = [];
  let manualReview = 0;

  for (const [key, arr] of dupGroups) {
    arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const empty = arr.filter(isEmpty);
    const filled = arr.filter((c) => !isEmpty(c));

    if (empty.length === 0) {
      // Todos preenchidos — deixa pra decisao manual
      manualReview++;
      console.log(`  ⚠️ ${key.split('::')[1]}: ${arr.length} contatos PREENCHIDOS — review manual`);
      continue;
    }

    if (filled.length === 0) {
      // Todos vazios — mantem o mais antigo
      const keep = empty[0];
      const drop = empty.slice(1);
      console.log(`  🧹 ${key.split('::')[1]}: ${arr.length} placeholders vazios — manter ${keep.id.slice(0, 8)} (mais antigo), descartar ${drop.length}`);
      toDelete.push(...drop);
      continue;
    }

    // Caso comum: 1+ preenchido + 1+ vazio
    // Manter o mais antigo entre os preenchidos, descartar TODOS os vazios
    const keep = filled.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
    console.log(
      `  ✂️ ${key.split('::')[1]}: ${filled.length} cheio(s) + ${empty.length} vazio(s) — manter ${keep.id.slice(0, 8)} ("${keep.contato_nome || keep.phone || '?'}"), descartar ${empty.length} vazio(s)`
    );
    toDelete.push(...empty);
    if (filled.length > 1) {
      console.log(
        `    ⚠️ Outros ${filled.length - 1} preenchido(s) deixados pra review manual:`
      );
      filled.slice(1).forEach((c) =>
        console.log(`       - ${c.id.slice(0, 8)} pessoa="${c.contato_nome || '—'}" tel="${c.phone || '—'}"`)
      );
    }
  }

  console.log(`\nPlaceholders vazios identificados pra delecao: ${toDelete.length}`);
  console.log(`Grupos que precisam review manual: ${manualReview}`);

  if (toDelete.length === 0) {
    console.log('\nNada a deletar.');
    return;
  }

  // Antes de deletar: verifica se algum dos "vazios" tem dependencias
  // (booth_visits, interactions, meetings, attachments). Se tiver, pula.
  const safeToDelete = [];
  const blocked = [];

  for (const c of toDelete) {
    const [bv, inter, meet, att] = await Promise.all([
      q('booth_visits', `select=id&contact_id=eq.${c.id}&limit=1`),
      q('interactions', `select=id&contact_id=eq.${c.id}&limit=1`),
      q('meetings', `select=id&contact_id=eq.${c.id}&limit=1`),
      q('contact_attachments', `select=id&contact_id=eq.${c.id}&limit=1`),
    ]);
    const refs = [];
    if (bv.length > 0) refs.push('booth_visits');
    if (inter.length > 0) refs.push('interactions');
    if (meet.length > 0) refs.push('meetings');
    if (att.length > 0) refs.push('attachments');
    if (refs.length > 0) {
      blocked.push({ contact: c, refs });
    } else {
      safeToDelete.push(c);
    }
  }

  console.log(`\nSeguros pra deletar: ${safeToDelete.length}`);
  console.log(`Bloqueados (tem dependencias): ${blocked.length}`);
  if (blocked.length > 0) {
    blocked.forEach(({ contact, refs }) =>
      console.log(`  - ${contact.id.slice(0, 8)} (${contact.company || contact.name}) tem refs em: ${refs.join(', ')}`)
    );
  }

  if (!APPLY) {
    console.log('\n💡 Roda com --apply pra executar a delecao dos seguros.');
    return;
  }

  let deleted = 0;
  let failed = 0;
  for (const c of safeToDelete) {
    try {
      await del('contacts', c.id);
      deleted++;
    } catch (e) {
      failed++;
      console.error(`  ❌ Falha ao deletar ${c.id}:`, e.message);
    }
  }
  console.log(`\n✅ Deletados: ${deleted}`);
  if (failed > 0) console.log(`❌ Falhas: ${failed}`);
}

main().catch((e) => {
  console.error('FALHA:', e);
  process.exit(1);
});
