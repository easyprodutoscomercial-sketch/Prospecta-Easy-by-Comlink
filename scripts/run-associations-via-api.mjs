// Cria tabela `associations`, adiciona FK em contacts e popula 35 linhas.
// Usa Supabase Management API (HTTPS) porque pooler PostgreSQL está bloqueado
// por firewall na rede do dono.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.argv[2];
if (!TOKEN) {
  console.error('Passa o token como env SUPABASE_ACCESS_TOKEN ou como primeiro arg.');
  process.exit(1);
}
const REF = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace('https://', '').split('.')[0];
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function run(sql, label) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`❌ ${label}: ${res.status} ${text}`);
    throw new Error(`${label} falhou`);
  }
  console.log(`✅ ${label}`);
  try { return JSON.parse(text); } catch { return text; }
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sigla TEXT NOT NULL,
  nome_completo TEXT NOT NULL,
  presidente TEXT,
  telefone TEXT,
  email TEXT,
  website TEXT,
  cidade TEXT,
  estado TEXT,
  endereco TEXT,
  cep TEXT,
  logo_url TEXT,
  grupo TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sigla)
);

CREATE INDEX IF NOT EXISTS idx_associations_org ON associations(organization_id);
CREATE INDEX IF NOT EXISTS idx_associations_estado ON associations(organization_id, estado);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES associations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_association ON contacts(association_id);

CREATE OR REPLACE FUNCTION update_associations_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_associations_updated_at ON associations;
CREATE TRIGGER trg_associations_updated_at BEFORE UPDATE ON associations
FOR EACH ROW EXECUTE FUNCTION update_associations_updated_at();

ALTER TABLE associations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'associations' AND policyname = 'associations_service') THEN
    CREATE POLICY associations_service ON associations FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

