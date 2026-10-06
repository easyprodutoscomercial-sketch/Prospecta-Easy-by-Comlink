// Indicacoes pela IA (OpenAI com pesquisa na internet), so quando o consultor
// clica e confirma o custo.
//
// Existe porque o OpenStreetMap nao serviu: em 02/10 os 3 espelhos publicos do
// Overpass estouraram o tempo ate na menor consulta de Campinas (so oficinas),
// e um deles passou a recusar conexao. Dados da Receita tambem nao: o portal de
// dados abertos recusa conexao.
//
// Risco principal: modelo de linguagem INVENTA empresa, telefone e CNPJ com toda
// a confianca. Por isso a busca roda com a ferramenta de pesquisa na web e so
// aproveita empresa cuja "fonte" e uma pagina que a pesquisa realmente abriu.

// Teste real em 02/10 (Wortex, Campinas): gpt-4.1-mini 5 empresas/R$0,08 (incluiu a
// propria Wortex); gpt-4.1 6 com repetidas/R$0,14; gpt-5-mini 0 a 3/ate R$1,43;
// gpt-5 (esforco baixo) 12 empresas sem repetir, 17 pesquisas, 177s, R$1,85.
// Depois, em RODADAS de 4: gpt-5-mini 12 empresas em 58s por R$0,85 (gpt-4.1-mini
// teve as 4 descartadas por fonte nao aberta). gpt-5 inteiro custou R$2,61 na tela:
// caro demais pro dono. Por isso o padrao e o mini em rodadas.
export const MODELO = process.env.INDICACOES_IA_MODELO || 'gpt-5-mini';
export const MIN_EMPRESAS = 10;
export const MAX_EMPRESAS = 12;
// Buscas por dia agora sao por usuario, definidas pelo admin: ver lib/indicacoes/permissao.ts
export const DIAS_CACHE_IA = 3650; // busca fica guardada (o dono revisita quando quiser)
// A busca roda em RODADAS curtas pra tela ir enchendo e o consultor poder parar
// quando quiser: cada rodada pede poucas empresas novas por um angulo diferente.
export const POR_RODADA = 4;
export const MAX_RODADAS = 5;
export const MAX_PESQUISAS = 4; // pesquisas na internet dentro de UMA rodada

// Empresa grande e mais rara que oficina: os angulos miram fabricante, distribuidor,
// distrito industrial e lista de associados/expositores, e o raio e de 100 km.
export const RAIO_KM = 100;
const ANGULOS = [
  'pela atividade principal na cidade do cliente e nos distritos/polos industriais da região',
  'pelos produtos/serviços e sinônimos da atividade, procurando fabricantes, indústrias e distribuidores',
  `nas cidades vizinhas (até ${RAIO_KM} km), pela atividade`,
  'em listas de associados de entidades do setor (ex.: ABIMAQ, sindicatos patronais, FIESP/CIESP), expositores de feiras do setor e rankings de maiores empresas da região',
  'em qualquer fonte confiável que ainda não usou, mesma região',
];

// Precos em dolar por milhao de tokens. Confira em platform.openai.com/docs/pricing
// quando a fatura chegar: se mudarem, o custo exibido ao consultor fica errado.
const PRECOS_USD: Record<string, { entrada: number; saida: number }> = {
  'gpt-4.1-mini': { entrada: 0.4, saida: 1.6 },
  'gpt-4.1': { entrada: 2, saida: 8 },
  'gpt-5-mini': { entrada: 0.25, saida: 2 },
  'gpt-5': { entrada: 1.25, saida: 10 },
};
const USD_POR_PESQUISA = 0.01; // cada chamada da ferramenta de pesquisa na web
// Modelos sem raciocinio (4.1) fazem UMA pesquisa e param: no teste de 02/10
// devolveram 5-6 empresas e o 4.1 ainda repetiu a mesma 3 vezes. Os de
// raciocinio pesquisam varias vezes ate cumprir o pedido.
const RACIOCINA = (m: string) => /^(gpt-5|o\d)/.test(m);
export const DOLAR_EM_REAIS = 5.5;
// Usada so ate existir historico; depois o valor exibido e a media real das
// ultimas buscas da empresa.
export const ESTIMATIVA_INICIAL_REAIS = 0.9;

export interface EmpresaIA {
  osmId: string; // id da linha na tela (mesmo campo das indicacoes do mapa)
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  segmento: string | null;
  descricao: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
  instagram: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  fonte: string;
  nota: number | null;
  motivo: string | null;
  tipo: string;
  lat: null;
  lon: null;
  porte_indicio?: string | null; // o que a IA viu de tamanho (fabrica, funcionarios, filiais)
  porte?: string | null; // porte oficial da Receita, quando o CNPJ foi conferido
  porteConfirmado?: boolean; // true = Receita confirmou que nao e Micro/Pequena
  jaNoCrm?: boolean;
  contatoId?: string | null; // contato (rascunho) criado quando a busca terminou
  noFunil?: boolean; // ja foi jogado pro funil
  apagado?: boolean;
}

