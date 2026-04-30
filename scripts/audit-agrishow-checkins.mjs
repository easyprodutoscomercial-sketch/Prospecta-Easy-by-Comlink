// Auditoria READ-ONLY do fluxo de check-in da AGRISHOW 2026.
// Nao escreve nada — so conta e lista.
//
// Uso:  node scripts/audit-agrishow-checkins.mjs
//
// Investiga 3 hipoteses do diagnostico senior:
//  (1) Visitas orfas — booth_visits sem contact_id
//  (2) Contatos sem dono — contacts.assigned_to_user_id null (some do "Meus")
//  (3) Contatos extras perdidos — booths visitados N vezes mas so 1 contato
// E olha no detalhe o caso reportado: stand MACHPARTS / contato Angela.

import { loadSupabaseEnv } from './_lib/env.mjs';

const { SB_URL, HEADERS } = loadSupabaseEnv();

async function q(table, params = '') {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers: HEADERS });
  if (!res.ok) {
    console.error(`[ERR ${res.status}] ${table}?${params}`, await res.text().catch(() => ''));
    return [];
  }
  return res.json();
}

function fmt(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return d;
  }
}

function shortId(id) {
  return id ? String(id).slice(0, 8) : '—';
}

async function main() {
  console.log('=== AUDIT AGRISHOW 2026 — CHECK-INS / CONTATOS / VISITAS ===\n');

  // 1. Acha a feira AGRISHOW 2026
  const events = await q('events', 'select=id,name,status,organization_id,start_date,end_date&order=created_at.desc');
  const agri = events.find((e) => /agrishow/i.test(e.name || '') && /2026/.test(e.name || ''));
  if (!agri) {
    console.log('Nenhum evento AGRISHOW 2026 encontrado. Eventos disponiveis:');
    events.slice(0, 10).forEach((e) => console.log(`  - ${e.name} [${shortId(e.id)}] status=${e.status}`));
    return;
  }
  console.log(`📍 Evento: ${agri.name}`);
  console.log(`   id=${agri.id}  status=${agri.status}  org=${shortId(agri.organization_id)}`);
  console.log(`   datas: ${fmt(agri.start_date)} → ${fmt(agri.end_date)}\n`);

  // 2. Profiles (vendedores)
  const profiles = await q(
    'profiles',
    `select=user_id,name,email,role&organization_id=eq.${agri.organization_id}&limit=200`
  );
  const profileById = Object.fromEntries(profiles.map((p) => [p.user_id, p]));
  const nameOf = (uid) => (profileById[uid]?.name || profileById[uid]?.email || (uid ? shortId(uid) : '—'));

  // 3. Booths
  const booths = await q(
    'event_booths',
    `select=id,company_name,booth_number,sector,status&event_id=eq.${agri.id}&limit=5000`
  );
  const boothById = Object.fromEntries(booths.map((b) => [b.id, b]));
  console.log(`🏬 Booths cadastrados: ${booths.length}`);
  const visitados = booths.filter((b) => b.status === 'VISITADO').length;
  const pendentes = booths.filter((b) => b.status !== 'VISITADO').length;
  console.log(`   VISITADO=${visitados}  outros=${pendentes}\n`);

  // 4. Visitas
  const visits = await q(
    'booth_visits',
    `select=id,booth_id,event_id,user_id,contact_id,prospect_type,notes,created_at,photo_facade_url,photo_contact_url&event_id=eq.${agri.id}&order=created_at.desc&limit=5000`
  );
  console.log(`📋 booth_visits totais na feira: ${visits.length}`);

  const visitsOrfas = visits.filter((v) => !v.contact_id);
  const visitsComContato = visits.filter((v) => v.contact_id);
  console.log(`   ✅ com contact_id: ${visitsComContato.length}`);
  console.log(`   ⚠️  ORFAS (contact_id null): ${visitsOrfas.length}  ← problema 3 do diagnostico`);

  // 4b. Visitas orfas detalhadas (top 10)
  if (visitsOrfas.length > 0) {
    console.log('\n   Detalhe das visitas orfas (max 10):');
    visitsOrfas.slice(0, 10).forEach((v) => {
      const b = boothById[v.booth_id];
      console.log(
        `     - ${b?.company_name || '?'} (stand ${b?.booth_number || '?'}) por ${nameOf(v.user_id)} em ${fmt(v.created_at)} [visit ${shortId(v.id)}]`
      );
    });
  }

  // 4c. Visitas por vendedor (com vs sem contato)
  console.log('\n📊 Por vendedor:');
  const porVendedor = {};
  for (const v of visits) {
    if (!porVendedor[v.user_id]) porVendedor[v.user_id] = { total: 0, comContato: 0, semContato: 0 };
    porVendedor[v.user_id].total += 1;
    if (v.contact_id) porVendedor[v.user_id].comContato += 1;
    else porVendedor[v.user_id].semContato += 1;
  }
  const ranking = Object.entries(porVendedor).sort((a, b) => b[1].total - a[1].total);
  ranking.forEach(([uid, s]) => {
    const flag = s.semContato > 0 ? ' ⚠️' : '';
    console.log(
      `   ${nameOf(uid).padEnd(28)}  total=${s.total}  com_contato=${s.comContato}  sem_contato=${s.semContato}${flag}`
    );
  });

  // 5. Contatos vinculados ao evento
  const contactsEv = await q(
    'contacts',
    `select=id,name,phone,email,event_id,origem,created_by_user_id,assigned_to_user_id,pipeline_id,stage_id,created_at,notes&event_id=eq.${agri.id}&limit=5000`
  );
  console.log(`\n👥 Contatos com event_id = AGRISHOW: ${contactsEv.length}`);

  const semDono = contactsEv.filter((c) => !c.assigned_to_user_id);
  const comDono = contactsEv.filter((c) => c.assigned_to_user_id);
  console.log(`   ✅ com assigned_to_user_id: ${comDono.length}`);
  console.log(`   ⚠️  SEM dono (assigned null): ${semDono.length}  ← problema 2 do diagnostico`);

  // 5b. Sem dono por criador
  if (semDono.length > 0) {
    console.log('\n   Quem criou os "sem dono" (top vendedores):');
    const porCriador = {};
    for (const c of semDono) {
      const uid = c.created_by_user_id || 'NULL';
      porCriador[uid] = (porCriador[uid] || 0) + 1;
    }
    Object.entries(porCriador)
      .sort((a, b) => b[1] - a[1])
      .forEach(([uid, n]) => {
        console.log(`     - ${uid === 'NULL' ? '(sem created_by)' : nameOf(uid)}: ${n} contatos sem dono`);
      });
  }

  // 6. Contatos com marker legacy <!--EVENT:uuid--> em notes
  const allContactsOrg = await q(
    'contacts',
    `select=id,name,event_id,notes,created_by_user_id,assigned_to_user_id,created_at&organization_id=eq.${agri.organization_id}&notes=like.*EVENT:${agri.id}*&limit=5000`
  );
  const legacyMarker = allContactsOrg.filter((c) => !c.event_id && c.notes && c.notes.includes(`<!--EVENT:${agri.id}-->`));
  if (legacyMarker.length > 0) {
    console.log(`\n🪧 Contatos com marker legacy <!--EVENT:${shortId(agri.id)}--> (sem event_id direto): ${legacyMarker.length}`);
    console.log('   ↑ Esses precisam de backfill — somem da aba "Contatos" do evento.');
  } else {
    console.log(`\n🪧 Marker legacy: 0 contatos com <!--EVENT:--> sem event_id (OK)`);
  }

  // 7. Booths "VISITADO" sem nenhuma visita registrada (estado sujo)
  const visitedBoothIds = new Set(visits.map((v) => v.booth_id));
  const boothsStatusVisitadoSemVisita = booths.filter((b) => b.status === 'VISITADO' && !visitedBoothIds.has(b.id));
  if (boothsStatusVisitadoSemVisita.length > 0) {
    console.log(`\n👻 Booths com status=VISITADO mas SEM nenhuma booth_visits: ${boothsStatusVisitadoSemVisita.length}`);
    boothsStatusVisitadoSemVisita.slice(0, 10).forEach((b) =>
      console.log(`     - ${b.company_name} (stand ${b.booth_number})`)
    );
  }

  // 8. Booths visitados N vezes mas com so 1 contato (suspeita de extras perdidos)
  const visitsPorBooth = {};
  for (const v of visits) {
    if (!visitsPorBooth[v.booth_id]) visitsPorBooth[v.booth_id] = [];
    visitsPorBooth[v.booth_id].push(v);
  }
  const boothsMultiVisita = Object.entries(visitsPorBooth)
    .map(([bid, vs]) => ({
      bid,
      booth: boothById[bid],
      total: vs.length,
      contatosUnicos: new Set(vs.filter((v) => v.contact_id).map((v) => v.contact_id)).size,
    }))
    .filter((b) => b.total >= 2)
    .sort((a, b) => b.total - a.total);
  if (boothsMultiVisita.length > 0) {
    console.log(`\n🔁 Booths com 2+ visitas (suspeitos de "Salvar Dados" repetido / extras perdidos):`);
    boothsMultiVisita.slice(0, 10).forEach((b) =>
      console.log(`     - ${b.booth?.company_name} (stand ${b.booth?.booth_number}): ${b.total} visitas, ${b.contatosUnicos} contatos unicos`)
    );
  }

  // 9. CASO ESPECIFICO: MACHPARTS
  console.log('\n========================================');
  console.log('🎯 CASO REPORTADO: stand MACHPARTS');
  console.log('========================================');
  const mach = booths.find((b) => /machparts/i.test(b.company_name || ''));
  if (!mach) {
    console.log('   ❌ Booth MACHPARTS nao encontrado nesse evento.');
  } else {
    console.log(`Booth: ${mach.company_name} | stand ${mach.booth_number} | sector ${mach.sector || '—'}`);
    console.log(`Status atual: ${mach.status}  [id ${shortId(mach.id)}]`);

    const machVisits = visits.filter((v) => v.booth_id === mach.id);
    console.log(`\nVisitas registradas (${machVisits.length}):`);
    for (const v of machVisits) {
      console.log(`  - por ${nameOf(v.user_id)} em ${fmt(v.created_at)}`);
      console.log(`    visit_id=${shortId(v.id)}  contact_id=${v.contact_id ? shortId(v.contact_id) : '⚠️ NULL'}  prospect=${v.prospect_type || '—'}`);
      console.log(`    foto_fachada=${v.photo_facade_url ? 'sim' : 'nao'}  foto_cartao=${v.photo_contact_url ? 'sim' : 'nao'}`);
      if (v.notes) console.log(`    notes: ${v.notes.slice(0, 120)}`);
    }

    // Contatos linkados (via booth_visits.contact_id)
    const machContactIds = [...new Set(machVisits.filter((v) => v.contact_id).map((v) => v.contact_id))];
    if (machContactIds.length > 0) {
      const machContacts = await q(
        'contacts',
        `select=id,name,contato_nome,cargo,phone,email,event_id,origem,created_by_user_id,assigned_to_user_id,pipeline_id,stage_id,notes&id=in.(${machContactIds.join(',')})`
      );
      console.log(`\nContatos linkados via booth_visits.contact_id (${machContacts.length}):`);
      for (const c of machContacts) {
        console.log(`  - empresa "${c.name}" / pessoa "${c.contato_nome || '⚠️ vazio'}" / cargo "${c.cargo || '—'}"`);
        console.log(`    tel=${c.phone || '—'}  email=${c.email || '—'}`);
        console.log(`    id=${shortId(c.id)}  origem=${c.origem}  event_id=${c.event_id ? '✅' : '⚠️ NULL'}`);
        console.log(`    created_by=${nameOf(c.created_by_user_id)}  assigned_to=${c.assigned_to_user_id ? nameOf(c.assigned_to_user_id) : '⚠️ NULL'}`);
      }
    }

    // Contatos com event_id que mencionam MACHPARTS no nome OU "Angela"
    // Re-busca contactsEv com contato_nome incluido pra checar candidatos por pessoa
    const contactsEvFull = await q(
      'contacts',
      `select=id,name,contato_nome,phone,email,event_id,origem,created_by_user_id,assigned_to_user_id,pipeline_id,notes&event_id=eq.${agri.id}&limit=5000`
    );
    const candidates = contactsEvFull.filter(
      (c) =>
        /angela/i.test(c.name || '') ||
        /angela/i.test(c.contato_nome || '') ||
        /machparts/i.test(c.name || '') ||
        /machparts/i.test(c.notes || '')
    );
    if (candidates.length > 0) {
      console.log(`\nCandidatos por nome "Angela" / mencao "MACHPARTS" no event_id da AGRISHOW:`);
      for (const c of candidates) {
        console.log(`  - empresa "${c.name}" / pessoa "${c.contato_nome || '—'}" / tel=${c.phone || '—'}  origem=${c.origem}`);
        console.log(`    created_by=${nameOf(c.created_by_user_id)}  assigned_to=${c.assigned_to_user_id ? nameOf(c.assigned_to_user_id) : '⚠️ NULL'}  pipeline=${shortId(c.pipeline_id)}`);
      }
    } else {
      console.log(`\n⚠️ Nenhum contato com nome "Angela" ou notes mencionando MACHPARTS encontrado vinculado a AGRISHOW.`);
    }
  }

  // 10. Resumo final
  console.log('\n========================================');
  console.log('📌 RESUMO');
  console.log('========================================');
  console.log(`Evento: ${agri.name}  status=${agri.status}`);
  console.log(`Booths: ${booths.length}  (visitado=${visitados})`);
  console.log(`booth_visits: ${visits.length}  (orfas=${visitsOrfas.length})`);
  console.log(`Contatos do evento: ${contactsEv.length}  (sem dono=${semDono.length})`);
  console.log(`Marker legacy: ${legacyMarker.length}`);
  console.log('');
  if (visitsOrfas.length > 0 || semDono.length > 0 || legacyMarker.length > 0) {
    console.log('🔧 Acoes recomendadas:');
    if (semDono.length > 0)
      console.log(`   - Backfill de assigned_to_user_id <- created_by_user_id em ${semDono.length} contatos`);
    if (visitsOrfas.length > 0)
      console.log(`   - Investigar ${visitsOrfas.length} booth_visits orfas (criar contato a partir delas?)`);
    if (legacyMarker.length > 0)
      console.log(`   - Backfill de event_id em ${legacyMarker.length} contatos com marker legacy`);
  } else {
    console.log('✅ Sem inconsistencias detectadas nesses 3 vetores.');
  }
}

main().catch((e) => {
  console.error('FALHA:', e);
  process.exit(1);
});
