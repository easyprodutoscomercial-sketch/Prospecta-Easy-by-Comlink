// Popula event_booths.polygon + event_booths.zapt_id com dados da Zapt.
// Polygons ficam normalizados no mesmo sistema de % que position_x/y.
//
// Usage: node scripts/apply-zapt-polygons.mjs

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

function makeNormalizer(bbox) {
  const xRange = bbox.xMax - bbox.xMin;
  const yRange = bbox.yMax - bbox.yMin;
  const maxRange = Math.max(xRange, yRange);
  const xScale = xRange / maxRange;
  const yScale = yRange / maxRange;
  const xPad = (1 - xScale) / 2;
  const yPad = (1 - yScale) / 2;
  const margin = 2;
  const usable = 100 - 2 * margin;

  return (x, y) => {
    const nx = (x - bbox.xMin) / maxRange;
    const ny = (y - bbox.yMin) / maxRange;
    const px = margin + (xPad + nx) * usable;
    const py = margin + (yPad + ny) * usable;
    return [+px.toFixed(2), +py.toFixed(2)];
  };
}

async function main() {
  const input = JSON.parse(fs.readFileSync('scripts/agrishow-stands-enriched.json', 'utf8'));
  const stands = input.enriched;
  const normalize = makeNormalizer(input.meta.bbox);

  console.log(`Lidos ${stands.length} stands.\n`);

  let allBooths = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const page = await sb(
      `/event_booths?event_id=eq.${EVENT_ID}&select=id,external_id&limit=${pageSize}&offset=${offset}`
    );
    allBooths = allBooths.concat(page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  const byExtId = new Map(allBooths.filter(b => b.external_id).map(b => [b.external_id, b]));
  console.log(`${allBooths.length} booths no evento.\n`);

  // Normaliza o polygon (array de segmentos com pontos em coord Zapt)
  // Formato: [[[x,y],[x,y]], [[x,y],[x,y]], ...]
  // Normalizado: [[[px,py],[px,py]], ...]
  function normPolygon(poly) {
    if (!Array.isArray(poly)) return null;
    const out = [];
    for (const seg of poly) {
      if (!Array.isArray(seg)) continue;
      const nseg = [];
      for (const pt of seg) {
        if (Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
          nseg.push(normalize(pt[0], pt[1]));
        }
      }
      if (nseg.length) out.push(nseg);
    }
    return out.length ? out : null;
  }

  let updated = 0, withPoly = 0, notFound = 0;

  for (const s of stands) {
    const booth = byExtId.get(s.swapcard_id);
    if (!booth) { notFound++; continue; }

    const patch = {
      zapt_id: s.zapt_id,
    };
    if (s.polygon) {
      const norm = normPolygon(s.polygon);
      if (norm) { patch.polygon = norm; withPoly++; }
    }

    try {
      await sb(`/event_booths?id=eq.${booth.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      updated++;
      if (updated % 50 === 0) process.stdout.write(`  ${updated}/${stands.length}\r`);
    } catch (e) {
      console.error(`\nErro em ${s.name}:`, e.message);
    }
  }

  console.log(`\n\n=== RESULTADO ===`);
  console.log(`  Booths atualizados (zapt_id): ${updated}`);
  console.log(`  Com polygon completo: ${withPoly}`);
  console.log(`  Sem booth: ${notFound}`);
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
