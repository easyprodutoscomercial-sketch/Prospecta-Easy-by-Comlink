const { Client } = require('pg');
const fs = require('fs');

const PROJECT_REF = 'edwkdrgferjbitxwlwrf';
const DB_PASSWORD = process.env.DB_PASSWORD;

if (!DB_PASSWORD) {
  console.log('Erro: DB_PASSWORD nao definido.');
  process.exit(1);
}

async function tryConnect(connStr, label) {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  try {
    console.log(`Tentando ${label}...`);
    await client.connect();
    console.log(`Conectado via ${label}!`);
    return client;
  } catch (err) {
    console.log(`  Falhou: ${err.message}`);
    return null;
  }
}

async function main() {
  const regions = [
    'aws-0-sa-east-1',
    'aws-0-us-east-1',
    'aws-0-us-west-1',
    'aws-0-eu-west-1',
    'aws-0-ap-southeast-1',
  ];

  const options = [];

  // Tentar conexao direta primeiro
  options.push([`postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres`, 'direto porta 5432']);

  // Tentar cada regiao com pooler
  for (const region of regions) {
    options.push([`postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@${region}.pooler.supabase.com:5432/postgres`, `pooler ${region} session`]);
    options.push([`postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@${region}.pooler.supabase.com:6543/postgres`, `pooler ${region} transaction`]);
  }

  let client = null;
  for (const [connStr, label] of options) {
    client = await tryConnect(connStr, label);
    if (client) break;
  }

  if (!client) {
    console.log('\nNenhuma conexao funcionou.');
    process.exit(1);
  }

  try {
    const sql = fs.readFileSync('schema-migration-v4-attachments.sql', 'utf-8');
    console.log('\nRodando migration...');
    await client.query(sql);
    console.log('Migration executada com sucesso!');

    const res = await client.query("SELECT count(*) FROM information_schema.tables WHERE table_name = 'contact_attachments'");
    console.log('Tabela contact_attachments existe:', parseInt(res.rows[0].count) > 0 ? 'SIM' : 'NAO');
  } catch (err) {
    console.error('Erro na migration:', err.message);
  } finally {
    await client.end();
  }
}

main();
