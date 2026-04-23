// Cruza os dados da Zapt (mapa oficial) com os 754 expositores do Swapcard.
// Saida: relatorio de match + arquivo scripts/agrishow-stands-enriched.json
// com posicao x/y + polygon + logo + site, pronto pra popular event_booths.

import fs from 'node:fs';
import path from 'node:path';

const zapt = JSON.parse(fs.readFileSync('scripts/zapt-agrishow-stands.json', 'utf8'));
const swap = JSON.parse(fs.readFileSync('scripts/agrishow-exhibitors.json', 'utf8'));

const zaptArr = Object.values(zapt);

function normName(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
function normBooth(s) {
  if (!s) return '';
  return String(s).toUpperCase().replace(/\s+/g, '').trim();
}

// Indices Zapt
const byExtId = new Map();
const bySubtitle = new Map();
const byTitle = new Map();
for (const z of zaptArr) {
  if (z.externalId) byExtId.set(z.externalId, z);
  if (z.subtitle) {
    const k = normBooth(z.subtitle);
    if (!bySubtitle.has(k)) bySubtitle.set(k, []);
    bySubtitle.get(k).push(z);
  }
  if (z.title) {
    const k = normName(z.title);
    if (!byTitle.has(k)) byTitle.set(k, []);
    byTitle.get(k).push(z);
  }
}

// Cruzamento
let matchId = 0, matchBooth = 0, matchName = 0, noMatch = 0;
const enriched = [];
const orphansSwap = [];
for (const s of swap) {
  let z = null;
  let matchedBy = null;

  if (s.swapcard_id && byExtId.has(s.swapcard_id)) {
    z = byExtId.get(s.swapcard_id);
    matchedBy = 'externalId';
    matchId++;
  } else if (s.booth) {
    const candidates = bySubtitle.get(normBooth(s.booth)) || [];
    if (candidates.length === 1) {
      z = candidates[0];
      matchedBy = 'booth';
      matchBooth++;
    } else if (candidates.length > 1) {
      // tenta desempate por nome
      const byN = candidates.find(c => normName(c.title) === normName(s.name));
      if (byN) { z = byN; matchedBy = 'booth+name'; matchBooth++; }
    }
  }
  if (!z && s.name) {
    const cands = byTitle.get(normName(s.name)) || [];
    if (cands.length >= 1) {
      z = cands[0];
      matchedBy = 'name';
      matchName++;
    }
  }

  if (z) {
    enriched.push({
      swapcard_id: s.swapcard_id,
      name: s.name,
      booth: s.booth,
      logo_url: s.logo_url,
      zapt_id: z.id,
      zapt_title: z.title,
      zapt_subtitle: z.subtitle,
      x: z.x,
      y: z.y,
      polygon: z.polygon || null,
      site: z.site || null,
      media: z.media || null,
      matched_by: matchedBy,
    });
  } else {
    noMatch++;
    orphansSwap.push({ name: s.name, booth: s.booth, swapcard_id: s.swapcard_id });
  }
}

// Orfaos da Zapt (no mapa mas nao na lista oficial de expositores)
const swapExtIds = new Set(swap.map(s => s.swapcard_id));
const orphansZapt = zaptArr
  .filter(z => !z.externalId || !swapExtIds.has(z.externalId))
  .filter(z => !enriched.find(e => e.zapt_id === z.id))
  .map(z => ({ title: z.title, subtitle: z.subtitle, id: z.id }));

// Estatisticas de bounding box (pra normalizar dps)
const xs = zaptArr.filter(z => typeof z.x === 'number').map(z => z.x);
const ys = zaptArr.filter(z => typeof z.y === 'number').map(z => z.y);
const bbox = {
  xMin: Math.min(...xs), xMax: Math.max(...xs),
  yMin: Math.min(...ys), yMax: Math.max(...ys),
};

console.log('\n=== RELATORIO DE CRUZAMENTO ===\n');
console.log('Swapcard (lista oficial):', swap.length, 'expositores');
console.log('Zapt (mapa oficial):     ', zaptArr.length, 'stands\n');
console.log('Match por externalId:  ', matchId, '(forte, ID global)');
console.log('Match por booth code:  ', matchBooth, '(subtitle == booth)');
console.log('Match por nome:        ', matchName, '(ultima chance)');
console.log('Total casado:          ', enriched.length, '/', swap.length, `(${(enriched.length/swap.length*100).toFixed(1)}%)`);
console.log('Orfaos Swapcard:       ', orphansSwap.length, '(expositor sem lugar no mapa)');
console.log('Orfaos Zapt:           ', orphansZapt.length, '(pontos no mapa sem expositor oficial)\n');

console.log('Bounding box coordenadas Zapt:');
console.log(`  X: ${bbox.xMin.toFixed(0)} - ${bbox.xMax.toFixed(0)} (range: ${(bbox.xMax-bbox.xMin).toFixed(0)})`);
console.log(`  Y: ${bbox.yMin.toFixed(0)} - ${bbox.yMax.toFixed(0)} (range: ${(bbox.yMax-bbox.yMin).toFixed(0)})\n`);

console.log('Preview dos 5 primeiros casamentos:');
for (const e of enriched.slice(0, 5)) {
  console.log(`  ${e.booth?.padEnd(8) || '-'.padEnd(8)} | ${e.name.padEnd(30).slice(0,30)} -> Zapt ${e.zapt_subtitle?.padEnd(6) || '-'} ${e.zapt_title?.slice(0,25)} | via ${e.matched_by}`);
}

console.log('\nPreview dos 5 primeiros orfaos Swapcard (sem lugar no mapa):');
for (const o of orphansSwap.slice(0, 5)) {
  console.log(`  ${o.booth?.padEnd(8) || '-'.padEnd(8)} | ${o.name}`);
}

const outPath = path.join(process.cwd(), 'scripts', 'agrishow-stands-enriched.json');
fs.writeFileSync(outPath, JSON.stringify({
  meta: {
    total_swapcard: swap.length,
    total_zapt: zaptArr.length,
    matched: enriched.length,
    orphans_swap: orphansSwap.length,
    orphans_zapt: orphansZapt.length,
    bbox,
    generated_at: new Date().toISOString(),
  },
  enriched,
  orphans_swap: orphansSwap,
  orphans_zapt: orphansZapt,
}, null, 2));
console.log(`\nSalvo em ${outPath}`);
