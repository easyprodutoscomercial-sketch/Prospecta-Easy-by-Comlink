// Conferencia: compara o que o vendedor DISSE no e-mail com o que esta no CRM.
//
// Codigo fixo, sem IA, de proposito: e daqui que sai "nao registrou", entao
// na duvida o resultado e "varias fichas"/"provavel", nunca uma acusacao.
// Sem import em tempo de execucao: o teste roda direto no Node.
//
// Casos reais que guiaram as regras (05/10/2026):
// - "Zilquímica" no e-mail x "ZILQUIMICA PRODUTOS P/ LABORATORIOS LTDA" no CRM;
// - "SOPRANO MATRIZ E CENTRO DE DISTRIBUIÇÃO SUL" x "SOPRANO INDUSTRIA
//   ELETROMETALURGICA LTDA": so bate a marca, mas o vendedor lancou a ligacao
//   la, entao e a mesma;
// - "Suprir" existe 4 vezes na base e "Centerval" 2: sem lancamento do
//   vendedor nao da pra saber qual e.

export type Canal = 'ligacao' | 'whatsapp' | 'email' | 'reuniao' | 'linkedin' | 'outro';
export type Resultado =
  | 'sem_contato' | 'falou' | 'pediu_apresentacao' | 'reuniao_marcada' | 'reuniao_realizada' | 'sem_interesse' | 'retornar' | 'outro';

export interface LinhaRelatorio {
  empresa: string;
  pessoa: string | null;
  canal: Canal;
  resultado: Resultado;
  resumo: string;
  proximo_passo: string | null;
  data_proximo_passo: string | null; // AAAA-MM-DD
  reuniao_em: string | null; // AAAA-MM-DDTHH:MM
}

export interface ContatoCRM {
  id: string;
  name: string;
  company: string | null;
  status: string | null;
  assigned_to_user_id: string | null;
  proxima_acao_tipo: string | null;
  proxima_acao_data: string | null;
}

export interface InteracaoCRM {
  id: string;
  contact_id: string;
  type: string;
  outcome: string | null;
  happened_at: string;
  note: string | null;
}

export interface ReuniaoCRM {
  contact_id: string;
  meeting_at: string;
  status: string | null;
}

export type Situacao = 'registrado' | 'nao_registrado' | 'varias_fichas' | 'provavel' | 'nao_achado';
export type Alerta = 'reuniao_fora_agenda' | 'proximo_passo_sem_data' | 'resultado_diferente';

export interface FichaResumo {
  id: string;
  nome: string;
  status: string | null;
  proxima_acao_tipo: string | null;
  proxima_acao_data: string | null;
}

export interface LinhaConferida extends LinhaRelatorio {
  situacao: Situacao;
  alertas: Alerta[];
  detalhe_alerta: string | null;
  contato: FichaResumo | null;
  candidatos: FichaResumo[];
  interacoes: Omit<InteracaoCRM, 'contact_id'>[];
  reunioes: ReuniaoCRM[];
}

export interface NaoCitado {
  contato: FichaResumo;
  interacoes: Omit<InteracaoCRM, 'contact_id'>[];
}

export interface Placar {
  empresas: number;
  registradas: number;
  pct: number;
  nao_registradas: number;
  duvida: number; // varias fichas, provavel ou nao achada
  reunioes_marcadas: number;
  reunioes_fora_agenda: number;
  pediu_apresentacao: number;
  sem_interesse: number;
  sem_contato: number;
  nao_citados: number;
}

// ---------- nomes ----------

const PALAVRAS_VAZIAS = new Set([
  'ltda', 'eireli', 'me', 'epp', 'sa', 'cia', 'companhia', 'ind', 'indl', 'industria', 'industrias', 'industrial',
  'industriais', 'com', 'coml', 'comercio', 'comercial', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'the',
  'matriz', 'filial', 'fabrica', 'grupo', 'contato', 'recontato',
]);

