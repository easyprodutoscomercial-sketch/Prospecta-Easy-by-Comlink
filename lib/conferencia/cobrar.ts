// Mensagem de cobranca do vendedor a partir da conferencia do dia (pedido do dono em 06/10).
// Codigo fixo, sem IA e sem custo: le o que a conferencia ja cruzou (e-mail x CRM) e lista
// so o que o vendedor precisa acertar. Na duvida (varias fichas, provavel) PERGUNTA, nao acusa.
// Sem import em tempo de execucao, igual casar.ts: o teste roda direto no Node.

import type { LinhaConferida, Placar } from './casar';

// o e-mail diz que nao falou com ninguem (mesmo quando o resultado veio como "retornar")
const NAO_FALOU = /n[aã]o (estava|conseguiu|atend|respond)|ningu[eé]m atend|sem contato|nenhum dos n[uú]meros|n[aã]o foi poss[ií]vel falar|caixa postal|encerrava/i;

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || nome;
const dataBR = (iso: string) => iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/');
const lista = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`);
const comPessoa = (l: LinhaConferida) => (l.pessoa ? `${l.empresa} (${l.pessoa})` : l.empresa);

function semProximoPasso(l: LinhaConferida, dia: string) {
  if (!l.contato || l.resultado === 'sem_interesse') return false;
  if (!l.proximo_passo && !l.data_proximo_passo) return false;
  const data = l.contato.proxima_acao_data;
  return !data || data.slice(0, 10) < dia;
}

export function montarCobranca(vendedorNome: string, dia: string, linhas: LinhaConferida[], placar: Placar) {
  const pontos: string[] = [];

  const agendar = linhas.filter((l) => semProximoPasso(l, dia))
    .map((l) => (l.data_proximo_passo ? `${l.empresa} (${dataBR(l.data_proximo_passo)})` : l.empresa));
  if (agendar.length) pontos.push(`Agendar no CRM o próximo passo com data: ${lista(agendar)}. Sem data o CRM não te lembra e a empresa some no funil.`);

  const naoRegistrou = linhas.filter((l) => l.situacao === 'nao_registrado').map(comPessoa);
  if (naoRegistrou.length) pontos.push(`Lançar no CRM o que você fez em: ${lista(naoRegistrou)}. Está no e-mail mas não no CRM.`);

  const foraDaBase = linhas.filter((l) => l.situacao === 'nao_achado').map(comPessoa);
  if (foraDaBase.length) pontos.push(`Cadastrar no CRM e lançar a atividade: ${lista(foraDaBase)}. Essas empresas não existem na base.`);

  for (const l of linhas.filter((x) => x.situacao === 'varias_fichas')) {
    const nomes = l.candidatos.map((c) => c.nome);
    pontos.push(`${l.empresa}: tem ${nomes.length} fichas (${lista(nomes)}). Me diz qual é a certa e lança nela.`);
  }
  for (const l of linhas.filter((x) => x.situacao === 'provavel')) {
    const nomes = l.candidatos.map((c) => c.nome);
    pontos.push(`${l.empresa}: confere se é ${nomes.length > 1 ? `uma destas fichas: ${lista(nomes)}` : `a ficha "${nomes[0] || '?'}"`} e lança nela.`);
  }

  // disse que nao falou com ninguem, mas marcou "Respondeu": infla os numeros
  const marcouErrado = linhas.filter((l) => l.situacao === 'registrado'
    && (l.resultado === 'sem_contato' || NAO_FALOU.test(l.resumo))
    && l.interacoes.some((i) => i.outcome === 'RESPONDEU')).map((l) => l.empresa);
  if (marcouErrado.length) pontos.push(`${lista(marcouErrado)}: no e-mail você não falou com a pessoa, mas no CRM marcou "Respondeu". Se não falou, é "Sem resposta".`);

  const falouNaoBate = linhas.filter((l) => l.alertas.includes('resultado_diferente') && !marcouErrado.includes(l.empresa)).map((l) => l.empresa);
  if (falouNaoBate.length) pontos.push(`${lista(falouNaoBate)}: o resultado no CRM não bate com o e-mail. Ajusta pra ficar igual.`);

  const reuniao = linhas.filter((l) => l.alertas.includes('reuniao_fora_agenda'))
    .map((l) => (l.reuniao_em ? `${l.empresa} (${dataBR(l.reuniao_em)})` : l.empresa));
  if (reuniao.length) pontos.push(`Pôr na agenda do CRM a reunião de ${lista(reuniao)}.`);

  const perdido = linhas.filter((l) => l.resultado === 'sem_interesse' && l.contato
    && !/PERDIDO|LOST/i.test(l.contato.status || '')).map((l) => l.empresa);
  if (perdido.length) pontos.push(`${lista(perdido)}: disse que não tem interesse. Passa pra Perdido com o motivo.`);

  const elogios = [
    `${placar.empresas} empresa${placar.empresas === 1 ? '' : 's'} trabalhada${placar.empresas === 1 ? '' : 's'}`,
    placar.pediu_apresentacao ? `${placar.pediu_apresentacao} pedido${placar.pediu_apresentacao > 1 ? 's' : ''} de apresentação` : '',
    placar.reunioes_marcadas ? `${placar.reunioes_marcadas} reuniã${placar.reunioes_marcadas > 1 ? 'ões' : 'o'} marcada${placar.reunioes_marcadas > 1 ? 's' : ''}` : '',
  ].filter(Boolean);

  const nome = primeiroNome(vendedorNome);
  const abertura = `${nome}, vi seu relatório de ${dataBR(dia)}: ${lista(elogios)}. Mandou bem!`;
  if (!pontos.length) return { mensagem: `${abertura} Tudo certo no CRM também (${placar.pct}% registrado). Continua assim 👊`, pontos: 0 };

  const corpo = pontos.map((p, i) => `${i + 1}. ${p}`).join('\n');
  return {
    mensagem: `${abertura}\nFicaram uns ajustes no CRM, consegue resolver até o fim do dia?\n\n${corpo}\n\nRegra daqui pra frente: o que não está no CRM, não aconteceu. 👍`,
    pontos: pontos.length,
  };
}
