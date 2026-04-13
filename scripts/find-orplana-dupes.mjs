import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://edwkdrgferjbitxwlwrf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ORG_ID = '86727616-4004-4604-b21b-25e8400d271d';

// Todos os emails e telefones das 35 associações ORPLANA
const ORPLANA_EMAILS = [
  'acaer@bol.com.br', 'afcop@afcop.com.br', 'afibb@afibb.com.br',
  'adm@afocanandradina.com', 'afocana@hotmail.com', 'jose.coral@cana.com.br',
  'afoporto@terra.com.br', 'apcaracatuba@terra.com.br', 'assocanaours@uol.com.br',
  'aplacana@aplacana.com.br', 'lourdes@aplana.com.br', 'associacao.apmp@gmail.com',
  'aprocana@aprocana.com.br', 'aprovale@netsite.com.br', 'diretoria@ascana.com.br',
  'asforama@asforama.com.br', 'asprovac@hotmail.com', 'assobari@assobari.com.br',
  'assocana@assocana.com.br', 'assocap@assocap.com.br', 'associcana@associacana.com.br',
  'assovale@assovale.agr.br', 'contato@assovale.com.br', 'canacanapolis@gmail.com',
  'associacao@canacampo.com.br', 'diretoria@canaoeste.com.br',
  'administrativo@canaroeira.com.br', 'canasol@canasol.com.br', 'canaussu@hotmail.com',
  'novocananh@gmail.com', 'associacao.olimpia@uol.com.br', 'oricana@oricana.com.br',
  'socicana@socicana.com.br', 'sulcanas@gmail.com', 'unicana@unicana.com.br',
];

const ORPLANA_PHONES_RAW = [
  '(64) 3437 1161', '(18) 3401 1015', '(14) 3641-1034',
  '(18) 3723 7700', '(17) 3832 3802', '(19) 3401-2200',
  '(15) 3262-1375', '(18) 3621-5915', '(14) 3324 1606',
  '(17) 3275-9670', '(34) 3284-1080', '(64) 3612 1026',
  '(64) 98459-6994', '(34) 3421 3109', '(14) 3269 1400',
  '(34) 3415 8000', '(82) 99968-0007', '(14) 3662-6180',
  '(18) 3421 3200', '(19) 3492 8100', '(14) 3622 6600',
  '(65) 99968-9334', '(16) 3626 0029', '(34) 9967 9200',
  '(34) 3322-1289', '(16) 3946 3300', '(34) 9978 8702',
  '(16) 3311 9100', '(14) 3342 1541', '(17) 3542 2752',
  '(17) 3281 1733', '(17) 3816 1128', '(16) 3251 9270',
  '(67) 99245-5599', '(17) 3342-2845',
];

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

const ORPLANA_PHONES = ORPLANA_PHONES_RAW.map(normalizePhone).filter(Boolean);

// Também extrair domínios dos emails ORPLANA para buscar variantes
const ORPLANA_DOMAINS = [...new Set(ORPLANA_EMAILS.map(e => e.split('@')[1]))];