const ROWS = [
  ['ACAER', 'Associação dos Canavieiros Entre Rios', 'Múcio Barra de Andrade', '(64) 3437-1161', 'acaer@bol.com.br', null, 'Cachoeira Dourada', 'GO', 'Rod. GO 206 Km 57 sala 02 Distrito de Almerindonópolis s/nº', '75560-000'],
  ['AFCOP', 'Associação dos Fornecedores de Cana da Região Oeste Paulista', 'Apolinário Pereira da Silva Junior', '(18) 3401-1015', 'afcop@afcop.com.br', 'http://www.afcop.com.br', 'Valparaíso', 'SP', 'Praça da Bandeira, 100', '16880-000'],
  ['AFIBB', 'Associação dos Fornecedores de Cana da Região de Igaraçu e Barra Bonita', 'José Gilberto Maganha', '(14) 3641-1034', 'afibb@afibb.com.br', 'http://www.afibb.com.br', 'Barra Bonita', 'SP', 'Rua Sebastião Franco de Arruda, 748 Vila Operário', '17340-000'],
  ['AFOCAN', 'Associação dos Fornecedores de Cana da Alta Noroeste', 'Nilson de Souza Ochiuto', '(18) 3723-7700', 'adm@afocanandradina.com', 'http://www.afocanandradina.com', 'Andradina', 'SP', 'Homero Rodrigues Silva, 2.908', '16901-125'],
  ['AFOCANA', 'Associação dos Fornecedores de Cana da Região de General Salgado', "Luiz Alberto Cassiano Sant'Anna", '(17) 3832-3802', 'afocana@hotmail.com', null, 'General Salgado', 'SP', 'Rua Elias Moisés Elias, 1.487 Distrito Industrial', '15300-000'],
  ['AFOCAPI', 'Associação dos Fornecedores de Cana de Piracicaba', 'José Coral', '(19) 3401-2200', 'jose.coral@cana.com.br', 'https://www.afocapi.com.br/', 'Piracicaba', 'SP', 'Rua Comendador Luciano Guidotti, 1937', '13424-540'],
  ['AFOPORTO', 'Associação dos Fornecedores de Cana de Porto Feliz', 'César Eduardo Sgariboldi', '(15) 3262-1375', 'afoporto@terra.com.br', null, 'Porto Feliz', 'SP', 'Rua Dr. Francisco Moreira Jr, 156', '18540-000'],
  ['APCA', 'Associação dos Plantadores de Cana de Araçatuba', 'Edson Assis', '(18) 3621-5915', 'apcaracatuba@terra.com.br', null, 'Araçatuba', 'SP', 'Rua Antônio Florence, nº 11 Centro', '16010-590'],
  ['APCRO', 'Associação dos Plantadores de Cana da Região de Ourinhos', 'Francisco Barros de Melo', '(14) 3324-1606', 'assocanaours@uol.com.br', null, 'Ourinhos', 'SP', 'R. Gov. Armando Salles, 336 Vila Moraes', '19900-240'],
  ['APLACANA', 'Associação dos Plantadores de Cana da Região de Monte Aprazível', 'Ueslei Cavatão', '(17) 3275-9670', 'aplacana@aplacana.com.br', 'http://www.aplacana.com.br', 'Monte Aprazível', 'SP', 'Av. Santos Dumont, 555 Jardim Bom Jesus', '15150-000'],
  ['APLANA', 'Associação dos Lavradores e Fornecedores de Cana de Araporã', 'João Batista (Lico)', '(34) 3284-1080', 'lourdes@aplana.com.br', 'http://www.aplana.com.br', 'Araporã', 'MG', 'Rua dos Bergamos, 74 Alvorada', '38435-000'],
  ['APMP', 'Associação dos Produtores de Matérias-Primas para as Indústrias de Bioenergia de Goiás', 'Rodolfo Chavaglia', '(64) 3612-1026', 'associacao.apmp@gmail.com', 'https://apmpbioenergia.com.br/', 'Rio Verde', 'GO', 'Rua das Turmalinas, 61, Quadra 58, lote 09 Parque Bandeirantes', '75905-630'],
  ['APROCANA', 'Associação dos Fornecedores de Cana de Goiás', 'Oscarino Martins da Silva Neto', '(64) 98459-6994', 'aprocana@aprocana.com.br', 'http://www.aprocana.com.br', 'Quirinópolis', 'GO', 'Rua Capelinha, 105 - Centro - Caixa Postal 135', '75860-126'],
  ['APROVALE', 'Associação dos Produtores de Cana do Vale do Rio Grande - MG', 'Reginaldo Dias Machado', '(34) 3421-3109', 'aprovale@netsite.com.br', 'http://www.aprovalefrutal.org.br', 'Frutal', 'MG', 'BR - 364, Km 27,68 - Centro', '38200-000'],
  ['ASCANA', 'Associação dos Plantadores de Cana do Médio Tietê', 'Pedro Luís Lorenzetti', '(14) 3269-1400', 'diretoria@ascana.com.br', 'http://www.ascana.com.br', 'Lençóis Paulista', 'SP', 'Rua Pedro Natalio Lorenzetti, 698 Centro', '18680-110'],
  ['ASFORAMA', 'Associação dos Fornecedores de Cana da Região de Iturama', 'Luiz Henrique Dias Trovo', '(34) 3415-8000', 'asforama@asforama.com.br', 'http://www.asforama.com.br', 'Iturama', 'MG', 'Rua Monte Alegre, 704', '38280-000'],
  ['ASPROVAC', 'Associação dos Fornecedores de Cana de Açúcar da Região do Vale do Coruripe', 'Clovis Lemos Farias Filho', '(82) 99968-0007', 'asprovac@hotmail.com', null, 'Coruripe', 'AL', 'Rodovia Al 455 S/Nº', '57230-000'],
  ['ASSOBARI', 'Associação dos Fornecedores de Cana da Região de Bariri', 'Manoel Fernando Salina', '(14) 3662-6180', 'assobari@assobari.com.br', 'http://www.assobari.com.br', 'Bariri', 'SP', 'Av. Perimetral Prefeito Domingos Antonio Fortunato, 365 Polo Empresarial Jose Durante Jr', '17253-180'],
  ['ASSOCANA', 'Associação Rural dos Fornecedores e Plantadores de Cana da Média Sorocabana', 'Bruno Garcia Moreira', '(18) 3421-3200', 'assocana@assocana.com.br', 'http://www.assocana.com.br', 'Assis', 'SP', 'Av Felix de Castro, 1.180 Jd Aeroporto', '19813-700'],
  ['ASSOCAP', 'Associação dos Fornecedores de Cana de Capivari', 'Maria Christina C.G. Pacheco', '(19) 3492-8100', 'assocap@assocap.com.br', 'http://www.canacap.com.br', 'Capivari', 'SP', 'Chácara Coriolano, s/nº Bairro Coriolano', '13360-000'],
  ['ASSOCICANA', 'Associação dos Plantadores de Cana da Região de Jaú', 'Eduardo Vasconcellos Romão', '(14) 3622-6600', 'associcana@associacana.com.br', 'http://www.associcana.com.br', 'Jaú', 'SP', 'Av. Caetano Perlatti, 730 Vila Industrial', '17203-370'],
  ['ASSOVALE MT', 'Associação dos Fornecedores de Cana do Vale do Rio Paraguai', 'Normando Corral', '(65) 99968-9334', 'assovale@assovale.agr.br', 'https://www.assovalemt.com.br/', 'Nova Olímpia', 'MT', 'Av. Olacir Francisco de Moraes, 394-E', '78370-000'],
  ['ASSOVALE SP', 'Associação Rural Vale do Rio Pardo', 'Paulo Maximiano Junqueira Neto', '(16) 3626-0029', 'contato@assovale.com.br', 'http://www.assovale.com.br', 'Ribeirão Preto', 'SP', 'R. Caraguatatuba, nº 4.000 Jardim Jóquei Clube', '14078-548'],
  ['CANA CANÁPOLIS', 'Associação dos Produtores de Cana da Usina Canápolis', 'Ronaldo Sandre', '(34) 9967-9200', 'canacanapolis@gmail.com', null, 'Canápolis', 'MG', 'Rua 8, Nº527 - Bairro: Centro', '38380-000'],
  ['CANACAMPO', 'Associação dos fornecedores de cana da região de Campo Florido - MG', 'João Bosco Brandão Salomão', '(34) 3322-1289', 'associacao@canacampo.com.br', null, 'Campo Florido', 'MG', 'Rodovia BR 262 km 877, número 491 Vila Junqueira', '38130-000'],
  ['CANAOESTE', 'Associação dos Plantadores de Cana do Oeste do Estado de São Paulo', 'Fernando dos Reis Filho', '(16) 3946-3300', 'diretoria@canaoeste.com.br', 'http://www.canaoeste.com.br', 'Sertãozinho', 'SP', 'Rua Pio Dufles, 532', '14170-680'],
  ['CANAROEIRA', 'Associação dos Fornecedores de Cana da Bioenergética Aroeira', 'João Ulisses de Andrade', '(34) 9978-8702', 'administrativo@canaroeira.com.br', null, 'Tupaciguara', 'MG', 'Av Tiradentes, 182 - Bairro: Tiradentes', '38480-000'],
  ['CANASOL', 'Associação dos Fornecedores de Cana de Araraquara', 'Luis Henrique Scabello de Oliveira', '(16) 3311-9100', 'canasol@canasol.com.br', 'http://www.canasol.com.br', 'Araraquara', 'SP', 'Avenida 13 de Maio, 1.406 Vila Xavier', '14810-088'],
  ['CANAUSSU', 'Associação dos Fornecedores de Cana de Chavantes', 'Odair Mariano Pacheco', '(14) 3342-1541', 'canaussu@hotmail.com', null, 'Chavantes', 'SP', 'Rua Coronel Azarias Bueno, 425', '18970-000'],
  ['NOVOCANA', 'Associação dos Fornecedores de Cana da Região de Novo Horizonte', 'Marcelo Cesar Rangel', '(17) 3542-2752', 'novocananh@gmail.com', null, 'Novo Horizonte', 'SP', 'Av. Conego Alfredo Reith, 311 Vila Patti', '14960-142'],
  ['OLICANA', 'Associação dos Fornecedores de Cana da Região de Olímpia', 'Celso Castilho Ruiz', '(17) 3281-1733', 'associacao.olimpia@uol.com.br', 'http://www.olicana.com.br', 'Olímpia', 'SP', 'Rua David de Oliveira, 137 Centro', '15400-000'],
  ['ORICANA', 'Associação dos Fornecedores de Cana da Região de Orindiúva', 'Roberto Cestari', '(17) 3816-1128', 'oricana@oricana.com.br', 'http://www.oricana.com.br', 'Orindiúva', 'SP', 'R Miguel Bueno Guimarães, 310 Jardim Paulista', '15480-000'],
  ['SOCICANA', 'Associação dos Fornecedores de Cana de Guariba', 'Francisco Antonio de Laurentiis Filho', '(16) 3251-9270', 'socicana@socicana.com.br', 'http://www.socicana.com.br', 'Guariba', 'SP', 'Rua José Mazzi, 1.450 - Vila Caravelo Caixa Postal 64', '14840-000'],
  ['SULCANAS', 'Associação dos Fornecedores de Cana Sul-Mato-grossense', 'Marcio Verrunes', '(67) 99245-5599', 'sulcanas@gmail.com', null, 'Dourados', 'MS', 'Oliveira Marques, 1676 Jardim Centro', '79805-021'],
  ['UNICANA', 'Associação dos Fornecedores de Cana da Região de Bebedouro', 'Flávio Xavier Pimentel', '(17) 3342-2845', 'unicana@unicana.com.br', 'http://www.unicana.com.br/', 'Bebedouro', 'SP', 'Av. Amédia Bernardini Cutrale, número 2730 Jardim São Conrado', '14701-550'],
];

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}

