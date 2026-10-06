// IA que le o relatorio diario do vendedor e devolve UMA linha por empresa.
//
// Os 4 relatorios de 05/10/2026 tinham 4 formatos diferentes (lista com
// marcadores, empresa em MAIUSCULAS + "— Contato:", "Proximo passo:", texto
// corrido). Regra fixa nao daria conta; a IA so EXTRAI, quem compara com o
// CRM e codigo fixo (lib/conferencia/casar.ts), pra nunca acusar vendedor
// por "achismo" do modelo.

import { custoEmReais } from '@/lib/indicacoes/ia';
import type { LinhaRelatorio } from './casar';

export const MODELO_CONFERENCIA = process.env.CONFERENCIA_IA_MODELO || 'gpt-5-mini';
export const MAX_CARACTERES = 40000;

const CANAIS = ['ligacao', 'whatsapp', 'email', 'reuniao', 'linkedin', 'outro'] as const;
const RESULTADOS = [
  'sem_contato', 'falou', 'pediu_apresentacao', 'reuniao_marcada', 'reuniao_realizada', 'sem_interesse', 'retornar', 'outro',
] as const;

const texto = { type: ['string', 'null'] };
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['empresas'],
  properties: {
    empresas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['empresa', 'pessoa', 'canal', 'resultado', 'resumo', 'proximo_passo', 'data_proximo_passo', 'reuniao_em'],
        properties: {
          empresa: { type: 'string' },
          pessoa: texto,
          canal: { type: 'string', enum: CANAIS },
          resultado: { type: 'string', enum: RESULTADOS },
          resumo: { type: 'string' },
          proximo_passo: texto,
          data_proximo_passo: texto,
          reuniao_em: texto,
        },
      },
    },
  },
};

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function instrucoes(dia: string) {
  const d = new Date(`${dia}T12:00:00Z`);
  const [a, m, dd] = dia.split('-');
  return `Você lê o relatório diário de um vendedor B2B (ele vende o Easy, plataforma de compras) e extrai o que ele diz ter feito.
O relatório é do dia ${dd}/${m}/${a} (${DIAS[d.getUTCDay()]}).

Regras:
- UMA linha por empresa citada, na ordem do texto. Inclua TODAS, até as tentativas sem sucesso. Não junte empresas diferentes nem repita a mesma.
- Não liste a própria Easy/Comlink, nem o parágrafo de resumo final como se fosse empresa.
- "empresa": o nome como está no texto, sem o nome da pessoa (ex.: "AÇOS PUMA LTDA – Edvando / Proprietário" vira "AÇOS PUMA LTDA").
- "pessoa": quem decide/compra citado (ou com quem falou); null se não houver.
- "canal": por onde foi o contato principal.
- "resultado":
  sem_contato = não conseguiu falar com ninguém útil (não atendeu, caixa postal, número inválido, responsável ausente);
  falou = falou com alguém, sem um dos resultados abaixo;
  pediu_apresentacao = pediram material/apresentação por e-mail ou WhatsApp;
  reuniao_marcada = reunião agendada com data;
  reuniao_realizada = a reunião/apresentação aconteceu;
  sem_interesse = recusou ou não vai continuar;
  retornar = combinou de ligar de novo em outro momento;
  outro = nenhum dos anteriores.
- "resumo": no máximo 140 caracteres, em português, só o fato.
- "proximo_passo": o próximo passo prometido, curto; null se não houver.
- "data_proximo_passo": AAAA-MM-DD só se o texto der um dia (calcule "amanhã", "quarta-feira", "dia 08/10" a partir do dia do relatório; "próxima semana" = segunda-feira seguinte). null se não der dia.
- "reuniao_em": AAAA-MM-DDTHH:MM da reunião marcada (use 00:00 se não houver hora); null se não houver reunião marcada.
- Não invente nada que não esteja no texto.`;
}

export interface Extracao {
  linhas: LinhaRelatorio[];
  custo_reais: number;
  modelo: string;
}

export async function extrairRelatorio(textoEmail: string, dia: string, assunto: string): Promise<Extracao> {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) throw new Error('Chave da OpenAI não configurada no servidor.');

  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: MODELO_CONFERENCIA,
      instructions: instrucoes(dia),
      input: `Assunto: ${assunto}\n\n${textoEmail.slice(0, MAX_CARACTERES)}`,
      text: { format: { type: 'json_schema', name: 'relatorio', schema: ESQUEMA, strict: true } },
      ...(/^(gpt-5|o\d)/.test(MODELO_CONFERENCIA) ? { reasoning: { effort: process.env.CONFERENCIA_IA_ESFORCO || 'minimal' } } : {}),
      max_output_tokens: 16000,
      store: false,
    }),
    // a funcao da Vercel morre aos 60s
    signal: AbortSignal.timeout(55000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}: ${j?.error?.message || 'sem detalhe'}`);
  if (j?.status === 'incomplete') throw new Error('A IA não terminou de ler o e-mail (resposta cortada). Tente de novo.');

  let bruto = '';
  for (const o of Array.isArray(j?.output) ? j.output : []) {
    if (o?.type !== 'message') continue;
    for (const c of o.content || []) if (typeof c?.text === 'string') bruto += c.text;
  }
  let json: { empresas?: LinhaRelatorio[] } | null = null;
  try { json = JSON.parse(bruto); } catch { json = null; }
  if (!json || !Array.isArray(json.empresas)) throw new Error('A IA devolveu uma resposta que não deu pra ler. Tente de novo.');

  const dataValida = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s : null);
  const linhas = json.empresas
    .filter((e) => e && typeof e.empresa === 'string' && e.empresa.trim())
    .map((e) => ({
      empresa: e.empresa.trim(),
      pessoa: e.pessoa?.trim() || null,
      canal: e.canal,
      resultado: e.resultado,
      resumo: (e.resumo || '').trim(),
      proximo_passo: e.proximo_passo?.trim() || null,
      data_proximo_passo: dataValida(e.data_proximo_passo),
      reuniao_em: dataValida(e.reuniao_em),
    }));

  return { linhas, custo_reais: custoEmReais(j?.usage, 0, MODELO_CONFERENCIA), modelo: MODELO_CONFERENCIA };
}