export function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function palavras(s: string | null | undefined): string[] {
  if (!s) return [];
  const vistas = new Set<string>();
  for (const p of semAcento(s).replace(/[^a-z0-9]+/g, ' ').split(' ')) {
    if (p.length >= 2 && !PALAVRAS_VAZIAS.has(p)) vistas.add(p);
  }
  return Array.from(vistas);
}

interface Entrada {
  contato: ContatoCRM;
  nomes: string[][]; // palavras do name e do company, separados
}

export interface Indice {
  entradas: Entrada[];
  porPalavra: Map<string, number[]>;
  peso: (p: string) => number;
}

export function criarIndice(contatos: ContatoCRM[]): Indice {
  const entradas: Entrada[] = [];
  const porPalavra = new Map<string, number[]>();
  for (const c of contatos) {
    const nomes = [palavras(c.name), palavras(c.company)].filter((n) => n.length > 0);
    const i = entradas.push({ contato: c, nomes }) - 1;
    const todas = new Set<string>();
    nomes.forEach((n) => n.forEach((p) => todas.add(p)));
    todas.forEach((p) => {
      const l = porPalavra.get(p);
      if (l) l.push(i);
      else porPalavra.set(p, [i]);
    });
  }
  const total = entradas.length;
  // palavra rara pesa mais: "puma" decide, "acos" quase nao
  const peso = (p: string) => Math.log((total + 1) / ((porPalavra.get(p)?.length || 0) + 0.5));
  return { entradas, porPalavra, peso };
}

// nota: quanto os nomes se parecem (pelo menor deles);
// cobertura: quanto do nome ESCRITO NO E-MAIL foi achado na ficha
function nota(a: string[], b: string[], peso: (p: string) => number): { nota: number; cobertura: number } {
  if (!a.length || !b.length) return { nota: 0, cobertura: 0 };
  const sb = new Set(b);
  let comum = 0;
  let pa = 0;
  let pb = 0;
  a.forEach((p) => { pa += peso(p); if (sb.has(p)) comum += peso(p); });
  b.forEach((p) => { pb += peso(p); });
  const menor = Math.min(pa, pb);
  return { nota: menor > 0 ? comum / menor : 0, cobertura: pa > 0 ? comum / pa : 0 };
}

export interface Candidato {
  contato: ContatoCRM;
  nota: number;
  cobertura: number;
}

export function candidatos(indice: Indice, empresa: string): Candidato[] {
  const a = palavras(empresa);
  if (!a.length) return [];
  // a palavra mais rara do nome (a marca) TEM que bater: sem isso "AÇOS
  // CONTINENTAL" casava com "ACOS PUMA" so pelo "acos" (teste real de 05/10)
  // (palavra que nao existe em ficha nenhuma nao serve de marca: "distribuição")
  const existentes = a.filter((p) => indice.porPalavra.has(p));
  if (!existentes.length) return [];
  const maior = Math.max(...existentes.map(indice.peso));
  const marca = existentes.filter((p) => indice.peso(p) >= maior - 1e-9);
  const vistos = new Set<number>();
  marca.forEach((p) => (indice.porPalavra.get(p) || []).forEach((i) => vistos.add(i)));
  const lista: Candidato[] = [];
  vistos.forEach((i) => {
    const e = indice.entradas[i];
    const nomes = e.nomes.filter((nm) => marca.some((p) => nm.includes(p)));
    const melhor = nomes.map((nm) => nota(a, nm, indice.peso)).sort((x, y) => y.nota - x.nota)[0];
    if (melhor && melhor.nota >= 0.3) lista.push({ contato: e.contato, ...melhor });
  });
  return lista.sort((x, y) => y.nota - x.nota);
}

// ---------- conferencia ----------

const CERTA = 0.75;
const PROVAVEL = 0.4;
// sem lancamento, a ficha tem que cobrir pelo menos metade do nome do e-mail:
// "ACQUA MONTAGENS" fora da base nao vira "provavel" de qualquer "Montagens X"
const COBRE = 0.5;
const COBRE_COM_LANCAMENTO = 0.25;

const diaSP = (iso: string) => new Date(new Date(iso).getTime() - 3 * 36e5).toISOString().slice(0, 10);

function somaDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function ficha(c: ContatoCRM): FichaResumo {
  const nome = c.company && semAcento(c.company) !== semAcento(c.name) ? `${c.name} (${c.company})` : c.name;
  return { id: c.id, nome, status: c.status, proxima_acao_tipo: c.proxima_acao_tipo, proxima_acao_data: c.proxima_acao_data };
}

// so resultado concreto: "falou" fica de fora porque a IA chamou de "falou" o
// "Lincon esta em viagem" da Acopumps (05/10), e ai a acusacao seria injusta
const FALOU: Resultado[] = ['pediu_apresentacao', 'reuniao_marcada', 'reuniao_realizada', 'sem_interesse'];
const ETAPAS_REUNIAO = ['REUNIAO_MARCADA', 'CONVERTIDO'];

export interface DadosConferencia {
  dia: string; // AAAA-MM-DD do relatorio
  vendedorId: string;
  linhas: LinhaRelatorio[];
  indice: Indice;
  // interacoes do vendedor na janela (dia do relatorio ate o dia seguinte 12h)
  interacoes: InteracaoCRM[];
  reunioes: ReuniaoCRM[];
}

export function conferir(d: DadosConferencia): { linhas: LinhaConferida[]; nao_citados: NaoCitado[]; placar: Placar } {
  const porContato = new Map<string, InteracaoCRM[]>();
  d.interacoes.forEach((i) => {
    const l = porContato.get(i.contact_id);
    if (l) l.push(i);
    else porContato.set(i.contact_id, [i]);
  });
  const reunioesDe = (ids: string[]) => d.reunioes.filter((r) => ids.includes(r.contact_id) && r.status !== 'CANCELLED');
  const semContato = (i: InteracaoCRM) => ({ id: i.id, type: i.type, outcome: i.outcome, happened_at: i.happened_at, note: i.note });
  const citados = new Set<string>();

  const linhas: LinhaConferida[] = d.linhas.map((l) => {
    const cands = candidatos(d.indice, l.empresa);
    let escolhido: ContatoCRM | null = null;
    let situacao: Situacao;
    let lista: ContatoCRM[] = [];

    // 1) a prova mais forte: o vendedor lancou interacao numa ficha parecida
    // (parecida de verdade: "Aços Continental" fora da base nao vira a "Aços Puma" lancada)
    const comLancamento = cands.filter((c) => c.nota >= PROVAVEL && c.cobertura >= COBRE_COM_LANCAMENTO && porContato.has(c.contato.id));
    if (comLancamento.length) {
      escolhido = comLancamento[0].contato;
      situacao = 'registrado';
    } else {
      const validos = cands.filter((c) => c.cobertura >= COBRE);
      const fortes = validos.filter((c) => c.nota >= CERTA && c.nota >= validos[0].nota - 0.01);
      const doVendedor = fortes.filter((c) => c.contato.assigned_to_user_id === d.vendedorId);
      if (fortes.length === 1 || doVendedor.length === 1) {
        escolhido = (doVendedor.length === 1 ? doVendedor[0] : fortes[0]).contato;
        situacao = 'nao_registrado';
      } else if (fortes.length > 1) {
        situacao = 'varias_fichas';
        lista = fortes.map((c) => c.contato);
      } else if (validos.length && validos[0].nota >= PROVAVEL) {
        situacao = 'provavel';
        lista = validos.slice(0, 3).filter((c) => c.nota >= PROVAVEL).map((c) => c.contato);
      } else {
        situacao = 'nao_achado';
      }
    }

    const ids = escolhido ? [escolhido.id] : lista.map((c) => c.id);
    ids.forEach((id) => citados.add(id));
    const interacoes = escolhido ? (porContato.get(escolhido.id) || []).map(semContato) : [];
    const reunioes = reunioesDe(ids);
    const fichas = escolhido ? [escolhido] : lista;

    const alertas: Alerta[] = [];
    const detalhes: string[] = [];

    // reuniao prometida precisa estar na agenda (meetings), na data dita
    if (l.resultado === 'reuniao_marcada' || l.reuniao_em) {
      const alvo = l.reuniao_em ? l.reuniao_em.slice(0, 10) : null;
      const naAgenda = reunioes.some((r) => {
        const dr = diaSP(r.meeting_at);
        return alvo ? dr >= somaDias(alvo, -1) && dr <= somaDias(alvo, 1) : dr >= d.dia;
      });
      if (!naAgenda) {
        alertas.push('reuniao_fora_agenda');
        detalhes.push(alvo ? `Reunião de ${alvo.split('-').reverse().join('/')} não está na agenda` : 'Reunião não está na agenda');
      }
    }

    // proximo passo com dia precisa virar proxima acao com data
    if (l.data_proximo_passo && l.resultado !== 'sem_interesse' && fichas.length) {
      const temData = fichas.some((c) => c.proxima_acao_data && c.proxima_acao_data.slice(0, 10) >= d.dia);
      if (!temData) {
        alertas.push('proximo_passo_sem_data');
        detalhes.push(`Próximo passo ${l.data_proximo_passo.split('-').reverse().join('/')} sem data no CRM`);
      }
    }

    // o e-mail diz que falou, o CRM diz que ninguem atendeu (ou nao andou a etapa)
    if (situacao === 'registrado' && escolhido) {
      if (FALOU.includes(l.resultado) && interacoes.length && interacoes.every((i) => i.outcome === 'SEM_RESPOSTA')) {
        alertas.push('resultado_diferente');
        detalhes.push('E-mail diz que falou; no CRM está "sem resposta"');
      } else if (
        l.resultado === 'reuniao_marcada' &&
        !interacoes.some((i) => i.outcome === 'REUNIAO_MARCADA') &&
        !ETAPAS_REUNIAO.includes(escolhido.status || '')
      ) {
        alertas.push('resultado_diferente');
        detalhes.push(`E-mail diz reunião marcada; no CRM está em ${escolhido.status || 'sem etapa'}`);
      }
    }

    return {
      ...l,
      situacao,
      alertas,
      detalhe_alerta: detalhes.length ? detalhes.join(' · ') : null,
      contato: escolhido ? ficha(escolhido) : null,
      candidatos: lista.map(ficha),
      interacoes,
      reunioes,
    };
  });

  // caminho inverso: lancou no CRM no dia do relatorio e nao citou no e-mail
  // (so o dia em si: o que ele lancou na manha seguinte e trabalho do outro dia)
  const fichaPorId = new Map<string, ContatoCRM>();
  d.indice.entradas.forEach((e) => fichaPorId.set(e.contato.id, e.contato));
  const nao_citados: NaoCitado[] = [];
  porContato.forEach((ints, contactId) => {
    if (citados.has(contactId)) return;
    const doDia = ints.filter((i) => diaSP(i.happened_at) === d.dia);
    const c = fichaPorId.get(contactId);
    if (!doDia.length || !c) return;
    nao_citados.push({ contato: ficha(c), interacoes: doDia.map(semContato) });
  });

  const conta = (f: (l: LinhaConferida) => boolean) => linhas.filter(f).length;
  const registradas = conta((l) => l.situacao === 'registrado');
  const placar: Placar = {
    empresas: linhas.length,
    registradas,
    pct: linhas.length ? Math.round((registradas / linhas.length) * 100) : 0,
    nao_registradas: conta((l) => l.situacao === 'nao_registrado'),
    duvida: conta((l) => l.situacao === 'varias_fichas' || l.situacao === 'provavel' || l.situacao === 'nao_achado'),
    reunioes_marcadas: conta((l) => l.resultado === 'reuniao_marcada'),
    reunioes_fora_agenda: conta((l) => l.alertas.includes('reuniao_fora_agenda')),
    pediu_apresentacao: conta((l) => l.resultado === 'pediu_apresentacao'),
    sem_interesse: conta((l) => l.resultado === 'sem_interesse'),
    sem_contato: conta((l) => l.resultado === 'sem_contato'),
    nao_citados: nao_citados.length,
  };

  return { linhas, nao_citados, placar };
}
