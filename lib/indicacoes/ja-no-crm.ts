import { getAdminClient } from '@/lib/supabase/admin';
import { normalizeCNPJ, normalizePhone } from '@/lib/utils/normalize';
import { chaveEmpresa, type EmpresaIA } from '@/lib/indicacoes/ia';

// Regra do dono (06/10): a IA NAO pode trazer quem ja esta no CRM — ocupava vaga
// das 12 e era pago a toa ("ja estava no CRM"). Duas travas:
// 1) antes: os nomes dos clientes da regiao vao no pedido, com ordem de nao repetir;
// 2) depois: cada empresa devolvida e conferida (CNPJ, telefone, site, nome parecido)
//    contra os contatos da regiao — inclusive rascunhos de buscas anteriores — e sai da lista.

type Admin = ReturnType<typeof getAdminClient>;

export type Conhecidos = { nomes: string[]; chaves: Set<string>; cnpjs: Set<string>; fones: Set<string>; sites: Set<string> };

const MAX_NOMES_NO_PEDIDO = 150; // ~1,5 mil tokens: centavos por rodada

function host(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

// "Fluir Automacao / Fluir Automacao Pneumatica", "Jwell Machinery (MEP Equipamentos Ltda)":
// um campo com varios nomes vira varias chaves
function chavesDoNome(nome: string | null | undefined) {
  if (!nome) return [];
  return nome.split(/\s*[/|()]\s*/).map(chaveEmpresa).filter((k) => k.length >= 4);
}

export async function carregarConhecidos(admin: Admin, orgId: string, cidade: string | null, estado: string | null): Promise<Conhecidos> {
  const vazio: Conhecidos = { nomes: [], chaves: new Set(), cnpjs: new Set(), fones: new Set(), sites: new Set() };
  if (!cidade && !estado) return vazio;
  // a cidade primeiro (o banco devolve no maximo 1000 por consulta e SP sozinho passa disso),
  // depois o estado, que cobre as cidades vizinhas (a busca vai ate 100 km)
  const campos = 'name, company, cidade, cnpj_digits, phone_normalized, whatsapp, website';
  const [daCidade, doEstado] = await Promise.all([
    cidade ? admin.from('contacts').select(campos).eq('organization_id', orgId).ilike('cidade', cidade.trim()).limit(1000) : null,
    estado ? admin.from('contacts').select(campos).eq('organization_id', orgId).ilike('estado', estado.trim()).limit(1000) : null,
  ]);
  const linhas = [...(daCidade?.data || []), ...(doEstado?.data || [])];
  const r = vazio;
  for (const c of linhas) {
    for (const nome of [c.name, c.company]) for (const k of chavesDoNome(nome)) r.chaves.add(k);
    if (c.cnpj_digits) r.cnpjs.add(c.cnpj_digits);
    for (const f of [c.phone_normalized, normalizePhone(c.whatsapp)]) if (f) r.fones.add(f);
    const h = host(c.website);
    if (h) r.sites.add(h);
    const nome = (c.company || c.name || '').trim();
    if (nome && r.nomes.length < MAX_NOMES_NO_PEDIDO && !r.nomes.includes(nome)) r.nomes.push(nome);
  }
  return r;
}

// Conferencia no CRM INTEIRO pelas palavras proprias do nome (a lista da regiao corta em
// 1000 contatos e SP passa disso: a Vibroprev ja cadastrada escapou no teste de 06/10).
const GENERICAS = new Set(['ltda', 'eireli', 'comercio', 'industria', 'industrial', 'servicos', 'solucoes', 'maquinas',
  'equipamentos', 'empresa', 'brasil', 'distribuidora', 'distribuicao', 'automacao', 'manutencao', 'tecnologia',
  'comercial', 'grupo', 'metalurgica', 'eletrica', 'eletronica', 'transportes', 'engenharia', 'sistemas', 'produtos']);
function palavraPropria(nome: string | null | undefined) {
  if (!nome) return null;
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/)
    .find((w) => w.length >= 4 && !GENERICAS.has(w)) || null;
}

export async function conhecidosPorNome(admin: Admin, orgId: string, empresas: EmpresaIA[]): Promise<Conhecidos> {
  const r: Conhecidos = { nomes: [], chaves: new Set(), cnpjs: new Set(), fones: new Set(), sites: new Set() };
  const palavras = [...new Set(empresas.flatMap((e) => [palavraPropria(e.nome), palavraPropria(e.razao_social)]).filter(Boolean))].slice(0, 20);
  if (!palavras.length) return r;
  const { data } = await admin.from('contacts').select('name, company, cnpj_digits, phone_normalized, whatsapp, website')
    .eq('organization_id', orgId).or(palavras.flatMap((w) => [`name.ilike.*${w}*`, `company.ilike.*${w}*`]).join(',')).limit(500);
  for (const c of data || []) {
    for (const nome of [c.name, c.company]) for (const k of chavesDoNome(nome)) r.chaves.add(k);
    if (c.cnpj_digits) r.cnpjs.add(c.cnpj_digits);
    for (const f of [c.phone_normalized, normalizePhone(c.whatsapp)]) if (f) r.fones.add(f);
    const h = host(c.website);
    if (h) r.sites.add(h);
  }
  return r;
}

export function juntar(a: Conhecidos, b: Conhecidos): Conhecidos {
  return {
    nomes: a.nomes,
    chaves: new Set([...a.chaves, ...b.chaves]), cnpjs: new Set([...a.cnpjs, ...b.cnpjs]),
    fones: new Set([...a.fones, ...b.fones]), sites: new Set([...a.sites, ...b.sites]),
  };
}

export function jaConhecida(e: EmpresaIA, c: Conhecidos) {
  const cnpj = normalizeCNPJ(e.cnpj);
  if (cnpj && c.cnpjs.has(cnpj)) return 'CNPJ';
  for (const f of [normalizePhone(e.telefone), normalizePhone(e.whatsapp)]) if (f && c.fones.has(f)) return 'telefone';
  const h = host(e.site);
  if (h && c.sites.has(h)) return 'site';
  for (const k of [...chavesDoNome(e.nome), ...chavesDoNome(e.razao_social)]) {
    if (c.chaves.has(k)) return 'nome';
    // "Fluir Automacao" x "Fluir Automacao Pneumatica Ltda": um nome COMECA com o outro (6+ letras).
    // So comeco, nao "contem": um contato chamado so "Automacao" barraria toda "X Automacao".
    for (const v of c.chaves) if (v.length >= 6 && k.length >= 6 && (k.startsWith(v) || v.startsWith(k))) return 'nome';
  }
  return null;
}
