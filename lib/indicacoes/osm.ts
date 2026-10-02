// Garimpo de empresas parecidas, na mesma regiao de um cliente que ja esta no CRM.
//
// Fonte: OpenStreetMap (Nominatim pra achar a cidade, Overpass pra listar empresas).
// Tudo gratuito e de uso permitido.
//
// Por que isso traz empresa media/grande sem precisar de filtro de porte:
// no OSM, so empresa de porte ganha um poligono industrial proprio no mapa.
// Padaria e oficina de esquina nao aparecem em landuse=industrial nem man_made=works.
// A escolha da tag JA E o filtro de tamanho.

export interface EmpresaIndicada {
  osmId: string;
  nome: string;
  tipo: string;
  endereco: string | null;
  cidade: string | null;
  telefone: string | null;
  site: string | null;
  lat: number | null;
  lon: number | null;
}

const UA = 'ControleiCRM/1.0 (prospeccao B2B)';

// Na ampliacao por raio so entram estes: 4 filtros levam ~100s num raio de 30km,
// e a lista completa estoura o tempo do servidor publico (testado: 504).
const NUCLEO_INDUSTRIAL = [
  '["landuse"="industrial"]["name"]',
  '["man_made"="works"]["name"]',
  '["landuse"="quarry"]["name"]',
  '["industrial"]["name"]',
];

// Espelhos publicos do Overpass. Sao servicos doados e caem/engasgam com frequencia,
// entao tenta um por um, com teto de tempo curto em cada.
const ESPELHOS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// Perfis de busca. "industria" e o padrao: pega fabrica, pedreira e planta industrial.
export const PERFIS: Record<string, { rotulo: string; filtros: string[] }> = {
  // Padrao amplo: so filtrar depois, se vier demais. Perfil estreito achando
  // zero parece sistema quebrado, e empresa boa fica de fora por causa da
  // marcacao que o mapa usou (uma automatizadora pneumatica costuma estar
  // como "office" ou "craft", nao como "industrial").
  tudo: {
    rotulo: 'Tudo',
    // Lista curada de proposito. ["office"] e ["craft"] sem qualificar traziam
    // Ministerio Publico, Sindicato Rural, Casa da Agricultura e chaveiro —
    // nada disso compra de concreteira nem de metalurgica.
    filtros: [
      '["landuse"="quarry"]["name"]', '["man_made"="works"]["name"]',
      '["landuse"="industrial"]["name"]', '["industrial"]["name"]',
      '["office"~"^(company|industrial|logistics|engineer|construction_company|energy_supplier)$"]["name"]',
      '["craft"~"^(metal_construction|blacksmith|welder|builder|electrician|carpenter)$"]["name"]',
      '["shop"~"^(trade|doityourself|hardware|car_repair)$"]["name"]',
    ],
  },
  industria: {
    rotulo: 'Indústria, pedreira e fábrica',
    filtros: ['["landuse"="quarry"]["name"]', '["man_made"="works"]["name"]', '["landuse"="industrial"]["name"]'],
  },
  construcao: {
    rotulo: 'Construção e materiais',
    filtros: ['["shop"="trade"]["name"]', '["shop"="doityourself"]["name"]', '["craft"="builder"]["name"]', '["landuse"="quarry"]["name"]'],
  },
  oficina: {
    rotulo: 'Oficina e metalurgia',
    filtros: ['["craft"~"^(metal_construction|blacksmith|welder)$"]["name"]', '["shop"="car_repair"]["name"]'],
  },
  empresa: {
    rotulo: 'Escritórios e empresas',
    filtros: ['["office"="company"]["name"]', '["office"="industrial"]["name"]'],
  },
};

