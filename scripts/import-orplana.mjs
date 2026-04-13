import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://edwkdrgferjbitxwlwrf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Dados ORPLANA ──────────────────────────────────────────────────────
const contacts = [
  {
    name: "ACAER - Associação dos Canavieiros Entre Rios",
    phone: "(64) 3437 1161",
    email: "acaer@bol.com.br",
    company: "ACAER",
    notes: "Presidente: Múcio Barra de Andrade | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Múcio Barra de Andrade",
    cargo: "Presidente",
    endereco: "Rod. GO 206 Km 57 sala 02 Distrito de Almerindonópolis s/nº",
    cidade: "Cachoeira Dourada",
    estado: "GO",
    cep: "75.560-000",
  },
  {
    name: "AFCOP - Associação dos Fornecedores de Cana da Região Oeste Paulista",
    phone: "(18) 3401 1015",
    email: "afcop@afcop.com.br",
    company: "AFCOP",
    notes: "Presidente: Apolinário Pereira da Silva Junior | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Apolinário Pereira da Silva Junior",
    cargo: "Presidente",
    endereco: "Praça da Bandeira, 100",
    cidade: "Valparaíso",
    estado: "SP",
    cep: "16.880-000",
    website: "http://www.afcop.com.br",
    instagram: "@afcop.oficial",
  },
  {
    name: "AFIBB - Associação dos Fornecedores de Cana da Região de Igaraçu e Barra Bonita",
    phone: "(14) 3641-1034",
    email: "afibb@afibb.com.br",
    company: "AFIBB",
    notes: "Presidente: José Gilberto Maganha | Associação filiada à ORPLANA | Telefones: (14) 3641-1285, (14) 3641-1035",
    referencia: "ORPLANA",
    contato_nome: "José Gilberto Maganha",
    cargo: "Presidente",
    endereco: "Rua Sebastião Franco de Arruda, 748 Vila Operário",
    cidade: "Barra Bonita",
    estado: "SP",
    cep: "17.340-000",
    website: "http://www.afibb.com.br",
  },
  {
    name: "AFOCAN - Associação dos Fornecedores de Cana da Alta Noroeste",
    phone: "(18) 3723 7700",
    email: "adm@afocanandradina.com",
    company: "AFOCAN",
    notes: "Presidente: Nilson de Souza Ochiuto | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Nilson de Souza Ochiuto",
    cargo: "Presidente",
    endereco: "Homero Rodrigues Silva, 2.908",
    cidade: "Andradina",
    estado: "SP",
    cep: "16.901-125",
    website: "http://www.afocanandradina.com",
  },
  {
    name: "AFOCANA - Associação dos Fornecedores de Cana da Região de General Salgado",
    phone: "(17) 3832 3802",
    email: "afocana@hotmail.com",
    company: "AFOCANA",
    notes: "Presidente: Luiz Alberto Cassiano Sant'Anna | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Luiz Alberto Cassiano Sant'Anna",
    cargo: "Presidente",
    endereco: "Rua Elias Moisés Elias, 1.487 Distrito Industrial",
    cidade: "General Salgado",
    estado: "SP",
    cep: "15.300-000",
  },
  {
    name: "AFOCAPI - Associação dos Fornecedores de Cana de Piracicaba",
    phone: "(19) 3401-2200",
    email: "jose.coral@cana.com.br",
    company: "AFOCAPI",
    notes: "Presidente: José Coral | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "José Coral",
    cargo: "Presidente",
    endereco: "Rua Comendador Luciano Guidotti, 1937",
    cidade: "Piracicaba",
    estado: "SP",
    cep: "13.424-540",
    website: "https://www.afocapi.com.br/",
    instagram: "@afocapi",
  },
  {
    name: "AFOPORTO - Associação dos Fornecedores de Cana de Porto Feliz",
    phone: "(15) 3262-1375",
    email: "afoporto@terra.com.br",
    company: "AFOPORTO",
    notes: "Presidente: César Eduardo Sgariboldi | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "César Eduardo Sgariboldi",
    cargo: "Presidente",
    endereco: "Rua Dr. Francisco Moreira Jr, 156",
    cidade: "Porto Feliz",
    estado: "SP",
    cep: "18.540-000",
  },
  {
    name: "APCA - Associação dos Plantadores de Cana de Araçatuba",
    phone: "(18) 3621-5915",
    email: "apcaracatuba@terra.com.br",
    company: "APCA",
    notes: "Presidente: Edson Assis | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Edson Assis",
    cargo: "Presidente",
    endereco: "Rua Antônio Florence, nº 11 Centro",
    cidade: "Araçatuba",
    estado: "SP",
    cep: "16.010-590",
  },
  {
    name: "APCRO - Associação dos Plantadores de Cana da Região de Ourinhos",
    phone: "(14) 3324 1606",
    email: "assocanaours@uol.com.br",
    company: "APCRO",
    notes: "Presidente: Francisco Barros de Melo | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Francisco Barros de Melo",
    cargo: "Presidente",
    endereco: "R. Gov. Armando Salles, 336 Vila Moraes",
    cidade: "Ourinhos",
    estado: "SP",
    cep: "19.900-240",
  },
  {
    name: "APLACANA - Associação dos Plantadores de Cana da Região de Monte Aprazível",
    phone: "(17) 3275-9670",
    email: "aplacana@aplacana.com.br",
    company: "APLACANA",
    notes: "Presidente: Ueslei Cavatão | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Ueslei Cavatão",
    cargo: "Presidente",
    endereco: "Av. Santos Dumont, 555 Jardim Bom Jesus",
    cidade: "Monte Aprazível",
    estado: "SP",
    cep: "15.150-000",
    website: "http://www.aplacana.com.br",
  },
  {
    name: "APLANA - Associação dos Lavradores e Fornecedores de Cana de Araporã",
    phone: "(34) 3284-1080",
    email: "lourdes@aplana.com.br",
    company: "APLANA",
    notes: "Presidente: João Batista - Lico | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "João Batista - Lico",
    cargo: "Presidente",
    endereco: "Rua dos Bergamos, 74 Alvorada",
    cidade: "Araporã",
    estado: "MG",
    cep: "38.435-000",
    website: "http://www.aplana.com.br",
  },
  {
    name: "APMP - Associação dos Produtores de Matérias-Primas para as Indústrias de Bioenergia de Goiás",
    phone: "(64) 3612 1026",
    email: "associacao.apmp@gmail.com",
    company: "APMP",
    notes: "Presidente: Rodolfo Chavaglia | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Rodolfo Chavaglia",
    cargo: "Presidente",
    endereco: "Rua das Turmalinas, 61- Quadra 58 - lote 09 Parque Bandeirantes",
    cidade: "Rio Verde",
    estado: "GO",
    cep: "75.905-630",
    website: "https://apmpbioenergia.com.br/",
    instagram: "@apmp_bioenergia",
  },
  {
    name: "APROCANA - Associação dos Fornecedores de Cana de Goiás",
    phone: "(64) 98459-6994",
    email: "aprocana@aprocana.com.br",
    company: "APROCANA",
    notes: "Presidente: Oscarino Martins da Silva Neto | Associação filiada à ORPLANA | Telefone 2: (64) 98132-1934",
    referencia: "ORPLANA",
    contato_nome: "Oscarino Martins da Silva Neto",
    cargo: "Presidente",
    endereco: "Rua Capelinha,105 - Centro - Caixa Postal 135",
    cidade: "Quirinópolis",
    estado: "GO",
    cep: "75860-126",
    website: "http://www.aprocana.com.br",
    instagram: "@aprocana",
  },
  {
    name: "APROVALE - Associação dos Produtores de Cana do Vale do Rio Grande - MG",
    phone: "(34) 3421 3109",
    email: "aprovale@netsite.com.br",
    company: "APROVALE",
    notes: "Presidente: Reginaldo Dias Machado | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Reginaldo Dias Machado",
    cargo: "Presidente",
    endereco: "BR - 364, Km 27,68 - Centro",
    cidade: "Frutal",
    estado: "MG",
    cep: "38.200-000",
    website: "http://www.aprovalefrutal.org.br",
    instagram: "@aprovalefrutal",
  },
  {
    name: "ASCANA - Associação dos Plantadores de Cana do Médio Tietê",
    phone: "(14) 3269 1400",
    email: "diretoria@ascana.com.br",
    company: "ASCANA",
    notes: "Presidente: Pedro Luís Lorenzetti | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Pedro Luís Lorenzetti",
    cargo: "Presidente",
    endereco: "Rua Pedro Natalio Lorenzetti, 698 Centro",
    cidade: "Lençóis Paulista",
    estado: "SP",
    cep: "18.680-110",
    website: "http://www.ascana.com.br",
    instagram: "@ascana_sp",
  },
  {
    name: "ASFORAMA - Associação dos Fornecedores de Cana da Região de Iturama",
    phone: "(34) 3415 8000",
    email: "asforama@asforama.com.br",
    company: "ASFORAMA",
    notes: "Presidente: Luiz Henrique Dias Trovo | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Luiz Henrique Dias Trovo",
    cargo: "Presidente",
    endereco: "Rua Monte Alegre , 704",
    cidade: "Iturama",
    estado: "MG",
    cep: "38.280-000",
    website: "http://www.asforama.com.br",
    instagram: "@asforamaiturama",
  },
  {
    name: "ASPROVAC - Associação dos Fornecedores de Cana de Açúcar da Região do Vale do Coruripe",
    phone: "(82) 99968-0007",
    email: "asprovac@hotmail.com",
    company: "ASPROVAC",
    notes: "Presidente: Clovis Lemos Farias Filho | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Clovis Lemos Farias Filho",
    cargo: "Presidente",
    endereco: "Rodovia Al 455 S/N°",
    cidade: "Coruripe",
    estado: "AL",
    cep: "57230-000",
    instagram: "@asprovac",
  },
  {
    name: "ASSOBARI - Associação dos Fornecedores de Cana da Região de Bariri",
    phone: "(14) 3662-6180",
    email: "assobari@assobari.com.br",
    company: "ASSOBARI",
    notes: "Presidente: Manoel Fernando Salina | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Manoel Fernando Salina",
    cargo: "Presidente",
    endereco: "Av. Perimetral Prefeito Domingos Antonio Fortunato, 365 Polo Empresarial Jose Durante Jr",
    cidade: "Bariri",
    estado: "SP",
    cep: "17.253-180",
    website: "http://www.assobari.com.br",
    instagram: "@assobaribariri",
  },
  {
    name: "ASSOCANA - Associação Rural dos Fornecedores e Plantadores de Cana da Média Sorocabana",
    phone: "(18) 3421 3200",
    email: "assocana@assocana.com.br",
    company: "ASSOCANA",
    notes: "Presidente: Bruno Garcia Moreira | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Bruno Garcia Moreira",
    cargo: "Presidente",
    endereco: "Av Felix de Castro, 1.180 Jd Aeroporto",
    cidade: "Assis",
    estado: "SP",
    cep: "19.813-700",
    website: "http://www.assocana.com.br",
    instagram: "@assocana",
  },
  {
    name: "ASSOCAP - Associação dos Fornecedores de Cana de Capivari",
    phone: "(19) 3492 8100",
    email: "assocap@assocap.com.br",
    company: "ASSOCAP",
    notes: "Presidente: Maria Christina C.G.Pacheco | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Maria Christina C.G.Pacheco",
    cargo: "Presidente",
    endereco: "Chácara Coriolano, s/nº Bairro Coriolano",
    cidade: "Capivari",
    estado: "SP",
    cep: "13.360-000",
    website: "http://www.canacap.com.br",
    instagram: "@assocapcapivari",
  },
  {
    name: "ASSOCICANA - Associação dos Plantadores de Cana da Região de Jaú",
    phone: "(14) 3622 6600",
    email: "associcana@associacana.com.br",
    company: "ASSOCICANA",
    notes: "Presidente: Eduardo Vasconcellos Romão | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Eduardo Vasconcellos Romão",
    cargo: "Presidente",
    endereco: "Av. Caetano Perlatti , 730 Vila Industrial",
    cidade: "Jaú",
    estado: "SP",
    cep: "17.203-370",
    website: "http://www.associcana.com.br",
    instagram: "@associcanajau",
  },
  {
    name: "ASSOVALE MT - Associação dos Fornecedores de Cana do Vale do Rio Paraguai",
    phone: "(65) 99968-9334",
    email: "assovale@assovale.agr.br",
    company: "ASSOVALE MT",
    notes: "Presidente: Normando Corral | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Normando Corral",
    cargo: "Presidente",
    endereco: "Av. Olacir Francisco de Moraes, 394-E",
    cidade: "Nova Olímpia",
    estado: "MT",
    cep: "78370-000",
    website: "https://www.assovalemt.com.br/",
  },
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
    name: "CANA CANÁPOLIS - Associação dos Produtores de Cana da Usina Canápolis",
    phone: "(34) 9967 9200",
    email: "canacanapolis@gmail.com",
    company: "CANA CANÁPOLIS",
    notes: "Presidente: Ronaldo Sandre | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Ronaldo Sandre",
    cargo: "Presidente",
    endereco: "Rua 8, N°527 - Bairro: Centro",
    cidade: "Canápolis",
    estado: "MG",
    cep: "38.380-000",
  },
  {
    name: "CANACAMPO - Associação dos fornecedores de cana da região de Campo Florido - MG",
    phone: "(34) 3322-1289",
    email: "associacao@canacampo.com.br",
    company: "CANACAMPO",
    notes: "Presidente: João Bosco Brandão Salomão | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "João Bosco Brandão Salomão",
    cargo: "Presidente",
    endereco: "Rodovia BR 262 km 877, número 491 Vila Junqueira",
    cidade: "Campo Florido",
    estado: "MG",
    cep: "38130-000",
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
  {
    name: "CANAROEIRA - Associação dos Fornecedores de Cana da Bioenergética Aroeira",
    phone: "(34) 9978 8702",
    email: "administrativo@canaroeira.com.br",
    company: "CANAROEIRA",
    notes: "Presidente: João Ulisses de Andrade | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "João Ulisses de Andrade",
    cargo: "Presidente",
    endereco: "Av Tiradentes, 182 - Bairro: Tiradentes",
    cidade: "Tupaciguara",
    estado: "MG",
    cep: "38.480-000",
  },
  {
    name: "CANASOL - Associação dos Fornecedores de Cana de Araraquara",
    phone: "(16) 3311 9100",
    email: "canasol@canasol.com.br",
    company: "CANASOL",
    notes: "Presidente: Luis Henrique Scabello de Oliveira | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Luis Henrique Scabello de Oliveira",
    cargo: "Presidente",
    endereco: "Avenida 13 de Maio, 1.406 Vila Xavier",
    cidade: "Araraquara",
    estado: "SP",
    cep: "14.810-088",
    website: "http://www.canasol.com.br",
  },
  {
    name: "CANAUSSU - Associação dos Fornecedores de Cana de Chavantes",
    phone: "(14) 3342 1541",
    email: "canaussu@hotmail.com",
    company: "CANAUSSU",
    notes: "Presidente: Odair Mariano Pacheco | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Odair Mariano Pacheco",
    cargo: "Presidente",
    endereco: "Rua Coronel Azarias Bueno, 425",
    cidade: "Chavantes",
    estado: "SP",
    cep: "18.970-000",
  },
  {
    name: "NOVOCANA - Associação dos Fornecedores de Cana da Região de Novo Horizonte",
    phone: "(17) 3542 2752",
    email: "novocananh@gmail.com",
    company: "NOVOCANA",
    notes: "Presidente: Marcelo Cesar Rangel | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Marcelo Cesar Rangel",
    cargo: "Presidente",
    endereco: "Av. Conego Alfredo Reith, 311 Vila Patti",
    cidade: "Novo Horizonte",
    estado: "SP",
    cep: "14.960-142",
  },
  {
    name: "OLICANA - Associação dos Fornecedores de Cana da Região de Olímpia",
    phone: "(17) 3281 1733",
    email: "associacao.olimpia@uol.com.br",
    company: "OLICANA",
    notes: "Presidente: Celso Castilho Ruiz | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Celso Castilho Ruiz",
    cargo: "Presidente",
    endereco: "Rua David de Oliveira, 137 Centro",
    cidade: "Olímpia",
    estado: "SP",
    cep: "15.400-000",
    website: "http://www.olicana.com.br",
  },
  {
    name: "ORICANA - Associação dos Fornecedores de Cana da Região de Orindiúva",
    phone: "(17) 3816 1128",
    email: "oricana@oricana.com.br",
    company: "ORICANA",
    notes: "Presidente: Roberto Cestari | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Roberto Cestari",
    cargo: "Presidente",
    endereco: "R Miguel Bueno Guimarães, 310 Jardim Paulista",
    cidade: "Orindiúva",
    estado: "SP",
    cep: "15.480-000",
    website: "http://www.oricana.com.br",
  },
  {
    name: "SOCICANA - Associação dos Fornecedores de Cana de Guariba",
    phone: "(16) 3251 9270",
    email: "socicana@socicana.com.br",
    company: "SOCICANA",
    notes: "Presidente: Francisco Antonio de Laurentiis Filho | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Francisco Antonio de Laurentiis Filho",
    cargo: "Presidente",
    endereco: "Rua José Mazzi, 1.450 - Vila Caravelo Caixa Postal 64",
    cidade: "Guariba",
    estado: "SP",
    cep: "14.840-000",
    website: "http://www.socicana.com.br",
    instagram: "@_socicana",
  },
  {
    name: "SULCANAS - Associação dos Fornecedores de Cana Sul-Mato-grossense",
    phone: "(67) 99245-5599",
    email: "sulcanas@gmail.com",
    company: "SULCANAS",
    notes: "Presidente: Marcio Verrunes | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Marcio Verrunes",
    cargo: "Presidente",
    endereco: "Oliveira Marques, 1676 Jardim Centro",
    cidade: "Dourados",
    estado: "MS",
    cep: "79.805-021",
  },
  {
    name: "UNICANA - Associação dos Fornecedores de Cana da Região de Bebedouro",
    phone: "(17) 3342-2845",
    email: "unicana@unicana.com.br",
    company: "UNICANA",
    notes: "Presidente: Flávio Xavier Pimentel | Associação filiada à ORPLANA",
    referencia: "ORPLANA",
    contato_nome: "Flávio Xavier Pimentel",
    cargo: "Presidente",
    endereco: "Av. Amédia Bernardini Cutrale, número 2730 Jardim São Conrado",
    cidade: "Bebedouro",
    estado: "SP",
    cep: "14701-550",
    website: "http://www.unicana.com.br/",
  },
];

