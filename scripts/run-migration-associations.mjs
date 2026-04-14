// Cria tabela `associations` e insere as 35 associações ORPLANA.
// Uso: node scripts/run-migration-associations.mjs
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const PROJECT_REF = SUPA_URL.replace('https://', '').split('.')[0];

const { Client } = pg;

const SQL = `
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
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

// As 35 associações ORPLANA
const ROWS = [
  { sigla: 'ACAER', nome: 'Associação dos Canavieiros Entre Rios', pres: 'Múcio Barra de Andrade', tel: '(64) 3437-1161', email: 'acaer@bol.com.br', site: null, cidade: 'Cachoeira Dourada', uf: 'GO', end: 'Rod. GO 206 Km 57 sala 02 Distrito de Almerindonópolis s/nº', cep: '75560-000', grupo: 'ORPLANA' },
  { sigla: 'AFCOP', nome: 'Associação dos Fornecedores de Cana da Região Oeste Paulista', pres: 'Apolinário Pereira da Silva Junior', tel: '(18) 3401-1015', email: 'afcop@afcop.com.br', site: 'http://www.afcop.com.br', cidade: 'Valparaíso', uf: 'SP', end: 'Praça da Bandeira, 100', cep: '16880-000', grupo: 'ORPLANA' },
  { sigla: 'AFIBB', nome: 'Associação dos Fornecedores de Cana da Região de Igaraçu e Barra Bonita', pres: 'José Gilberto Maganha', tel: '(14) 3641-1034', email: 'afibb@afibb.com.br', site: 'http://www.afibb.com.br', cidade: 'Barra Bonita', uf: 'SP', end: 'Rua Sebastião Franco de Arruda, 748 Vila Operário', cep: '17340-000', grupo: 'ORPLANA' },
  { sigla: 'AFOCAN', nome: 'Associação dos Fornecedores de Cana da Alta Noroeste', pres: 'Nilson de Souza Ochiuto', tel: '(18) 3723-7700', email: 'adm@afocanandradina.com', site: 'http://www.afocanandradina.com', cidade: 'Andradina', uf: 'SP', end: 'Homero Rodrigues Silva, 2.908', cep: '16901-125', grupo: 'ORPLANA' },
  { sigla: 'AFOCANA', nome: 'Associação dos Fornecedores de Cana da Região de General Salgado', pres: "Luiz Alberto Cassiano Sant'Anna", tel: '(17) 3832-3802', email: 'afocana@hotmail.com', site: null, cidade: 'General Salgado', uf: 'SP', end: 'Rua Elias Moisés Elias, 1.487 Distrito Industrial', cep: '15300-000', grupo: 'ORPLANA' },
  { sigla: 'AFOCAPI', nome: 'Associação dos Fornecedores de Cana de Piracicaba', pres: 'José Coral', tel: '(19) 3401-2200', email: 'jose.coral@cana.com.br', site: 'https://www.afocapi.com.br/', cidade: 'Piracicaba', uf: 'SP', end: 'Rua Comendador Luciano Guidotti, 1937', cep: '13424-540', grupo: 'ORPLANA' },
  { sigla: 'AFOPORTO', nome: 'Associação dos Fornecedores de Cana de Porto Feliz', pres: 'César Eduardo Sgariboldi', tel: '(15) 3262-1375', email: 'afoporto@terra.com.br', site: null, cidade: 'Porto Feliz', uf: 'SP', end: 'Rua Dr. Francisco Moreira Jr, 156', cep: '18540-000', grupo: 'ORPLANA' },
  { sigla: 'APCA', nome: 'Associação dos Plantadores de Cana de Araçatuba', pres: 'Edson Assis', tel: '(18) 3621-5915', email: 'apcaracatuba@terra.com.br', site: null, cidade: 'Araçatuba', uf: 'SP', end: 'Rua Antônio Florence, nº 11 Centro', cep: '16010-590', grupo: 'ORPLANA' },
  { sigla: 'APCRO', nome: 'Associação dos Plantadores de Cana da Região de Ourinhos', pres: 'Francisco Barros de Melo', tel: '(14) 3324-1606', email: 'assocanaours@uol.com.br', site: null, cidade: 'Ourinhos', uf: 'SP', end: 'R. Gov. Armando Salles, 336 Vila Moraes', cep: '19900-240', grupo: 'ORPLANA' },
  { sigla: 'APLACANA', nome: 'Associação dos Plantadores de Cana da Região de Monte Aprazível', pres: 'Ueslei Cavatão', tel: '(17) 3275-9670', email: 'aplacana@aplacana.com.br', site: 'http://www.aplacana.com.br', cidade: 'Monte Aprazível', uf: 'SP', end: 'Av. Santos Dumont, 555 Jardim Bom Jesus', cep: '15150-000', grupo: 'ORPLANA' },
  { sigla: 'APLANA', nome: 'Associação dos Lavradores e Fornecedores de Cana de Araporã', pres: 'João Batista (Lico)', tel: '(34) 3284-1080', email: 'lourdes@aplana.com.br', site: 'http://www.aplana.com.br', cidade: 'Araporã', uf: 'MG', end: 'Rua dos Bergamos, 74 Alvorada', cep: '38435-000', grupo: 'ORPLANA' },
  { sigla: 'APMP', nome: 'Associação dos Produtores de Matérias-Primas para as Indústrias de Bioenergia de Goiás', pres: 'Rodolfo Chavaglia', tel: '(64) 3612-1026', email: 'associacao.apmp@gmail.com', site: 'https://apmpbioenergia.com.br/', cidade: 'Rio Verde', uf: 'GO', end: 'Rua das Turmalinas, 61, Quadra 58, lote 09 Parque Bandeirantes', cep: '75905-630', grupo: 'ORPLANA' },
  { sigla: 'APROCANA', nome: 'Associação dos Fornecedores de Cana de Goiás', pres: 'Oscarino Martins da Silva Neto', tel: '(64) 98459-6994', email: 'aprocana@aprocana.com.br', site: 'http://www.aprocana.com.br', cidade: 'Quirinópolis', uf: 'GO', end: 'Rua Capelinha, 105 - Centro - Caixa Postal 135', cep: '75860-126', grupo: 'ORPLANA' },
  { sigla: 'APROVALE', nome: 'Associação dos Produtores de Cana do Vale do Rio Grande - MG', pres: 'Reginaldo Dias Machado', tel: '(34) 3421-3109', email: 'aprovale@netsite.com.br', site: 'http://www.aprovalefrutal.org.br', cidade: 'Frutal', uf: 'MG', end: 'BR - 364, Km 27,68 - Centro', cep: '38200-000', grupo: 'ORPLANA' },
  { sigla: 'ASCANA', nome: 'Associação dos Plantadores de Cana do Médio Tietê', pres: 'Pedro Luís Lorenzetti', tel: '(14) 3269-1400', email: 'diretoria@ascana.com.br', site: 'http://www.ascana.com.br', cidade: 'Lençóis Paulista', uf: 'SP', end: 'Rua Pedro Natalio Lorenzetti, 698 Centro', cep: '18680-110', grupo: 'ORPLANA' },
  { sigla: 'ASFORAMA', nome: 'Associação dos Fornecedores de Cana da Região de Iturama', pres: 'Luiz Henrique Dias Trovo', tel: '(34) 3415-8000', email: 'asforama@asforama.com.br', site: 'http://www.asforama.com.br', cidade: 'Iturama', uf: 'MG', end: 'Rua Monte Alegre, 704', cep: '38280-000', grupo: 'ORPLANA' },
  { sigla: 'ASPROVAC', nome: 'Associação dos Fornecedores de Cana de Açúcar da Região do Vale do Coruripe', pres: 'Clovis Lemos Farias Filho', tel: '(82) 99968-0007', email: 'asprovac@hotmail.com', site: null, cidade: 'Coruripe', uf: 'AL', end: 'Rodovia Al 455 S/Nº', cep: '57230-000', grupo: 'ORPLANA' },
  { sigla: 'ASSOBARI', nome: 'Associação dos Fornecedores de Cana da Região de Bariri', pres: 'Manoel Fernando Salina', tel: '(14) 3662-6180', email: 'assobari@assobari.com.br', site: 'http://www.assobari.com.br', cidade: 'Bariri', uf: 'SP', end: 'Av. Perimetral Prefeito Domingos Antonio Fortunato, 365 Polo Empresarial Jose Durante Jr', cep: '17253-180', grupo: 'ORPLANA' },
  { sigla: 'ASSOCANA', nome: 'Associação Rural dos Fornecedores e Plantadores de Cana da Média Sorocabana', pres: 'Bruno Garcia Moreira', tel: '(18) 3421-3200', email: 'assocana@assocana.com.br', site: 'http://www.assocana.com.br', cidade: 'Assis', uf: 'SP', end: 'Av Felix de Castro, 1.180 Jd Aeroporto', cep: '19813-700', grupo: 'ORPLANA' },
  { sigla: 'ASSOCAP', nome: 'Associação dos Fornecedores de Cana de Capivari', pres: 'Maria Christina C.G. Pacheco', tel: '(19) 3492-8100', email: 'assocap@assocap.com.br', site: 'http://www.canacap.com.br', cidade: 'Capivari', uf: 'SP', end: 'Chácara Coriolano, s/nº Bairro Coriolano', cep: '13360-000', grupo: 'ORPLANA' },
  { sigla: 'ASSOCICANA', nome: 'Associação dos Plantadores de Cana da Região de Jaú', pres: 'Eduardo Vasconcellos Romão', tel: '(14) 3622-6600', email: 'associcana@associacana.com.br', site: 'http://www.associcana.com.br', cidade: 'Jaú', uf: 'SP', end: 'Av. Caetano Perlatti, 730 Vila Industrial', cep: '17203-370', grupo: 'ORPLANA' },
  { sigla: 'ASSOVALE MT', nome: 'Associação dos Fornecedores de Cana do Vale do Rio Paraguai', pres: 'Normando Corral', tel: '(65) 99968-9334', email: 'assovale@assovale.agr.br', site: 'https://www.assovalemt.com.br/', cidade: 'Nova Olímpia', uf: 'MT', end: 'Av. Olacir Francisco de Moraes, 394-E', cep: '78370-000', grupo: 'ORPLANA' },
  { sigla: 'ASSOVALE SP', nome: 'Associação Rural Vale do Rio Pardo', pres: 'Paulo Maximiano Junqueira Neto', tel: '(16) 3626-0029', email: 'contato@assovale.com.br', site: 'http://www.assovale.com.br', cidade: 'Ribeirão Preto', uf: 'SP', end: 'R. Caraguatatuba, nº 4.000 Jardim Jóquei Clube', cep: '14078-548', grupo: 'ORPLANA' },
  { sigla: 'CANA CANÁPOLIS', nome: 'Associação dos Produtores de Cana da Usina Canápolis', pres: 'Ronaldo Sandre', tel: '(34) 9967-9200', email: 'canacanapolis@gmail.com', site: null, cidade: 'Canápolis', uf: 'MG', end: 'Rua 8, Nº527 - Bairro: Centro', cep: '38380-000', grupo: 'ORPLANA' },
  { sigla: 'CANACAMPO', nome: 'Associação dos fornecedores de cana da região de Campo Florido - MG', pres: 'João Bosco Brandão Salomão', tel: '(34) 3322-1289', email: 'associacao@canacampo.com.br', site: null, cidade: 'Campo Florido', uf: 'MG', end: 'Rodovia BR 262 km 877, número 491 Vila Junqueira', cep: '38130-000', grupo: 'ORPLANA' },
  { sigla: 'CANAOESTE', nome: 'Associação dos Plantadores de Cana do Oeste do Estado de São Paulo', pres: 'Fernando dos Reis Filho', tel: '(16) 3946-3300', email: 'diretoria@canaoeste.com.br', site: 'http://www.canaoeste.com.br', cidade: 'Sertãozinho', uf: 'SP', end: 'Rua Pio Dufles, 532', cep: '14170-680', grupo: 'ORPLANA' },
  { sigla: 'CANAROEIRA', nome: 'Associação dos Fornecedores de Cana da Bioenergética Aroeira', pres: 'João Ulisses de Andrade', tel: '(34) 9978-8702', email: 'administrativo@canaroeira.com.br', site: null, cidade: 'Tupaciguara', uf: 'MG', end: 'Av Tiradentes, 182 - Bairro: Tiradentes', cep: '38480-000', grupo: 'ORPLANA' },
  { sigla: 'CANASOL', nome: 'Associação dos Fornecedores de Cana de Araraquara', pres: 'Luis Henrique Scabello de Oliveira', tel: '(16) 3311-9100', email: 'canasol@canasol.com.br', site: 'http://www.canasol.com.br', cidade: 'Araraquara', uf: 'SP', end: 'Avenida 13 de Maio, 1.406 Vila Xavier', cep: '14810-088', grupo: 'ORPLANA' },
  { sigla: 'CANAUSSU', nome: 'Associação dos Fornecedores de Cana de Chavantes', pres: 'Odair Mariano Pacheco', tel: '(14) 3342-1541', email: 'canaussu@hotmail.com', site: null, cidade: 'Chavantes', uf: 'SP', end: 'Rua Coronel Azarias Bueno, 425', cep: '18970-000', grupo: 'ORPLANA' },
  { sigla: 'NOVOCANA', nome: 'Associação dos Fornecedores de Cana da Região de Novo Horizonte', pres: 'Marcelo Cesar Rangel', tel: '(17) 3542-2752', email: 'novocananh@gmail.com', site: null, cidade: 'Novo Horizonte', uf: 'SP', end: 'Av. Conego Alfredo Reith, 311 Vila Patti', cep: '14960-142', grupo: 'ORPLANA' },
  { sigla: 'OLICANA', nome: 'Associação dos Fornecedores de Cana da Região de Olímpia', pres: 'Celso Castilho Ruiz', tel: '(17) 3281-1733', email: 'associacao.olimpia@uol.com.br', site: 'http://www.olicana.com.br', cidade: 'Olímpia', uf: 'SP', end: 'Rua David de Oliveira, 137 Centro', cep: '15400-000', grupo: 'ORPLANA' },
  { sigla: 'ORICANA', nome: 'Associação dos Fornecedores de Cana da Região de Orindiúva', pres: 'Roberto Cestari', tel: '(17) 3816-1128', email: 'oricana@oricana.com.br', site: 'http://www.oricana.com.br', cidade: 'Orindiúva', uf: 'SP', end: 'R Miguel Bueno Guimarães, 310 Jardim Paulista', cep: '15480-000', grupo: 'ORPLANA' },
  { sigla: 'SOCICANA', nome: 'Associação dos Fornecedores de Cana de Guariba', pres: 'Francisco Antonio de Laurentiis Filho', tel: '(16) 3251-9270', email: 'socicana@socicana.com.br', site: 'http://www.socicana.com.br', cidade: 'Guariba', uf: 'SP', end: 'Rua José Mazzi, 1.450 - Vila Caravelo Caixa Postal 64', cep: '14840-000', grupo: 'ORPLANA' },
  { sigla: 'SULCANAS', nome: 'Associação dos Fornecedores de Cana Sul-Mato-grossense', pres: 'Marcio Verrunes', tel: '(67) 99245-5599', email: 'sulcanas@gmail.com', site: null, cidade: 'Dourados', uf: 'MS', end: 'Oliveira Marques, 1676 Jardim Centro', cep: '79805-021', grupo: 'ORPLANA' },
  { sigla: 'UNICANA', nome: 'Associação dos Fornecedores de Cana da Região de Bebedouro', pres: 'Flávio Xavier Pimentel', tel: '(17) 3342-2845', email: 'unicana@unicana.com.br', site: 'http://www.unicana.com.br/', cidade: 'Bebedouro', uf: 'SP', end: 'Av. Amédia Bernardini Cutrale, número 2730 Jardim São Conrado', cep: '14701-550', grupo: 'ORPLANA' },
];

const connectionAttempts = [
  { label: 'Pooler session us-west-1', config: { host: 'aws-0-us-west-1.pooler.supabase.com', port: 5432, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Pooler transaction us-west-1', config: { host: 'aws-0-us-west-1.pooler.supabase.com', port: 6543, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Pooler us-east-1', config: { host: 'aws-0-us-east-1.pooler.supabase.com', port: 5432, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Pooler sa-east-1', config: { host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${PROJECT_REF}`, password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
  { label: 'Direct DB', config: { host: `db.${PROJECT_REF}.supabase.co`, port: 5432, user: 'postgres', password: SERVICE_ROLE_KEY, database: 'postgres', ssl: { rejectUnauthorized: false } } },
];

