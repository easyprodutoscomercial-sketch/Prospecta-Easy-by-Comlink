import { getAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail, normalizePhone } from '@/lib/utils/normalize';
import type { DadosReceita } from '@/lib/receita/cnpj';

// Preenche o cadastro do contato com os dados da Receita.
// Regra do dono: so campos VAZIOS. Nada que uma pessoa digitou e sobrescrito
// (telefone/e-mail que o vendedor conseguiu direto com o cliente valem mais).
// Usado pelo botao de CNPJ da ficha (/api/contacts/:id/receita) e pela busca de
// indicacoes com IA, que primeiro acha o CNPJ do cliente e completa o cadastro.

export const CAMPOS_PREENCHIVEIS_SELECT =
  'id, organization_id, name, cnpj, cnpj_digits, company, endereco, cidade, estado, cep, phone, email, contato_nome, cargo';

export const PREENCHIVEIS: { campo: string; rotulo: string; valor: (d: DadosReceita) => string | null }[] = [
  { campo: 'company',  rotulo: 'Empresa',  valor: (d) => d.razao_social },
  { campo: 'endereco', rotulo: 'Endereco', valor: (d) => d.endereco_completo },
  { campo: 'cidade',   rotulo: 'Cidade',   valor: (d) => d.municipio },
  { campo: 'estado',   rotulo: 'Estado',   valor: (d) => d.uf },
  { campo: 'cep',      rotulo: 'CEP',      valor: (d) => d.cep },
  { campo: 'phone',    rotulo: 'Telefone', valor: (d) => d.telefone },
  { campo: 'email',    rotulo: 'Email',    valor: (d) => d.email },
  { campo: 'contato_nome', rotulo: 'Nome do contato', valor: (d) => socioPrincipal(d)?.nome ?? null },
  { campo: 'cargo',        rotulo: 'Cargo',           valor: (d) => socioPrincipal(d)?.qualificacao ?? null },
];

export function socioPrincipal(d: DadosReceita) {
  if (!d.socios.length) return null;
  const admin = d.socios.find((s) => /administrador|presidente|diretor/i.test(s.qualificacao || ''));
  return admin || d.socios[0];
}

export function vazio(v: unknown) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

// Receita devolve a cidade em maiusculas ("SAO JOSE DO RIO PRETO"): grava legivel
function cidadeLegivel(s: string) {
  if (s !== s.toUpperCase()) return s;
  const minusculas = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return s.toLowerCase().split(' ').map((p, i) => (i > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
}

export async function preencherVazios(
  admin: ReturnType<typeof getAdminClient>,
  contato: Record<string, unknown>,
  dados: DadosReceita,
  extras: Record<string, string> = {}
): Promise<{ atualizados: string[]; erro: string | null; avisos: string[] }> {
  const mudancas: Record<string, string | null> = { ...extras };
  const atualizados: string[] = extras.cnpj ? ['CNPJ'] : [];
  for (const p of PREENCHIVEIS) {
    let novo = p.valor(dados);
    if (p.campo === 'cidade' && novo) novo = cidadeLegivel(novo);
    // cargo do socio so entra junto com o nome do socio: se o vendedor ja digitou outra
    // pessoa como contato, o cargo dela nao e "Diretor" so porque o socio e
    if (p.campo === 'cargo' && !mudancas.contato_nome) continue;
    if (!vazio(novo) && vazio(contato[p.campo])) {
      mudancas[p.campo] = String(novo);
      atualizados.push(p.rotulo);
    }
  }
  // os campos *_normalized sao a base da deduplicacao: telefone/e-mail sem eles viram duplicata invisivel
  if (mudancas.phone) mudancas.phone_normalized = normalizePhone(mudancas.phone);
  if (mudancas.email) mudancas.email_normalized = normalizeEmail(mudancas.email);
  if (!Object.keys(mudancas).length) return { atualizados, erro: null, avisos: [] };

  const gravar = (m: Record<string, string | null>) => admin.from('contacts')
    .update({ ...m, updated_at: new Date().toISOString() })
    .eq('id', contato.id as string).eq('organization_id', contato.organization_id as string);

  // CNPJ/telefone/e-mail ja usados por OUTRO contato (indices unicos): grava o resto sem eles.
  // CNPJ repetido quase sempre e o mesmo cliente cadastrado duas vezes — vira aviso.
  const UNICOS: { indice: string; campos: string[]; rotulo: string; aviso: string }[] = [
    { indice: 'idx_contacts_unique_cnpj', campos: ['cnpj', 'cnpj_digits'], rotulo: 'CNPJ', aviso: 'Esse CNPJ já está em outro contato do CRM (cliente duplicado?) — não gravei o CNPJ aqui.' },
    { indice: 'idx_contacts_unique_phone', campos: ['phone', 'phone_normalized'], rotulo: 'Telefone', aviso: 'O telefone da Receita já está em outro contato — não gravei.' },
    { indice: 'idx_contacts_unique_email', campos: ['email', 'email_normalized'], rotulo: 'Email', aviso: 'O e-mail da Receita já está em outro contato — não gravei.' },
  ];
  const avisos: string[] = [];
  let { error } = await gravar(mudancas);
  for (let tentativa = 0; error?.code === '23505' && tentativa < UNICOS.length; tentativa++) {
    const u = UNICOS.find((x) => error!.message.includes(x.indice) && x.campos.some((c) => c in mudancas));
    if (!u) break;
    for (const c of u.campos) delete mudancas[c];
    const r = atualizados.indexOf(u.rotulo);
    if (r >= 0) atualizados.splice(r, 1);
    avisos.push(u.aviso);
    ({ error } = await gravar(mudancas));
  }
  if (error) {
    console.warn('[receita preencher] falhou', contato.id, error.code, error.message);
    return { atualizados: [], erro: 'Nao consegui salvar os campos preenchidos.', avisos };
  }
  return { atualizados, erro: null, avisos };
}