async function main() {
  console.log('=== Buscando duplicatas sem apontamento ORPLANA ===\n');

  // 1) Buscar TODOS contatos da organização
  const { data: allContacts, error } = await supabase
    .from('contacts')
    .select('id, name, email, phone, email_normalized, phone_normalized, company, contato_nome, cidade, estado, referencia, created_at')
    .eq('organization_id', ORG_ID);

  if (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  }

  console.log(`Total de contatos na organização: ${allContacts.length}\n`);

  // 2) Identificar os contatos ORPLANA (os "apontados") pelos emails
  const orplanaEmailSet = new Set(ORPLANA_EMAILS.map(e => e.toLowerCase()));
  const orplanaPhoneSet = new Set(ORPLANA_PHONES);

  const orplanaContacts = [];
  const otherContacts = [];

  for (const c of allContacts) {
    const em = (c.email_normalized || c.email || '').toLowerCase().trim();
    const ph = c.phone_normalized || normalizePhone(c.phone);

    if (orplanaEmailSet.has(em) || orplanaPhoneSet.has(ph)) {
      orplanaContacts.push(c);
    } else {
      otherContacts.push(c);
    }
  }

  console.log(`Contatos ORPLANA (apontados): ${orplanaContacts.length}`);
  console.log(`Outros contatos: ${otherContacts.length}\n`);

  // 3) Para cada contato "outro", verificar se bate email OU telefone OU domínio com algum ORPLANA
  const duplicatesFound = [];

  for (const c of otherContacts) {
    const em = (c.email_normalized || c.email || '').toLowerCase().trim();
    const ph = c.phone_normalized || normalizePhone(c.phone);

    let matchReason = null;
    let matchedOrplana = null;

    // Checar email exato
    if (em && orplanaEmailSet.has(em)) {
      matchReason = `Email exato: ${em}`;
      matchedOrplana = orplanaContacts.find(o => (o.email_normalized || '').toLowerCase() === em);
    }

    // Checar telefone
    if (!matchReason && ph && orplanaPhoneSet.has(ph)) {
      matchReason = `Telefone: ${c.phone}`;
      matchedOrplana = orplanaContacts.find(o => (o.phone_normalized || normalizePhone(o.phone)) === ph);
    }

    // Checar se email usa o mesmo domínio de alguma associação ORPLANA
    if (!matchReason && em) {
      const domain = em.split('@')[1];
      if (domain && ORPLANA_DOMAINS.includes(domain)) {
        // Encontrar qual ORPLANA usa esse domínio
        const orplanaMatch = ORPLANA_EMAILS.find(e => e.split('@')[1] === domain);
        matchedOrplana = orplanaContacts.find(o => (o.email_normalized || '').toLowerCase().includes(domain));
        matchReason = `Mesmo domínio: @${domain} (ORPLANA: ${orplanaMatch})`;
      }
    }

    if (matchReason) {
      duplicatesFound.push({ contact: c, reason: matchReason, matchedOrplana });
    }
  }

  if (duplicatesFound.length === 0) {
    console.log('✓ Nenhuma duplicata sem apontamento encontrada!\n');
    return;
  }

  console.log(`⚠  DUPLICATAS SEM APONTAMENTO: ${duplicatesFound.length}\n`);
  console.log('─'.repeat(90));

  const deleteIds = [];

  for (const d of duplicatesFound) {
    const c = d.contact;
    console.log(`  DUPLICATA: ${c.name}`);
    console.log(`    ID:       ${c.id}`);
    console.log(`    Email:    ${c.email || '-'}`);
    console.log(`    Tel:      ${c.phone || '-'}`);
    console.log(`    Empresa:  ${c.company || '-'}`);
    console.log(`    Cidade:   ${c.cidade || '-'}/${c.estado || '-'}`);
    console.log(`    Criado:   ${c.created_at}`);
    if (d.matchedOrplana) {
      console.log(`  ORPLANA:    ${d.matchedOrplana.name}`);
    }
    console.log(`  MOTIVO:     ${d.reason}`);
    console.log('─'.repeat(90));
    deleteIds.push(c.id);
  }

  // 4) Gerar SELECT e DELETE
  const ids = deleteIds.map(id => `'${id}'`).join(',\n    ');

  console.log('\n── SELECT para conferir: ──\n');
  console.log(`SELECT id, name, company, email, phone, contato_nome, cidade, estado, created_at
FROM contacts
WHERE id IN (
    ${ids}
)
ORDER BY name;`);

  console.log('\n── DELETE para remover: ──\n');
  console.log(`-- Primeiro limpar FKs:`);
  console.log(`DELETE FROM import_run_items WHERE contact_id IN (
    ${ids}
);`);
  console.log(`DELETE FROM interactions WHERE contact_id IN (
    ${ids}
);`);
  console.log(`DELETE FROM contact_attachments WHERE contact_id IN (
    ${ids}
);`);
  console.log(`DELETE FROM meetings WHERE contact_id IN (
    ${ids}
);`);
  console.log(`DELETE FROM notifications WHERE contact_id IN (
    ${ids}
);`);
  console.log(`\n-- Depois deletar contatos:`);
  console.log(`DELETE FROM contacts WHERE id IN (
    ${ids}
);`);
}

main().catch(console.error);
