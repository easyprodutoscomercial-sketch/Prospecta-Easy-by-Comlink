// Scrapa a lista oficial de expositores da Agrishow 2026 via GraphQL do Swapcard
// (mesma API que alimenta o app.agrishow.com.br).
// Saída: scripts/agrishow-exhibitors.json
//
// Usage: node scripts/scrape-agrishow-exhibitors.mjs

const ENDPOINT = 'https://api.swapcard.com/graphql';
const VIEW_ID = 'RXZlbnRWaWV3XzEyMzgwOTI='; // Core_EventView_1238092 (lista de empresas)
const EVENT_ID = 'RXZlbnRfMzk0MjIzOA==';    // Core_Event_3942238 (Agrishow Experience 2026)

const QUERY = `query($viewId: ID!, $endCursor: String, $eventId: ID!) {
  view: Core_eventExhibitorListView(viewId: $viewId) {
    id
    exhibitors(cursor: { first: 100, after: $endCursor }) {
      nodes {
        id: _id
        name
        type
        logoUrl
        htmlDescription
        withEvent(eventId: $eventId) { booth }
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
}`;

async function fetchPage(endCursor) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://app.agrishow.com.br',
      'Referer': 'https://app.agrishow.com.br/',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { viewId: VIEW_ID, endCursor, eventId: EVENT_ID },
    }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error('GraphQL error: ' + JSON.stringify(json.errors));
  }
  return json.data.view.exhibitors;
}

function stripHtml(s) {
  if (!s) return '';
  return String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function main() {
  console.log('🔎 Scraping Agrishow 2026 exhibitors...\n');
  const all = [];
  let cursor = null;
  let page = 0;
  let total = null;

  while (true) {
    page++;
    const data = await fetchPage(cursor);
    if (total === null) total = data.totalCount;
    const nodes = data.nodes || [];
    for (const n of nodes) {
      all.push({
        swapcard_id: n.id,
        name: n.name,
        type: n.type || null,
        booth: n.withEvent?.booth || null,
        logo_url: n.logoUrl || null,
        description: stripHtml(n.htmlDescription).slice(0, 500) || null,
      });
    }
    console.log(`   página ${page}: +${nodes.length} (${all.length}/${total})`);
    if (!data.pageInfo.hasNextPage) break;
    cursor = data.pageInfo.endCursor;
  }

  const fs = await import('node:fs');
  const path = await import('node:path');
  const outPath = path.join(process.cwd(), 'scripts', 'agrishow-exhibitors.json');
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2));
  console.log(`\n✅ ${all.length} expositores salvos em ${outPath}`);

  const withBooth = all.filter(e => e.booth).length;
  const withLogo = all.filter(e => e.logo_url).length;
  console.log(`   com stand: ${withBooth}`);
  console.log(`   com logo:  ${withLogo}`);
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
