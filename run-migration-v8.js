const { Client } = require('pg');
const fs = require('fs');

const PROJECT_REF = 'edwkdrgferjbitxwlwrf';
const DB_PASSWORD = process.env.DB_PASSWORD;

if (!DB_PASSWORD) {
  console.log('Erro: DB_PASSWORD nao definido.');
  console.log('Use: set DB_PASSWORD=SuaSenha && node run-migration-v8.js');
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
    const sql = fs.readFileSync('schema-migration-v8-meetings.sql', 'utf-8');
    console.log('\nRodando migration v8 (Meetings / Calendario)...');
    await client.query(sql);
    console.log('Migration v8 executada com sucesso!');

    // Verificar tabela criada
    const res1 = await client.query("SELECT count(*) FROM meetings");
    console.log(`Tabela meetings: OK (${res1.rows[0].count} registros)`);

    // Verificar coluna scheduled_for em notifications
    const res2 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'scheduled_for'");
    console.log(`Coluna notifications.scheduled_for: ${res2.rows.length > 0 ? 'OK' : 'NAO ENCONTRADA'}`);
  } catch (err) {
    console.error('Erro na migration:', err.message);
  } finally {
    await client.end();
  }
}

main();