async function buscarJson(url: string, corpo?: string, msTimeout = 45000) {
  const r = await fetch(url, {
    method: corpo ? 'POST' : 'GET',
    headers: { 'User-Agent': UA, Accept: 'application/json',
               ...(corpo ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: corpo,
    signal: AbortSignal.timeout(msTimeout),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// Nominatim: "Rio Claro" + "SP" -> id da area no OSM
async function acharArea(cidade: string, estado: string | null) {
  const busca = [cidade, estado, 'Brasil'].filter(Boolean).join(', ');
  const q = new URLSearchParams({ q: busca, format: 'json', limit: '1' });
  const d = await buscarJson(`https://nominatim.openstreetmap.org/search?${q}`, undefined, 20000);
  const o = Array.isArray(d) ? d[0] : null;
  if (!o) return null;
  return {
    areaId: o.osm_type === 'relation' ? 3600000000 + Number(o.osm_id) : null,
    lat: Number(o.lat),
    lon: Number(o.lon),
    nome: o.display_name as string,
  };
}

function montarConsulta(
  area: { areaId: number | null; lat: number; lon: number },
  filtros: string[],
  raioKm?: number
) {
  // raioKm forca a busca por raio, ignorando a divisa do municipio
  const porRaio = raioKm != null || area.areaId == null;
  const escopo = porRaio ? '' : `area(${area.areaId})->.a;`;
  const dentro = porRaio
    ? `(around:${(raioKm ?? 25) * 1000},${area.lat},${area.lon})`
    : '(area.a)';
  const corpo = filtros.map((f) => `  nwr${f}${dentro};`).join('\n');
  return `[out:json][timeout:60];\n${escopo}\n(\n${corpo}\n);\nout center tags;`;
}

function normalizar(e: any): EmpresaIndicada | null {
  const t = e.tags || {};
  if (!t.name) return null;
  const rua = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
  return {
    osmId: `${e.type}/${e.id}`,
    nome: String(t.name).trim(),
    tipo: t.landuse || t.man_made || t.craft || t.shop || t.office || t.industrial || 'empresa',
    endereco: rua || null,
    cidade: t['addr:city'] || null,
    telefone: t.phone || t['contact:phone'] || null,
    site: t.website || t['contact:website'] || null,
    lat: e.lat ?? e.center?.lat ?? null,
    lon: e.lon ?? e.center?.lon ?? null,
  };
}

export async function garimpar(
  cidade: string,
  estado: string | null,
  perfil: string
): Promise<{ empresas: EmpresaIndicada[]; regiao: string; raioKm: number | null }> {
  const area = await acharArea(cidade, estado);
  if (!area) throw new Error(`Não encontrei "${cidade}" no mapa.`);

  const def = PERFIS[perfil] || PERFIS.tudo;

  async function rodar(raioKm?: number, msTeto = 45000) {
    // no raio vale so o nucleo industrial: a lista completa derruba o servidor
    const filtros = raioKm ? NUCLEO_INDUSTRIAL : def.filtros;
    const consulta = montarConsulta(area!, filtros, raioKm);
    const corpo = new URLSearchParams({ data: consulta }).toString();
    const erros: string[] = [];
    for (const espelho of ESPELHOS) {
      try {
        const r = await buscarJson(espelho, corpo, msTeto);
        return (r.elements || []).map(normalizar).filter(Boolean) as EmpresaIndicada[];
      } catch (e) {
        erros.push(`${new URL(espelho).host}: ${e instanceof Error ? e.message : 'falhou'}`);
      }
    }
    throw new Error(`Os servidores do mapa não responderam. ${erros.join(' | ')}`);
  }

  // 1a tentativa: dentro do municipio
  let achadas = await rodar();
  let raioUsado: number | null = null;

  // Cidade pequena entrega pouco. Em vez de dizer "nada encontrado", abre pra
  // 40km em volta: a industria boa costuma estar no municipio vizinho.
  // Cidade pequena entrega pouco. Abre pra 25km em volta — a industria boa
  // costuma estar no municipio vizinho. Teto de 35s: se o servidor publico
  // engasgar, fica com o que a 1a busca trouxe em vez de deixar o vendedor
  // esperando ate a requisicao morrer.
  if (achadas.length < 10) {
    try {
      const ampliado = await rodar(25, 35000);
      if (ampliado.length > achadas.length) {
        achadas = [...achadas, ...ampliado];
        raioUsado = 25;
      }
    } catch {
      // servidor publico engasgou: segue com o resultado do municipio
    }
  }

  // tira repetidos pelo nome
  const vistos = new Set<string>();
  const unicas = achadas.filter((e) => {
    const k = e.nome.toLowerCase();
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  return { empresas: unicas, regiao: area.nome, raioKm: raioUsado };
}

// comparacao de nomes pra nao reindicar quem ja esta no CRM
export function chaveNome(s: string) {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(ltda|me|epp|eireli|sa|s\/a|cia|comercio|industria|e|de|da|do|dos|das)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}