async function tryConnect(attempt) {
  const client = new Client(attempt.config);
  try {
    await client.connect();
    console.log(`✅ Conectado via: ${attempt.label}`);
    return client;
  } catch (err) {
    console.log(`❌ ${attempt.label}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('🏗️  Rodando migration de associations...\n');

  let client = null;
  for (const attempt of connectionAttempts) {
    client = await tryConnect(attempt);
    if (client) break;
  }

  if (!client) {
    console.error('\n❌ Não conectou. Rode o SQL manualmente no Supabase Dashboard.');
    process.exit(1);
  }

  try {
    console.log('\n📐 Criando tabela e índices...');
    await client.query(SQL);
    console.log('✅ Schema ok.');

    // Descobrir organization_id (sistema mono-org: pega a primeira)
    const { rows: orgs } = await client.query('SELECT id, name FROM organizations ORDER BY created_at ASC LIMIT 1');
    if (orgs.length === 0) {
      throw new Error('Nenhuma organization encontrada. Faça login primeiro.');
    }
    const orgId = orgs[0].id;
    console.log(`\n🏢 Organization alvo: ${orgs[0].name} (${orgId})`);

    console.log(`\n📥 Inserindo ${ROWS.length} associações...`);
    let inserted = 0;
    let updated = 0;
    for (const r of ROWS) {
      const res = await client.query(
        `INSERT INTO associations (
           organization_id, sigla, nome_completo, presidente, telefone, email, website,
           cidade, estado, endereco, cep, grupo
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
         RETURNING (xmax = 0) AS inserted`,
        [orgId, r.sigla, r.nome, r.pres, r.tel, r.email, r.site, r.cidade, r.uf, r.end, r.cep, r.grupo]
      );
      if (res.rows[0].inserted) inserted++;
      else updated++;
    }

    console.log(`\n✅ Pronto! ${inserted} inseridas, ${updated} atualizadas.`);

    const { rows: count } = await client.query('SELECT COUNT(*)::int AS c FROM associations WHERE organization_id = $1', [orgId]);
    console.log(`📊 Total de associações na org: ${count[0].c}`);
  } catch (err) {
    console.error('\n❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
