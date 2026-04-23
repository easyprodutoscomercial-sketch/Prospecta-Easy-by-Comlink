// Popula event_booths.position_x / position_y dos 712 stands Agrishow 2026
// que casaram com o mapa oficial da Zapt.
// Normaliza as coordenadas Zapt (sistema interno) pra % 0-100.
//
// Usage: node scripts/apply-zapt-positions.mjs

import fs from 'node:fs';

const SUPABASE_URL = 'https://edwkdrgferjbitxwlwrf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkd2tkcmdmZXJqYml0eHdsd3JmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDcxMjA3OSwiZXhwIjoyMDg2Mjg4MDc5fQ.KILRshoC8XLuoJyx9Xrlz_Ve8-W9LOxYtsvWndyXfdc';
const EVENT_ID = '0e331665-e083-429c-9fae-9e67888a9a80';

const HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function sb(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} — ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const input = JSON.parse(fs.readFileSync('scripts/agrishow-stands-enriched.json', 'utf8'));
  const stands = input.enriched;
  const bbox = input.meta.bbox;

  console.log(`Lidos ${stands.length} stands casados.\n`);
  console.log(`Bounding box Zapt: X [${bbox.xMin.toFixed(0)}, ${bbox.xMax.toFixed(0)}], Y [${bbox.yMin.toFixed(0)}, ${bbox.yMax.toFixed(0)}]`);

  // Preservar aspect ratio: normaliza pelo eixo maior
  const xRange = bbox.xMax - bbox.xMin;
  const yRange = bbox.yMax - bbox.yMin;
  const maxRange = Math.max(xRange, yRange);

  // Margin de 2% pra pins nao colarem na borda
  const margin = 2;
  const usable = 100 - 2 * margin;

  // Aspect ratio: mapa horizontal (x maior que y). X ocupa 0..100, Y ocupa centro verticalmente
  const xScale = xRange / maxRange;
  const yScale = yRange / maxRange;
  const xPad = (1 - xScale) / 2; // centraliza se necessario
  const yPad = (1 - yScale) / 2;

  function normalize(x, y) {
    const nx = (x - bbox.xMin) / maxRange;  // 0..xScale
    const ny = (y - bbox.yMin) / maxRange;  // 0..yScale
    const pctX = margin + (xPad + nx) * usable;
    const pctY = margin + (yPad + ny) * usable;
    return { px: +pctX.toFixed(2), py: +pctY.toFixed(2) };
  }

  // Buscar todos os booths existentes desse evento (external_id + zapt_id se existir)
  console.log('\nBuscando booths existentes...');
  let allBooths = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const page = await sb(
      `/event_booths?event_id=eq.${EVENT_ID}&select=id,external_id,company_name,booth_number&limit=${pageSize}&offset=${offset}`
    );
    allBooths = allBooths.concat(page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  console.log(`  ${allBooths.length} booths no evento.`);
  const byExtId = new Map(allBooths.filter(b => b.external_id).map(b => [b.external_id, b]));

  // Preview das 5 primeiras normalizacoes
  console.log('\nPreview normalizacao (5 primeiras):');
  for (const s of stands.slice(0, 5)) {
    const { px, py } = normalize(s.x, s.y);
    console.log(`  ${s.booth?.padEnd(8)} ${s.name.slice(0,25).padEnd(25)} Zapt(${s.x.toFixed(0)}, ${s.y.toFixed(0)}) -> (${px}%, ${py}%)`);
  }

  // UPDATE em batch via PATCH (PostgREST faz 1 por id via eq.)
  let updated = 0;
  let notFound = 0;
  const errors = [];

  console.log(`\nAtualizando posicoes de ${stands.length} stands...`);

  for (const s of stands) {
    const booth = byExtId.get(s.swapcard_id);
    if (!booth) { notFound++; continue; }

    const { px, py } = normalize(s.x, s.y);
    const patch = { position_x: px, position_y: py };
    // Opcional: se o nome/website da Zapt for melhor, atualiza
    if (s.site && !booth.website) patch.website = s.site;

    try {
      await sb(`/event_booths?id=eq.${booth.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      updated++;
      if (updated % 50 === 0) process.stdout.write(`  ${updated}/${stands.length}\r`);
    } catch (e) {
      errors.push({ id: booth.id, err: e.message });
    }
  }

  console.log(`\n\n=== RESULTADO ===`);
  console.log(`  Posicoes atualizadas: ${updated}`);
  console.log(`  Sem booth correspondente: ${notFound}`);
  console.log(`  Erros: ${errors.length}`);
  if (errors.length) console.log(JSON.stringify(errors.slice(0, 3), null, 2));

  // Verificacao final
  const check = await sb(
    `/event_booths?event_id=eq.${EVENT_ID}&position_x=not.is.null&position_y=not.is.null&select=id&limit=0`,
    { headers: { Prefer: 'count=exact' } }
  );
  console.log(`\nBooths agora com posicao: verifique no dashboard.`);
}

main().catch(err => {
  console.error('ERRO FATAL:', err.message);
  process.exit(1);
});
