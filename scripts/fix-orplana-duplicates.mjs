import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://edwkdrgferjbitxwlwrf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

function normalizeEmail(email) {
  if (!email) return null;
  return email.trim().toLowerCase();
}

function normalizeName(name) {
  if (!name) return '';
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// IDs dos registros que batem por email mas NÃO são as associações ORPLANA
const TO_DELETE = [
  { id: 'b9b2d1b0-7cf3-4cb0-9b17-9e76294d909a', name: 'Paulo Junqueira',  email: 'contato@assovale.com.br',   replacement: 'ASSOVALE SP' },
  { id: 'a5b5403d-858d-4b30-b328-0eba61a6726e', name: 'Marcio Meloni',    email: 'diretoria@canaoeste.com.br', replacement: 'CANAOESTE' },
];

// Dados corretos das associações para reimportar
const TO_INSERT = [
  {
    name: "ASSOVALE SP - Associação Rural Vale do Rio Pardo",
    phone: "(16) 3626 0029",
    email: "contato@assovale.com.br",
    company: "ASSOVALE SP",
    notes: "Presidente: Paulo Maximiano Junqueira Neto | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Paulo Maximiano Junqueira Neto",
    cargo: "Presidente",
    endereco: "R. Caraguatatuba, nº 4.000 Jardim Jóquei Clube",
    cidade: "Ribeirão Preto",
    estado: "SP",
    cep: "14.078-548",
    website: "http://www.assovale.com.br",
  },
  {
    name: "CANAOESTE - Associação dos Plantadores de Cana do Oeste do Estado de São Paulo",
    phone: "(16) 3946 3300",
    email: "diretoria@canaoeste.com.br",
    company: "CANAOESTE",
    notes: "Presidente: Fernando dos Reis Filho | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Fernando dos Reis Filho",
    cargo: "Presidente",
    endereco: "Rua Pio Dufles, 532",
    cidade: "Sertãozinho",
    estado: "SP",
    cep: "14.170-680",
    website: "http://www.canaoeste.com.br",
    instagram: "@canaoesteoficial",
  },
];

async function main() {
  console.log('=== Correção de duplicatas ORPLANA ===\n');

  // 1) Mostrar o que vai ser deletado
  console.log('── Registros a DELETAR (não são associações ORPLANA): ──\n');
  for (const rec of TO_DELETE) {
    const { data } = await supabase
      .from('contacts')
      .select('id, name, email, phone, company, contato_nome, cidade, estado, notes')
      .eq('id', rec.id)
      .single();

    if (data) {
      console.log(`  ID:      ${data.id}`);
      console.log(`  Nome:    ${data.name}`);
      console.log(`  Email:   ${data.email}`);
      console.log(`  Tel:     ${data.phone}`);
      console.log(`  Empresa: ${data.company || '-'}`);
      console.log(`  Cidade:  ${data.cidade || '-'}/${data.estado || '-'}`);
      console.log(`  → Será substituído por: ${rec.replacement}`);
      console.log('');
    } else {
      console.log(`  ID ${rec.id} não encontrado (já deletado?)\n`);
    }
  }

  // 2) Deletar registros associados (foreign keys)
  for (const rec of TO_DELETE) {
    // import_run_items
    const { error: iriError } = await supabase
      .from('import_run_items')
      .delete()
      .eq('contact_id', rec.id);
    if (iriError) console.log(`  ⚠ import_run_items ${rec.name}: ${iriError.message}`);

    // interactions
    const { error: intError } = await supabase
      .from('interactions')
      .delete()
      .eq('contact_id', rec.id);
    if (intError) console.log(`  ⚠ interactions ${rec.name}: ${intError.message}`);

    // contact_attachments
    const { error: attError } = await supabase
      .from('contact_attachments')
      .delete()
      .eq('contact_id', rec.id);
    if (attError) console.log(`  ⚠ attachments ${rec.name}: ${attError.message}`);

    // meetings
    const { error: meetError } = await supabase
      .from('meetings')
      .delete()
      .eq('contact_id', rec.id);
    if (meetError) console.log(`  ⚠ meetings ${rec.name}: ${meetError.message}`);

    // notifications
    const { error: notifError } = await supabase
      .from('notifications')
      .delete()
      .eq('contact_id', rec.id);
    if (notifError) console.log(`  ⚠ notifications ${rec.name}: ${notifError.message}`);

    // order_items (pedidos)
    const { error: oiError } = await supabase
      .from('order_items')
      .delete()
      .eq('contact_id', rec.id);
    if (oiError && !oiError.message.includes('does not exist')) console.log(`  ⚠ order_items ${rec.name}: ${oiError.message}`);

    // orders
    const { error: ordError } = await supabase
      .from('orders')
      .delete()
      .eq('contact_id', rec.id);
    if (ordError && !ordError.message.includes('does not exist')) console.log(`  ⚠ orders ${rec.name}: ${ordError.message}`);
  }

  // 3) Deletar contatos
  const ids = TO_DELETE.map(r => r.id);
  const { error: delError, count } = await supabase
    .from('contacts')
    .delete()
    .in('id', ids);

  if (delError) {
    console.error(`✗ Erro ao deletar: ${delError.message}`);
    process.exit(1);
  }

  console.log(`✓ ${TO_DELETE.length} registros deletados com sucesso.\n`);

  // 4) Buscar org e pipeline para inserir
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single();

  const orgId = orgs.id;

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  const { data: firstStage } = pipeline
    ? await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', pipeline.id)
        .order('position', { ascending: true })
        .limit(1)
        .single()
    : { data: null };

  // Buscar um user_id válido (pegar qualquer contato existente pra copiar o created_by)
  const { data: sampleContact } = await supabase
    .from('contacts')
    .select('created_by_user_id')
    .eq('organization_id', orgId)
    .not('created_by_user_id', 'is', null)
    .limit(1)
    .single();

  const userId = sampleContact?.created_by_user_id;
  if (!userId) {
    // Fallback: buscar na tabela profiles
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .single();

    if (!profileData) {
      console.error('Nenhum usuário encontrado.');
      process.exit(1);
    }
    var fallbackUserId = profileData.id;
  }
  const finalUserId = userId || fallbackUserId;

  // 5) Inserir registros corretos
  console.log('── Inserindo associações ORPLANA corretas: ──\n');

  for (const contact of TO_INSERT) {
    const ph = normalizePhone(contact.phone);
    const em = normalizeEmail(contact.email);

    const row = {
      organization_id: orgId,
      name: contact.name,
      name_normalized: normalizeName(contact.name),
      phone: contact.phone,
      phone_normalized: ph,
      email: contact.email,
      email_normalized: em,
      company: contact.company,
      notes: contact.notes,
      referencia: contact.referencia,
      contato_nome: contact.contato_nome,
      cargo: contact.cargo,
      endereco: contact.endereco,
      cidade: contact.cidade,
      estado: contact.estado,
      cep: contact.cep,
      website: contact.website || null,
      instagram: contact.instagram || null,
      created_by_user_id: finalUserId,
      tipo: ['FORNECEDOR'],
      segmento: 'ASSOCIAÇÃO',
      status: 'NOVO',
      ...(pipeline ? { pipeline_id: pipeline.id } : {}),
      ...(firstStage ? { stage_id: firstStage.id } : {}),
    };

    const { error: insertError } = await supabase
      .from('contacts')
      .insert(row);

    if (insertError) {
      console.error(`  ✗ Erro ao inserir ${contact.company}: ${insertError.message}`);
    } else {
      console.log(`  ✓ ${contact.company} - ${contact.cidade}/${contact.estado}`);
    }
  }

  console.log('\n=== Concluído ===');
}

main().catch(console.error);
