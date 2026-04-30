// Recuperacao de booth_visits orfas — visitas registradas em feiras sem
// contact_id linkado. Estavam invisiveis pra dashboard de contatos do
// vendedor mesmo tendo foto, prospect_type, contact_name e notes na visita.
//
// Estrategia:
//   1. Pega todas booth_visits com contact_id IS NULL
//   2. Pra cada visita, junta com event_booth (empresa) + event (pipeline)
//   3. Procura contato existente pra (event_id + ilike(company)) — se ja
//      tiver, linka a visita a ele e atualiza campos vazios
//   4. Se nao tiver, cria um contato novo com os dados da visita
//   5. Atualiza booth_visits.contact_id apontando pro contato
//
// USO:
//   node scripts/recover-orphan-visits.mjs            # dry-run, so mostra
//   node scripts/recover-orphan-visits.mjs --apply    # executa

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

async function patch(table, id, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${table}/${id} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function insert(table, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`INSERT ${table} ${res.status}: ${await res.text()}`);
  const arr = await res.json();
  return arr[0];
}

async function main() {
  console.log(`=== RECOVERY DE booth_visits ORFAS ===  ${APPLY ? '🔥 APPLY' : '🧪 DRY RUN'}\n`);

  // 1. Visitas orfas
  // booth_visits NAO tem coluna contact_phone — telefone fica direto no
  // contato vinculado. Recovery preserva o que tem: nome, cargo, fotos,
  // prospect_type e notes.
  const visits = await q(
    'booth_visits',
    'select=id,booth_id,event_id,organization_id,user_id,user_name,contact_name,contact_role,prospect_type,notes,photo_facade_url,photo_contact_url,created_at&contact_id=is.null&order=created_at.desc&limit=5000'
  );
  console.log(`Visitas orfas totais: ${visits.length}`);
  if (visits.length === 0) {
    console.log('Nada a fazer.');
    return;
  }

  // 2. Pre-carregar booths e events relevantes
  const boothIds = [...new Set(visits.map((v) => v.booth_id).filter(Boolean))];
  const eventIds = [...new Set(visits.map((v) => v.event_id).filter(Boolean))];

  const booths = boothIds.length
    ? await q('event_booths', `select=id,company_name,booth_number&id=in.(${boothIds.join(',')})&limit=5000`)
    : [];
  const boothById = Object.fromEntries(booths.map((b) => [b.id, b]));

  const events = eventIds.length
    ? await q('events', `select=id,name,status,pipeline_id,stage_id,organization_id&id=in.(${eventIds.join(',')})&limit=200`)
    : [];
  const eventById = Object.fromEntries(events.map((e) => [e.id, e]));

  let recovered = 0;
  let createdNew = 0;
  let linkedExisting = 0;
  let skipped = 0;
  const skippedReasons = {};

  for (const v of visits) {
    const booth = boothById[v.booth_id];
    const ev = eventById[v.event_id];
    if (!booth) {
      skipped++;
      skippedReasons['booth_nao_existe'] = (skippedReasons['booth_nao_existe'] || 0) + 1;
      continue;
    }
    if (!ev) {
      skipped++;
      skippedReasons['event_nao_existe'] = (skippedReasons['event_nao_existe'] || 0) + 1;
      continue;
    }
    if (!ev.pipeline_id) {
      skipped++;
      skippedReasons['event_sem_pipeline'] = (skippedReasons['event_sem_pipeline'] || 0) + 1;
      continue;
    }

    const company = (booth.company_name || '').trim();

    // 3. Procura contato existente pra empresa nesse evento
    let existing = null;
    if (company) {
      const found = await q(
        'contacts',
        `select=id,name,contato_nome,company,phone,email&organization_id=eq.${v.organization_id}&event_id=eq.${ev.id}&company=ilike.${encodeURIComponent(company)}&order=created_at.asc&limit=1`
      );
      existing = found[0] || null;
    }

    if (existing) {
      // Linka visita ao contato e atualiza campos vazios
      const patchContact = {};
      if (v.contact_name && !existing.contato_nome) patchContact.contato_nome = v.contact_name;
      if (v.contact_role) patchContact.cargo = v.contact_role;

      if (APPLY) {
        if (Object.keys(patchContact).length > 0) {
          await patch('contacts', existing.id, patchContact);
        }
        await patch('booth_visits', v.id, { contact_id: existing.id });
      }
      console.log(
        `  🔗 visit ${v.id.slice(0, 8)} (${booth.company_name} stand ${booth.booth_number}) → contato existente ${existing.id.slice(0, 8)}${
          Object.keys(patchContact).length > 0 ? ' (+update)' : ''
        }`
      );
      linkedExisting++;
      recovered++;
      continue;
    }

    // 4. Cria novo contato
    const empresaName = company || v.contact_name || 'Stand sem identificacao';
    const tipoArr = v.prospect_type === 'AMBOS' ? ['COMPRADOR', 'FORNECEDOR'] : [v.prospect_type || 'COMPRADOR'];
    const userNotes = v.notes ? String(v.notes).replace(/\n<!--EXTRA:.*?-->/s, '').trim() : '';

    const payload = {
      organization_id: v.organization_id,
      name: empresaName,
      contato_nome: v.contact_name || null,
      company: company || null,
      cargo: v.contact_role || null,
      pipeline_id: ev.pipeline_id,
      stage_id: ev.stage_id,
      origem: 'FEIRA',
      event_id: ev.id,
      tipo: tipoArr,
      notes: userNotes ? `[Feira - recovery] ${userNotes}` : '[Feira - recovery]',
      status: 'NOVO',
      created_by_user_id: v.user_id,
      assigned_to_user_id: v.user_id,
      name_normalized: empresaName.toLowerCase().trim(),
      avatar_url: v.photo_contact_url || null,
    };

    if (APPLY) {
      try {
        const created = await insert('contacts', payload);
        await patch('booth_visits', v.id, { contact_id: created.id });
        console.log(
          `  ✨ visit ${v.id.slice(0, 8)} (${booth.company_name} stand ${booth.booth_number}) → contato NOVO ${created.id.slice(0, 8)} pessoa="${v.contact_name || '—'}"`
        );
      } catch (e) {
        skipped++;
        skippedReasons['insert_falhou'] = (skippedReasons['insert_falhou'] || 0) + 1;
        console.error(`  ❌ visit ${v.id.slice(0, 8)} INSERT falhou:`, e.message);
        continue;
      }
    } else {
      console.log(
        `  ✨ [dry] visit ${v.id.slice(0, 8)} (${booth.company_name} stand ${booth.booth_number}) → criaria contato com pessoa="${v.contact_name || '—'}"`
      );
    }
    createdNew++;
    recovered++;
  }

  console.log('\n=== RESUMO ===');
  console.log(`Visitas processadas: ${visits.length}`);
  console.log(`Recuperaveis: ${recovered}`);
  console.log(`  - Linkadas a contato existente: ${linkedExisting}`);
  console.log(`  - Contato novo criado: ${createdNew}`);
  console.log(`Skipped: ${skipped}`);
  if (Object.keys(skippedReasons).length > 0) {
    Object.entries(skippedReasons).forEach(([reason, n]) => console.log(`  - ${reason}: ${n}`));
  }

  if (!APPLY) {
    console.log('\n💡 Roda com --apply pra executar.');
  }
}

main().catch((e) => {
  console.error('FALHA:', e);
  process.exit(1);
});
