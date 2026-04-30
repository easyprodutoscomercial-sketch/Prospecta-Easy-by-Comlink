// Seed de 50 stands fake para o evento ORPLANA (teste do mapa interativo)
// Uso: node scripts/seed-orplana-booths.mjs
//
// As credenciais abaixo são lidas das variáveis de ambiente, se definidas.
// Caso contrário caem no fallback hardcoded (mesmo usado em run-migration-cover.mjs).

import { loadSupabaseManagementToken } from './_lib/env.mjs';
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'edwkdrgferjbitxwlwrf';
const PAT = loadSupabaseManagementToken();

const EVENT_ID = 'e3587964-856e-490a-a06a-ec7da93421ff';
const ORG_ID = '86727616-4004-4604-b21b-25e8400d271d';

const sectors = [
  {
    name: 'Usinas',
    col: 'A',
    x: 12,
    companies: [
      'Usina São Martinho',
      'Usina Coruripe',
      'Usina Santa Terezinha',
      'Usina Jalles Machado',
      'Usina Batatais',
      'Usina Alta Mogiana',
      'Usina Cocal',
      'Usina Vale do Paraná',
      'Usina Delta',
      'Usina Rio Pardo',
    ],
  },
  {
    name: 'Fornecedores',
    col: 'B',
    x: 30,
    companies: [
      'Case IH Brasil',
      'John Deere',
      'Jacto Máquinas',
      'Valtra Agro',
      'New Holland',
      'Massey Ferguson',
      'Stara Implementos',
      'DMB Máquinas',
      'Montana Indústria',
      'Baldan Implementos',
    ],
  },
  {
    name: 'Insumos',
    col: 'C',
    x: 48,
    companies: [
      'Bayer CropScience',
      'Syngenta',
      'BASF Agro',
      'Corteva Agriscience',
      'FMC Agrícola',
      'UPL do Brasil',
      'Yara Fertilizantes',
      'Mosaic Fertilizantes',
      'Heringer Fertilizantes',
      'Adubos Araguaia',
    ],
  },
  {
    name: 'Serviços',
    col: 'D',
    x: 66,
    companies: [
      'Sicredi Agro',
      'Banco do Brasil Agro',
      'SulAmérica Rural',
      'Mapfre Agro',
      'Rural Seguros',
      'Agroanálise',
      'Consultoria Canavial',
      'Solos Consulting',
      'Agro Jurídico',
      'Agro Contábil',
    ],
  },
  {
    name: 'Tecnologia',
    col: 'E',
    x: 84,
    companies: [
      'Solinftec',
      'Agrosmart',
      'Climate FieldView',
      'Taranis Brasil',
      'Strider Satélites',
      'CNH Industrial Tech',
      'Agrible',
      'Plantio Direto Digital',
      'SensorAgro',
      'IoT Canavieira',
    ],
  },
];

// 10 valores de y distribuídos de 8 a 90
const yValues = [8, 17, 26, 35, 44, 53, 62, 71, 80, 89];

const records = [];
for (const sector of sectors) {
  for (let i = 0; i < sector.companies.length; i++) {
    const boothNumber = `${sector.col}${String(i + 1).padStart(2, '0')}`;
    // Jitter pequeno no x pra não ficar tudo alinhado
    const jitter = (Math.random() - 0.5) * 3;
    records.push({
      company_name: sector.companies[i],
      booth_number: boothNumber,
      sector: sector.name,
      position_x: +(sector.x + jitter).toFixed(2),
      position_y: yValues[i],
    });
  }
}

// Monta INSERT SQL (escape simples de aspas)
const escape = (s) => s.replace(/'/g, "''");
const values = records
  .map(
    (r) =>
      `('${EVENT_ID}','${ORG_ID}','${escape(r.company_name)}','${r.booth_number}','${escape(r.sector)}','PENDENTE',${r.position_x},${r.position_y})`
  )
  .join(',\n');

const sql = `INSERT INTO event_booths (event_id, organization_id, company_name, booth_number, sector, status, position_x, position_y) VALUES\n${values};`;

async function main() {
  console.log(`Inserindo ${records.length} stands no evento ORPLANA...`);

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    console.error('Erro:', data);
    process.exit(1);
  }
  console.log('OK — resposta:', JSON.stringify(data));

  // Verifica contagem
  const countRes = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `SELECT COUNT(*) AS total FROM event_booths WHERE event_id = '${EVENT_ID}';`,
      }),
    }
  );
  const countData = await countRes.json();
  console.log('Total de stands no evento agora:', countData);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