export interface UsoOpenAI {
  input_tokens?: number;
  output_tokens?: number;
}

export function custoEmReais(uso: UsoOpenAI | null | undefined, pesquisas: number) {
  const preco = PRECOS_USD[MODELO] || PRECOS_USD['gpt-5'];
  const usd =
    ((uso?.input_tokens || 0) / 1e6) * preco.entrada +
    ((uso?.output_tokens || 0) / 1e6) * preco.saida +
    pesquisas * USD_POR_PESQUISA;
  return Math.round(usd * DOLAR_EM_REAIS * 100) / 100;
}

// Uma busca por cliente: a ficha inteira dele entra no pedido, entao o
// resultado e "parecidas com ESTE cliente", nao "do segmento X na cidade Y".
export function chaveIA(contatoId: string) {
  return `ia|contato|${contatoId}`;
}

export interface FichaCliente {
  name: string; company: string | null; cidade: string; estado: string | null; segmento: string | null;
  tipo: string[] | null; produtos_fornecidos: string | null; referencia: string | null; classe: string | null;
  notes: string | null; website: string | null; cnpj: string | null; cep: string | null; endereco: string | null;
  cargo: string | null; instagram: string | null;
}

export interface DadosOficiais {
  razao_social?: string | null; cnae_principal: string | null; cnaes_secundarios: string[]; porte: string | null;
}