async function main() {
  console.log('🏗️  Criando schema...');
  await run(SCHEMA_SQL, 'schema ok');

  console.log('\n🏢 Buscando organization_id...');
  const orgs = await run("SELECT id, name FROM organizations ORDER BY created_at ASC LIMIT 1;", 'org query');
  const orgId = orgs[0].id;
  console.log(`   org: ${orgs[0].name} (${orgId})`);

  console.log(`\n📥 Inserindo ${ROWS.length} associações...`);
  const values = ROWS.map(r => {
    const [sigla, nome, pres, tel, email, site, cidade, uf, endereco, cep] = r;
    return `(${esc(orgId)}, ${esc(sigla)}, ${esc(nome)}, ${esc(pres)}, ${esc(tel)}, ${esc(email)}, ${esc(site)}, ${esc(cidade)}, ${esc(uf)}, ${esc(endereco)}, ${esc(cep)}, 'ORPLANA')`;
  }).join(',\n');

  const insertSql = `
    INSERT INTO associations (
      organization_id, sigla, nome_completo, presidente, telefone, email, website, cidade, estado, endereco, cep, grupo
    ) VALUES
    ${values}
    ON CONFLICT (organization_id, sigla) DO UPDATE SET
      nome_completo = EXCLUDED.nome_completo,
      presidente = EXCLUDED.presidente,
      telefone = EXCLUDED.telefone,
      email = EXCLUDED.email,
      website = EXCLUDED.website,
      cidade = EXCLUDED.cidade,
      estado = EXCLUDED.estado,
      endereco = EXCLUDED.endereco,
      cep = EXCLUDED.cep,
      grupo = EXCLUDED.grupo,
      updated_at = now()
    RETURNING sigla;
  `;
  const result = await run(insertSql, `${ROWS.length} linhas inseridas/atualizadas`);
  console.log(`   siglas: ${result.map(r => r.sigla).join(', ')}`);

  console.log('\n📊 Verificação final...');
  const final = await run(`SELECT COUNT(*)::int AS c FROM associations WHERE organization_id = '${orgId}';`, 'count');
  console.log(`   Total na org: ${final[0].c}`);

  console.log('\n✅ Tudo pronto.');
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1); });
