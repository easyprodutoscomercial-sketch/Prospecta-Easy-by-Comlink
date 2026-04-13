import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://edwkdrgferjbitxwlwrf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ORG_ID = '86727616-4004-4604-b21b-25e8400d271d';
const USER_ID = 'a87915ba-da84-4555-b9b4-e191d6242427';

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

function normalizeName(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

async function main() {
  // Get pipeline/stage
  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('organization_id', ORG_ID)
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

  const contacts = [
    {
      name: "ASSOVALE SP - Associação Rural Vale do Rio Pardo",
      phone: "(16) 3626 0029",
      email: "contato@assovale.com.br",
      company: "ASSOVALE SP",
      notes: "Presidente: Paulo Maximiano Junqueira Neto | Associação filiada à ORPLANA",
      referencia: "ORPLANA - orplana.com.br/associacoes",
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
      referencia: "ORPLANA - orplana.com.br/associacoes",
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

  console.log('Inserindo 2 associações ORPLANA...\n');

  for (const c of contacts) {
    const row = {
      organization_id: ORG_ID,
      created_by_user_id: USER_ID,
      name: c.name,
      name_normalized: normalizeName(c.name),
      phone: c.phone,
      phone_normalized: normalizePhone(c.phone),
      email: c.email,
      email_normalized: c.email.toLowerCase().trim(),
      company: c.company,
      notes: c.notes,
      referencia: c.referencia,
      contato_nome: c.contato_nome,
      cargo: c.cargo,
      endereco: c.endereco,
      cidade: c.cidade,
      estado: c.estado,
      cep: c.cep,
      website: c.website || null,
      instagram: c.instagram || null,
      tipo: ['FORNECEDOR'],
      segmento: 'ASSOCIAÇÃO',
      status: 'NOVO',
      ...(pipeline ? { pipeline_id: pipeline.id } : {}),
      ...(firstStage ? { stage_id: firstStage.id } : {}),
    };

    const { data, error } = await supabase
      .from('contacts')
      .insert(row)
      .select('id, name')
      .single();

    if (error) {
      console.error(`✗ ${c.company}: ${error.message}`);
    } else {
      console.log(`✓ ${c.company} - ${c.cidade}/${c.estado} (id: ${data.id})`);
    }
  }

  console.log('\nConcluído!');
}

main().catch(console.error);