const corta = (s: string | null | undefined, n: number) => (s ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');

export function montarPedido(
  ref: FichaCliente,
  receita: DadosOficiais | null | undefined,
  parecidosNoCrm: string[],
  rodada: { numero: number; quantas: number; excluir: string[]; perfilConfirmado?: string | null }
) {
  const local = `${ref.cidade}${ref.estado ? `/${ref.estado}` : ''}`;
  const empresa = ref.company && ref.company !== ref.name ? `${ref.name} (${ref.company})` : ref.name;

  // so entra linha de campo preenchido: campo vazio no pedido so confunde a IA
  const ficha = [
    `- Empresa: ${empresa}`,
    ref.cnpj && `- CNPJ: ${ref.cnpj}`,
    receita?.razao_social && `- Razão social (Receita): ${receita.razao_social}`,
    receita?.cnae_principal && `- Atividade principal oficial (CNAE): ${receita.cnae_principal}`,
    receita?.cnaes_secundarios?.length && `- Atividades secundárias: ${receita.cnaes_secundarios.slice(0, 6).join('; ')}`,
    receita?.porte && `- Porte: ${receita.porte}`,
    ref.segmento && `- Segmento cadastrado no CRM: ${ref.segmento}`,
    ref.tipo?.length && `- Relação com a nossa empresa: ${ref.tipo.join(' e ')}`,
    ref.produtos_fornecidos && `- Produtos/serviços envolvidos: ${corta(ref.produtos_fornecidos, 300)}`,
    ref.classe && `- Classe: ${ref.classe}`,
    ref.referencia && `- Referência: ${corta(ref.referencia, 200)}`,
    ref.website && `- Site: ${ref.website}`,
    ref.instagram && `- Instagram: ${ref.instagram}`,
    ref.cargo && `- Cargo do contato: ${ref.cargo}`,
    `- Local: ${[ref.endereco, local, ref.cep && `CEP ${ref.cep}`].filter(Boolean).join(', ')}`,
    ref.notes && `- Anotações da equipe: ${corta(ref.notes, 500)}`,
  ].filter(Boolean).join('\n');

  const exemplos = parecidosNoCrm.length
    ? `\nOutros clientes que JÁ temos com perfil parecido (servem de exemplo do cliente ideal; não os inclua): ${parecidosNoCrm.join('; ')}.`
    : '';

  const instrucoes = `Você é um pesquisador de prospecção B2B no Brasil. Responde somente com JSON válido.
Regras invioláveis:
- Só inclua empresa que você encontrou em uma página da internet NESTA pesquisa.
- "fonte" é a URL exata da página onde achou a empresa.
- Nunca invente nome, CNPJ, telefone, e-mail, endereço ou site. Campo que você não confirmou numa página = null.
- Telefone no formato (DD) XXXX-XXXX ou (DD) 9XXXX-XXXX. CNPJ no formato 00.000.000/0000-00.`;

  const angulo = ANGULOS[Math.min(rodada.numero - 1, ANGULOS.length - 1)];
  const excluir = rodada.excluir.length
    ? `\nJá encontradas nas rodadas anteriores (NÃO repita nenhuma destas): ${rodada.excluir.join('; ')}.`
    : '';

  // Sem segmento nem CNPJ o mini chutou que a Wortex era locadora (fabrica maquinas
  // pra plastico). Na 1a rodada ele confere o site do cliente; as seguintes recebem
  // o perfil ja confirmado e nao gastam pesquisa descobrindo de novo.
  const entender = rodada.perfilConfirmado
    ? `Perfil JÁ CONFIRMADO do cliente (não pesquise o cliente de novo): ${rodada.perfilConfirmado}.`
    : `Primeiro pesquise o site ou uma página do próprio cliente para confirmar o que ele faz de verdade — não deduza só pelo nome. Escreva isso em "perfil_entendido".`;

  const pedido = `Ficha do cliente de referência (cruze TODAS estas informações para entender o perfil dele):
${ficha}${exemplos}

${entender}
Depois encontre ${rodada.quantas} empresas REAIS com o MESMO perfil — mesma atividade, mesmo tipo de produto — em ${local} ou em cidades vizinhas até ${RAIO_KM} km.
PORTE: só empresas de MÉDIO ou GRANDE porte, mesmo que o cliente de referência seja pequeno. Procure indústrias, fabricantes, distribuidores e atacadistas com estrutura própria (fábrica, vários funcionários, filiais, marca conhecida no setor). Na Receita Federal elas aparecem com porte "Demais" (faturamento acima de R$ 4,8 milhões por ano).
NÃO inclua: microempresa, MEI, oficina, tornearia, assistência técnica, loja de bairro, revenda pequena, representante comercial autônomo nem prestador de serviço individual.
Traga o CNPJ sempre que conseguir confirmar numa página: o porte de cada empresa será conferido na Receita e as pequenas serão descartadas.
Nesta rodada, pesquise ${angulo}.${excluir}
NÃO inclua o cliente de referência (${empresa}) nem empresas do mesmo grupo dele.
Cada dado de uma empresa tem que vir de uma página sobre AQUELA empresa — não misture endereço, telefone ou e-mail de empresas diferentes.
Dê a cada empresa uma "nota" de 0 a 10 (quanto ela se parece com o cliente de referência, quanto maior ela é e quão fácil é contatar) e um "motivo" curto.
Em "porte_indicio" escreva em poucas palavras o que você viu de tamanho (ex.: "fábrica de 20 mil m², 300 funcionários", "3 filiais").
Se não achar ${rodada.quantas}, devolva as que achou — nunca complete com empresa inventada.

Para cada empresa traga todos os dados que conseguir confirmar: nome fantasia, razão social, CNPJ, o que a empresa faz, telefone, WhatsApp, e-mail, site, Instagram, endereço (rua e número), bairro, cidade, UF, CEP e a fonte.

Responda SOMENTE com este JSON, sem texto antes ou depois:
{"perfil_entendido":"","empresas":[{"nome":"","nota":0,"motivo":"","porte_indicio":null,"razao_social":null,"cnpj":null,"segmento":"","descricao":null,"telefone":null,"whatsapp":null,"email":null,"site":null,"instagram":null,"endereco":null,"bairro":null,"cidade":null,"estado":null,"cep":null,"fonte":""}]}`;

  return { instrucoes, pedido };
}

function host(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

const texto = (v: unknown) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim() : null);

// Le a resposta final da OpenAI (Responses API) e devolve so o que da pra confiar.
const chaveEmpresa = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(ltda|me|epp|eireli|s\.?a|cia|comercio|industria|e|de|da|do|dos|das)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

export function lerResposta(resp: any, referencia?: string, jaVistas: string[] = []) {
  const saida: any[] = Array.isArray(resp?.output) ? resp.output : [];
  const pesquisas = saida.filter((o) => o?.type === 'web_search_call');

  // paginas que a pesquisa realmente abriu ou citou
  const comprovados = new Set<string>();
  for (const p of pesquisas) {
    for (const s of p?.action?.sources || []) {
      const h = host(s?.url);
      if (h) comprovados.add(h);
    }
  }
  let bruto = '';
  for (const o of saida) {
    if (o?.type !== 'message') continue;
    for (const c of o.content || []) {
      if (typeof c?.text === 'string') bruto += c.text;
      for (const a of c?.annotations || []) {
        const h = host(a?.url);
        if (h) comprovados.add(h);
      }
    }
  }

  let json: any = null;
  const ini = bruto.indexOf('{');
  const fim = bruto.lastIndexOf('}');
  if (ini >= 0 && fim > ini) {
    try { json = JSON.parse(bruto.slice(ini, fim + 1)); } catch { json = null; }
  }

  const lidas: any[] = Array.isArray(json?.empresas) ? json.empresas : [];
  const empresas: EmpresaIA[] = [];
  let semFonte = 0;
  let repetidas = 0;
  const vistas = new Set<string>(jaVistas.map(chaveEmpresa));
  // o pedido diz pra excluir o cliente de referencia, mas no teste ele voltou na lista
  const ref = referencia ? chaveEmpresa(referencia).slice(0, 12) : '';
  for (const e of lidas) {
    const nome = texto(e?.nome);
    const fonte = texto(e?.fonte);
    if (!nome || !fonte) { semFonte++; continue; }
    // fonte que a pesquisa nunca abriu = provavel invencao
    if (comprovados.size > 0 && !comprovados.has(host(fonte) || '')) { semFonte++; continue; }
    const cnpj = texto(e.cnpj)?.replace(/\D/g, '') || '';
    const k = chaveEmpresa(nome);
    const site = host(texto(e.site)) || '';
    // "Wefem" e "Wefem Industria e Comercio... (Wefem Extrusoras)" vieram como duas no
    // teste: nome que contem outro ja visto (5+ letras) conta como a mesma empresa
    const contem = [...vistas].some((v) => v.length >= 5 && !/^\d+$/.test(v) && !v.includes('.') && (k.includes(v) || v.includes(k)));
    if ((ref.length >= 5 && k.includes(ref)) || vistas.has(k) || contem
        || (cnpj && vistas.has(cnpj)) || (site && vistas.has(site))) { repetidas++; continue; }
    vistas.add(k);
    if (cnpj) vistas.add(cnpj);
    if (site) vistas.add(site);
    empresas.push({
      osmId: `ia/${empresas.length}/${nome.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)}`,
      nome,
      razao_social: texto(e.razao_social),
      cnpj: texto(e.cnpj),
      segmento: texto(e.segmento),
      descricao: texto(e.descricao),
      telefone: texto(e.telefone),
      whatsapp: texto(e.whatsapp),
      email: texto(e.email),
      site: texto(e.site),
      instagram: texto(e.instagram),
      endereco: texto(e.endereco),
      bairro: texto(e.bairro),
      cidade: texto(e.cidade),
      estado: texto(e.estado),
      cep: texto(e.cep),
      fonte,
      nota: Number.isFinite(Number(e.nota)) ? Math.max(0, Math.min(10, Number(e.nota))) : null,
      motivo: texto(e.motivo),
      porte_indicio: texto(e.porte_indicio),
      tipo: texto(e.segmento) || texto(json?.perfil_entendido) || texto(json?.segmento_pesquisado) || 'empresa',
      lat: null,
      lon: null,
    });
  }
  // a IA nem sempre respeita a ordem pedida: as melhores primeiro, corta em 12
  empresas.sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));
  empresas.splice(MAX_EMPRESAS);

  return {
    empresas,
    segmentoPesquisado: texto(json?.perfil_entendido) || texto(json?.segmento_pesquisado),
    pesquisas: pesquisas.length,
    lidas: lidas.length,
    descartadas: semFonte,
    repetidas,
    fontesComprovadas: comprovados.size,
    jsonValido: json != null,
  };
}

