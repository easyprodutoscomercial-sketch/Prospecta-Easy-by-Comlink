// Consulta dados publicos de CNPJ na Receita Federal usando APIs gratuitas.
// Ordem de tentativa: BrasilAPI -> MinhaReceita (mesmo formato) -> CNPJa Open (formato proprio).
// Nenhuma exige cadastro ou chave. O fallback existe porque todas limitam requisicoes por minuto.

export interface SocioReceita {
  nome: string;
  qualificacao: string | null;
  entrada: string | null;
  faixa_etaria: string | null;
}

export interface DadosReceita {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao: string | null;
  data_situacao: string | null;
  motivo_situacao: string | null;
  data_abertura: string | null;
  porte: string | null;
  natureza_juridica: string | null;
  capital_social: number | null;
  simples: boolean | null;
  mei: boolean | null;
  matriz_filial: string | null;
  cnae_principal: string | null;
  cnaes_secundarios: string[];
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  endereco_completo: string | null;
  telefone: string | null;
  telefone_2: string | null;
  email: string | null;
  socios: SocioReceita[];
  fonte: string;
  consultado_em: string;
}

const UM_DIA = 60 * 60 * 24;

export function limparCnpj(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, '');
  return digitos.length === 14 ? digitos : null;
}

export function formatarCnpj(digitos: string): string {
  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarCep(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const d = String(valor).replace(/\D/g, '');
  return d.length === 8 ? d.replace(/^(\d{5})(\d{3})$/, '$1-$2') : (valor || null);
}

function formatarTelefone(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const d = String(valor).replace(/\D/g, '');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  return d || null;
}

function montarEndereco(p: Partial<DadosReceita>): string | null {
  const rua = [p.logradouro, p.numero].filter(Boolean).join(', ');
  const partes = [rua, p.complemento, p.bairro].filter((x) => x && String(x).trim() !== '');
  return partes.length ? partes.join(' - ') : null;
}

// BrasilAPI e MinhaReceita devolvem exatamente o mesmo formato
function normalizarPadraoReceita(d: any, fonte: string): DadosReceita {
  const base = {
    logradouro: d.logradouro || null,
    numero: d.numero || null,
    complemento: d.complemento || null,
    bairro: d.bairro || null,
  };
  return {
    cnpj: String(d.cnpj || '').replace(/\D/g, ''),
    razao_social: d.razao_social || null,
    nome_fantasia: d.nome_fantasia || null,
    situacao: d.descricao_situacao_cadastral || null,
    data_situacao: d.data_situacao_cadastral || null,
    motivo_situacao: d.descricao_motivo_situacao_cadastral || null,
    data_abertura: d.data_inicio_atividade || null,
    porte: d.porte || null,
    natureza_juridica: d.natureza_juridica || null,
    capital_social: typeof d.capital_social === 'number' ? d.capital_social : null,
    simples: typeof d.opcao_pelo_simples === 'boolean' ? d.opcao_pelo_simples : null,
    mei: typeof d.opcao_pelo_mei === 'boolean' ? d.opcao_pelo_mei : null,
    matriz_filial: d.descricao_identificador_matriz_filial || null,
    cnae_principal: d.cnae_fiscal_descricao || null,
    cnaes_secundarios: Array.isArray(d.cnaes_secundarios)
      ? d.cnaes_secundarios.map((c: any) => c.descricao).filter(Boolean).slice(0, 10)
      : [],
    ...base,
    municipio: d.municipio || null,
    uf: d.uf || null,
    cep: formatarCep(d.cep),
    endereco_completo: montarEndereco({ ...base }),
    telefone: formatarTelefone(d.ddd_telefone_1),
    telefone_2: formatarTelefone(d.ddd_telefone_2),
    email: d.email || null,
    socios: Array.isArray(d.qsa)
      ? d.qsa.map((s: any) => ({
          nome: s.nome_socio || '',
          qualificacao: s.qualificacao_socio || null,
          entrada: s.data_entrada_sociedade || null,
          faixa_etaria: s.faixa_etaria || null,
        })).filter((s: SocioReceita) => s.nome)
      : [],
    fonte,
    consultado_em: new Date().toISOString(),
  };
}

// CNPJa Open usa um formato proprio
function normalizarCnpja(d: any): DadosReceita {
  const end = d.address || {};
  const base = {
    logradouro: end.street || null,
    numero: end.number || null,
    complemento: end.details || null,
    bairro: end.district || null,
  };
  return {
    cnpj: String(d.taxId || '').replace(/\D/g, ''),
    razao_social: d.company?.name || null,
    nome_fantasia: d.alias || null,
    situacao: d.status?.text || null,
    data_situacao: d.statusDate || null,
    motivo_situacao: d.reason?.text || null,
    data_abertura: d.founded || null,
    porte: d.company?.size?.text || null,
    natureza_juridica: d.company?.nature?.text || null,
    capital_social: typeof d.company?.equity === 'number' ? d.company.equity : null,
    simples: d.company?.simples?.optant ?? null,
    mei: d.company?.simei?.optant ?? null,
    matriz_filial: d.head ? 'Matriz' : 'Filial',
    cnae_principal: d.mainActivity?.text || null,
    cnaes_secundarios: Array.isArray(d.sideActivities)
      ? d.sideActivities.map((a: any) => a.text).filter(Boolean).slice(0, 10)
      : [],
    ...base,
    municipio: end.city || null,
    uf: end.state || null,
    cep: formatarCep(end.zip),
    endereco_completo: montarEndereco({ ...base }),
    telefone: Array.isArray(d.phones) && d.phones[0] ? formatarTelefone(`${d.phones[0].area}${d.phones[0].number}`) : null,
    telefone_2: Array.isArray(d.phones) && d.phones[1] ? formatarTelefone(`${d.phones[1].area}${d.phones[1].number}`) : null,
    email: Array.isArray(d.emails) && d.emails[0] ? d.emails[0].address : null,
    socios: Array.isArray(d.company?.members)
      ? d.company.members.map((m: any) => ({
          nome: m.person?.name || '',
          qualificacao: m.role?.text || null,
          entrada: m.since || null,
          faixa_etaria: m.person?.age || null,
        })).filter((s: SocioReceita) => s.nome)
      : [],
    fonte: 'CNPJa Open',
    consultado_em: new Date().toISOString(),
  };
}

const FONTES = [
  { nome: 'BrasilAPI', url: (c: string) => `https://brasilapi.com.br/api/cnpj/v1/${c}`, mapear: (d: any) => normalizarPadraoReceita(d, 'BrasilAPI') },
  { nome: 'MinhaReceita', url: (c: string) => `https://minhareceita.org/${c}`, mapear: (d: any) => normalizarPadraoReceita(d, 'MinhaReceita') },
  { nome: 'CNPJa Open', url: (c: string) => `https://open.cnpja.com/office/${c}`, mapear: normalizarCnpja },
];

export class CnpjNaoEncontrado extends Error {}

// Tenta cada fonte em ordem. Resposta fica em cache por 24h (dado da Receita muda pouco).
export async function buscarDadosReceita(cnpjBruto: string): Promise<DadosReceita> {
  const cnpj = limparCnpj(cnpjBruto);
  if (!cnpj) throw new CnpjNaoEncontrado('CNPJ invalido');

  const erros: string[] = [];
  for (const fonte of FONTES) {
    try {
      const resp = await fetch(fonte.url(cnpj), {
        headers: { Accept: 'application/json', 'User-Agent': 'ControleiCRM/1.0 (+contato via Comlink)' },
        next: { revalidate: UM_DIA },
        signal: AbortSignal.timeout(12000),
      });
      if (resp.status === 404) throw new CnpjNaoEncontrado('CNPJ nao encontrado na Receita Federal');
      if (!resp.ok) { erros.push(`${fonte.nome}: HTTP ${resp.status}`); continue; }
      return fonte.mapear(await resp.json());
    } catch (e) {
      if (e instanceof CnpjNaoEncontrado) throw e;
      erros.push(`${fonte.nome}: ${e instanceof Error ? e.message : 'falhou'}`);
    }
  }
  throw new Error(`Nenhuma fonte respondeu. ${erros.join(' | ')}`);
}

// Valida os dois digitos verificadores do CNPJ, pra nao gastar consulta com numero digitado errado.
export function cnpjValido(valor: string | null | undefined): boolean {
  const c = (valor || '').replace(/\D/g, '');
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false; // 00000000000000, 11111111111111, etc.

  const digito = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = digito(c.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(c.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(c[12]) && d2 === Number(c[13]);
}