// ── Normalizar telefone (só dígitos) ───────────────────────────────────
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

function normalizeEmail(email) {
  if (!email) return null;
  return email.trim().toLowerCase();
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== Importação ORPLANA - ${contacts.length} associações ===\n`);

  // 1) Buscar todos os contatos existentes
  const { data: existing, error } = await supabase
    .from('contacts')
    .select('id, name, email, phone, email_normalized, phone_normalized, company, contato_nome, cidade, estado');

  if (error) {
    console.error('Erro ao buscar contatos existentes:', error.message);
    process.exit(1);
  }

  console.log(`Contatos existentes no banco: ${existing.length}\n`);

  // 2) Mapear por email e telefone normalizado
  const emailMap = new Map();
  const phoneMap = new Map();
  for (const c of existing) {
    const em = c.email_normalized || normalizeEmail(c.email);
    const ph = c.phone_normalized || normalizePhone(c.phone);
    if (em) emailMap.set(em, c);
    if (ph) phoneMap.set(ph, c);
  }

  // 3) Verificar duplicatas
  const duplicates = [];
  const toImport = [];

  for (const contact of contacts) {
    const em = normalizeEmail(contact.email);
    const ph = normalizePhone(contact.phone);

    let dup = null;
    let reason = '';

    if (em && emailMap.has(em)) {
      dup = emailMap.get(em);
      reason = `Email ${contact.email}`;
    } else if (ph && phoneMap.has(ph)) {
      dup = phoneMap.get(ph);
      reason = `Telefone ${contact.phone}`;
    }

    if (dup) {
      duplicates.push({ novo: contact, existente: dup, reason });
    } else {
      toImport.push(contact);
    }
  }

  // 4) Relatório
  if (duplicates.length > 0) {
    console.log(`⚠  DUPLICATAS ENCONTRADAS: ${duplicates.length}\n`);
    console.log('─'.repeat(80));
    for (const d of duplicates) {
      console.log(`NOVO:      ${d.novo.company} - ${d.novo.name}`);
      console.log(`           Email: ${d.novo.email} | Tel: ${d.novo.phone}`);
      console.log(`EXISTENTE: ${d.existente.name} (id: ${d.existente.id})`);
      console.log(`           Email: ${d.existente.email || '-'} | Tel: ${d.existente.phone || '-'}`);
      console.log(`MOTIVO:    ${d.reason}`);
      console.log('─'.repeat(80));
    }

    console.log('\n── SELECT para ver as duplicatas no banco: ──\n');
    const ids = duplicates.map(d => `'${d.existente.id}'`).join(', ');
    console.log(`SELECT id, name, company, email, phone, contato_nome, cidade, estado, created_at`);
    console.log(`FROM contacts`);
    console.log(`WHERE id IN (${ids});`);
    console.log('');
  } else {
    console.log('✓ Nenhuma duplicata encontrada.\n');
  }

  console.log(`Contatos a importar: ${toImport.length}\n`);

  if (toImport.length === 0) {
    console.log('Nada a importar.');
    return;
  }

  // 5) Buscar organization_id e pipeline
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single();

  if (!orgs) {
    console.error('Nenhuma organização encontrada.');
    process.exit(1);
  }

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

  // 6) Inserir contatos
  let created = 0;
  let errors = 0;

  for (const contact of toImport) {
    const ph = normalizePhone(contact.phone);
    const em = normalizeEmail(contact.email);

    const row = {
      organization_id: orgId,
      name: contact.name,
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
      console.error(`✗ Erro ao inserir ${contact.company}: ${insertError.message}`);
      errors++;
    } else {
      console.log(`✓ ${contact.company} - ${contact.cidade}/${contact.estado}`);
      created++;
    }
  }

  console.log(`\n=== Resultado ===`);
  console.log(`Criados:    ${created}`);
  console.log(`Duplicatas: ${duplicates.length}`);
  console.log(`Erros:      ${errors}`);
  console.log(`Total:      ${contacts.length}`);
}

main().catch(console.error);