async function openai(caminho: string, init?: RequestInit) {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) throw new Error('Chave da OpenAI não configurada no servidor.');
  const r = await fetch(`https://api.openai.com/v1${caminho}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}`, ...(init?.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}: ${j?.error?.message || 'sem detalhe'}`);
  return j;
}

// Roda em segundo plano na OpenAI (background): a pesquisa pode passar de 1
// minuto e a funcao da Vercel morre aos 60s — foi o que derrubou o garimpo
// antigo com 504. Aqui a requisicao so dispara e a tela vai perguntando.
export async function iniciarBusca(instrucoes: string, pedido: string) {
  const r = await openai('/responses', {
    method: 'POST',
    body: JSON.stringify({
      model: MODELO,
      instructions: instrucoes,
      input: pedido,
      tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'BR' } }],
      include: ['web_search_call.action.sources'],
      // Teto de gasto POR busca (o limite diario so conta quantas buscas).
      // No teste o gpt-5 fez 17 pesquisas e 7,4 mil tokens de saida pra 12 empresas;
      // 12 pesquisas ainda chegam a 10+, e a saida com folga evita resposta cortada
      // (cortada = sem JSON = paga e nao aproveita nada).
      max_tool_calls: MAX_PESQUISAS,
      max_output_tokens: 20000,
      ...(RACIOCINA(MODELO) ? { reasoning: { effort: process.env.INDICACOES_IA_ESFORCO || 'low' } } : {}),
      background: true,
      store: true,
    }),
  });
  return { id: r.id as string, status: r.status as string };
}

export async function consultarBusca(id: string) {
  return openai(`/responses/${encodeURIComponent(id)}?include[]=web_search_call.action.sources`);
}

export async function cancelarBusca(id: string) {
  try { await openai(`/responses/${encodeURIComponent(id)}/cancel`, { method: 'POST' }); } catch { /* ja terminou */ }
}
