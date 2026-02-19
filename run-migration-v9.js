const { Client } = require('pg');
const fs = require('fs');

const PROJECT_REF = 'edwkdrgferjbitxwlwrf';
const DB_PASSWORD = process.env.DB_PASSWORD;

if (!DB_PASSWORD) {
  console.log('Erro: DB_PASSWORD nao definido.');
  console.log('Use: set DB_PASSWORD=SuaSenha && node run-migration-v9.js');
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
  options.push([`postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres`, 'direto porta 5432']);

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
    const sql = fs.readFileSync('schema-migration-v9-multi-pipeline.sql', 'utf-8');
    console.log('\nRodando migration v9 (Multi-Pipeline)...');
    await client.query(sql);
    console.log('Migration v9 executada com sucesso!');

    // Verificar tabelas criadas
    const res1 = await client.query("SELECT count(*) FROM pipelines");
    console.log(`Tabela pipelines: OK (${res1.rows[0].count} registros)`);

    const res2 = await client.query("SELECT count(*) FROM pipeline_stages");
    console.log(`Tabela pipeline_stages: OK (${res2.rows[0].count} registros)`);

    // Verificar colunas em contacts
    const res3 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts' AND column_name IN ('pipeline_id', 'stage_id') ORDER BY column_name");
    console.log(`Colunas em contacts: ${res3.rows.map(r => r.column_name).join(', ')}`);

    // Verificar backfill
    const res4 = await client.query("SELECT count(*) FROM contacts WHERE pipeline_id IS NOT NULL");
    const res5 = await client.query("SELECT count(*) FROM contacts");
    console.log(`Backfill: ${res4.rows[0].count}/${res5.rows[0].count} contatos com pipeline_id`);
  } catch (err) {
    console.error('Erro na migration:', err.message);
  } finally {
    await client.end();
  }
}

main();
