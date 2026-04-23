// Baixa lista de stands do mapa oficial da Zapt.
// A API eh publica, sem auth. O placeId vem da URL do iframe
// (https://maps.zapt.tech/#/place/{placeId}/map/0).
//
// Saida: scripts/zapt-{placeId}-stands.json
//
// Usage: node scripts/scrape-zapt-stands.mjs [placeId]
// Default placeId = Agrishow 2026.

import fs from 'node:fs';
import path from 'node:path';

const PLACE_ID = process.argv[2] || '-on2scahel17oa-ofwcr';
const URL = `https://api.zapt.tech/api/v1/locals/${PLACE_ID}/interests?limit=5000`;

async function main() {
  console.log(`Baixando stands Zapt place=${PLACE_ID}...`);
  const res = await fetch(URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    console.error(`Falhou: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const data = await res.json();
  const ids = Object.keys(data);
  const comPoly = ids.filter(k => data[k].polygon && data[k].polygon.length).length;
  const comSub = ids.filter(k => data[k].subtitle).length;

  const outName = PLACE_ID === '-on2scahel17oa-ofwcr'
    ? 'zapt-agrishow-stands.json'
    : `zapt-${PLACE_ID.replace(/[^a-z0-9]/g, '')}-stands.json`;
  const outPath = path.join(process.cwd(), 'scripts', outName);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));

  console.log(`  ${ids.length} stands baixados`);
  console.log(`  ${comPoly} com polygon (forma do stand)`);
  console.log(`  ${comSub} com codigo do stand (subtitle)`);
  console.log(`  Salvo em ${outPath}`);
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
