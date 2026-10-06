import { buscarDadosReceita, formatarCnpj, limparCnpj, type DadosReceita } from '@/lib/receita/cnpj';

// Confere se um CNPJ achado pela IA e mesmo do cliente, contra a Receita.
// Usado pela busca de indicacoes (rodada zero) e pelo botao "Completar cadastro
// pela Receita". A IA so sugere o numero; quem decide e esta conferencia — e,
// quando o contato nao tem cidade, o vendedor na tela.

export type ClienteParaConferir = { name: string; company: string | null; cidade: string | null; estado: string | null };

export type EmpresaAchada = {
  cnpj: string; razao_social: string | null; nome_fantasia: string | null;
  cidade: string | null; uf: string | null; endereco: string | null; porte: string | null;
};

// o que a tela mostra na pergunta "e o seu cliente?"
export function resumoEmpresa(d: DadosReceita): EmpresaAchada {
  return {
    cnpj: formatarCnpj(limparCnpj(d.cnpj) as string), razao_social: d.razao_social, nome_fantasia: d.nome_fantasia,
    cidade: d.municipio, uf: d.uf, endereco: d.endereco_completo, porte: d.porte,
  };
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const PALAVRAS_GENERICAS = new Set(['ltda', 'eireli', 'comercio', 'industria', 'servicos', 'maquinas', 'equipamentos',
  'empresa', 'brasil', 'distribuidora', 'de', 'da', 'do', 'dos', 'das', 'e', 'me', 'epp', 'sa', 'cia']);

// O CNPJ que a IA achou e mesmo deste cliente? Exige a MESMA cidade na Receita e
// uma palavra propria do nome (nao "ltda", "maquinas"...) na razao social ou fantasia.
// Sem isso, gravaria CNPJ de outra empresa no cadastro do cliente.
export async function conferirCnpjDoCliente(c: ClienteParaConferir, digitos: string) {
  try {
    const d = await Promise.race([buscarDadosReceita(digitos), new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
    if (!d) return { dados: null, motivo: 'Receita não respondeu' };
    const mesmaCidade = !!d.municipio && !!c.cidade && semAcento(d.municipio).trim() === semAcento(c.cidade).trim();
    const nomeReceita = semAcento(`${d.razao_social || ''} ${d.nome_fantasia || ''}`);
    const palavras = semAcento(`${c.company || ''} ${c.name}`).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !PALAVRAS_GENERICAS.has(w));
    const nomeBate = palavras.some((w) => nomeReceita.includes(w));
    // sem cidade no cadastro nao da pra comparar: confere o estado (se tiver) e o vendedor confirma na tela
    if (c.cidade && !mesmaCidade) return { dados: null, motivo: `cidade na Receita é ${d.municipio}` };
    if (!c.cidade && c.estado && d.uf && d.uf.toUpperCase() !== c.estado.trim().toUpperCase()) {
      return { dados: null, motivo: `estado na Receita é ${d.uf}` };
    }
    if (!nomeBate) return { dados: null, motivo: `nome na Receita é ${d.razao_social}` };
    return { dados: d, motivo: null };
  } catch (e) {
    return { dados: null, motivo: e instanceof Error ? e.message.slice(0, 80) : 'falhou' };
  }
}
