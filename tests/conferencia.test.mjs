// Testes da Conferencia de relatorios (npm test).
// Roda direto no Node (>= 23, que le TypeScript sem compilar).
//
// Os e-mails reais dos vendedores NAO entram no repositorio (ele e publico e
// os e-mails tem nomes de clientes e compradores). O ultimo bloco le os 4
// relatorios de 05/10/2026 de ~/Downloads (ou CONFERENCIA_EML_DIR) e e pulado
// quando eles nao estao la.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { lerEml, dataDoRelatorio } from '../lib/conferencia/eml.ts';
import { criarIndice, conferir, palavras } from '../lib/conferencia/casar.ts';

const CRLF = '\r\n';

test('lê e-mail do Outlook em Windows-1252 com quoted-printable e assunto quebrado', () => {
  const bruto = [
    'From: =?Windows-1252?Q?M=E1rio_S=E9rgio?= <Mario.Sergio@Exemplo.com>',
    'Subject: =?Windows-1252?Q?Atividades_realizadas_=96?=',
    ' =?Windows-1252?Q?_05/10?=',
    'Date: Tue, 6 Oct 2026 12:23:25 +0000',
    'Content-Type: multipart/alternative; boundary="XYZ"',
    '',
    '--XYZ',
    'Content-Type: text/plain; charset="Windows-1252"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    'Zilqu=EDmica: Tauane n=E3o estava. Nova tentativa na quarta-feira, ap=F3s =',
    'as 10h.',
    '[cid:abc-123]',
    '--XYZ',
    'Content-Type: text/html; charset="Windows-1252"',
    '',
    '<p>ignorado</p>',
    '--XYZ--',
  ].join(CRLF);
  const e = lerEml(bruto);
  assert.equal(e.deNome, 'Mário Sérgio');
  assert.equal(e.deEmail, 'mario.sergio@exemplo.com');
  assert.equal(e.assunto, 'Atividades realizadas – 05/10');
  assert.equal(e.enviadoEm, '2026-10-06T12:23:25.000Z');
  assert.equal(e.texto, 'Zilquímica: Tauane não estava. Nova tentativa na quarta-feira, após as 10h.');
});

test('usa o HTML quando não há texto puro', () => {
  const bruto = [
    'From: daniel@exemplo.com',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from('<div>JW</div><div>Conversei com Luciano &amp; Rafael</div>').toString('base64'),
  ].join(CRLF);
  const e = lerEml(bruto);
  assert.equal(e.deEmail, 'daniel@exemplo.com');
  assert.equal(e.texto, 'JW\nConversei com Luciano & Rafael');
});

test('dia do relatório: assunto vence a data de envio', () => {
  assert.equal(dataDoRelatorio('Atividades realizadas – 05/10', '', '2026-10-06T12:23:25Z'), '2026-10-05');
  assert.equal(dataDoRelatorio('Relatório (05_10_2026)', '', null), '2026-10-05');
  assert.equal(dataDoRelatorio('Relatório', 'resumo de hoje, 05/10:', '2026-10-05T20:00:00Z'), '2026-10-05');
  assert.equal(dataDoRelatorio('Relatório', 'sem data', '2026-10-06T01:00:00Z'), '2026-10-05'); // 22h em SP
  assert.equal(dataDoRelatorio('Prospecções 30/12', '', '2027-01-02T12:00:00Z'), '2026-12-30');
});

test('nome de empresa sem acento, sem LTDA/IND/COM', () => {
  assert.deepEqual(palavras("D'ANTONIO EQUIPAMENTOS MECÂNICOS INDUSTRIAIS LTDA"), ['antonio', 'equipamentos', 'mecanicos']);
  assert.deepEqual(palavras('AGROMETAL IND E COM DE PEÇAS LTDA'), ['agrometal', 'pecas']);
});

// base de mentira com os casos dificeis de 05/10
const VENDEDOR = 'v1';
const contato = (id, name, company = null, extra = {}) => ({
  id, name, company, status: 'CONTATADO', assigned_to_user_id: null, proxima_acao_tipo: null, proxima_acao_data: null, ...extra,
});
const CONTATOS = [
  contato('zil', 'ZILQUIMICA PRODUTOS P/ LABORATORIOS LTDA'),
  contato('puma', 'ACOS PUMA LTDA'),
  contato('cont', 'Fabiano', 'Continental'),
  contato('sop', 'SOPRANO INDUSTRIA ELETROMETALURGICA LTDA'),
  contato('sup1', 'Suprir'),
  contato('sup2', 'SUPRIR'),
  contato('sup3', 'SUPRIR INDUSTRIA DE METAIS LTDA'),
  contato('zap', 'JOSE', 'ZAP MONTAGEM INDUSTRIAL E SERVIÇOS LTDA'),
  contato('eng', 'EngePress Automação e Controle'),
  contato('aco', 'ACOPUMPS - ACOPLAMENTOS E BOMBAS INDUSTR'),
  contato('agrimix', 'AGRIMIX DISTRIBUIDORA DE PECAS LTDA'),
  contato('alpan', 'ALPAN MONTAGENS INDUSTRIAIS LTDA'),
  // empresas genericas pra "acos" e "montagens" pesarem pouco, como na base real
  ...Array.from({ length: 30 }, (_, i) => contato(`a${i}`, `Aços ${['Norte', 'Sul', 'Leste', 'Oeste', 'Centro'][i % 5]} ${i}`)),
  ...Array.from({ length: 30 }, (_, i) => contato(`m${i}`, `Montagens Exemplo ${i}`)),
];
const linha = (empresa, resultado = 'sem_contato', extra = {}) => ({
  empresa, pessoa: null, canal: 'ligacao', resultado, resumo: '', proximo_passo: null, data_proximo_passo: null, reuniao_em: null, ...extra,
});
const interacao = (contact_id, outcome = 'RESPONDEU', happened_at = '2026-10-05T15:00:00Z') => ({
  id: `i-${contact_id}-${happened_at}`, contact_id, type: 'LIGACAO', outcome, happened_at, note: null,
});

function rodar(linhas, interacoes, reunioes = []) {
  return conferir({ dia: '2026-10-05', vendedorId: VENDEDOR, linhas, indice: criarIndice(CONTATOS), interacoes, reunioes });
}

test('casa nome curto do e-mail com a razão social do CRM', () => {
  const r = rodar([linha('Zilquímica')], [interacao('zil')]);
  assert.equal(r.linhas[0].situacao, 'registrado');
  assert.equal(r.linhas[0].contato.id, 'zil');
});

test('"AÇOS CONTINENTAL" não vira "ACOS PUMA" só porque a Puma foi lançada', () => {
  const r = rodar([linha('AÇOS PUMA LTDA'), linha('AÇOS CONTINENTAL')], [interacao('puma')]);
  assert.equal(r.linhas[0].situacao, 'registrado');
  assert.equal(r.linhas[1].situacao, 'nao_registrado');
  assert.equal(r.linhas[1].contato.id, 'cont');
  assert.equal(r.placar.registradas, 1);
  assert.equal(r.placar.pct, 50);
});

test('só a marca bate, mas o vendedor lançou ali: é a mesma empresa', () => {
  const r = rodar([linha('SOPRANO MATRIZ E CENTRO DE DISTRIBUIÇÃO SUL')], [interacao('sop')]);
  assert.equal(r.linhas[0].situacao, 'registrado');
  assert.equal(r.linhas[0].contato.id, 'sop');
});

test('empresa fora da base não vira outra lançada só pela palavra comum', () => {
  const r = rodar([linha('AÇOS INEXISTENTE')], [interacao('puma')]);
  assert.equal(r.linhas[0].situacao, 'nao_achado');
  assert.equal(r.nao_citados[0].contato.id, 'puma');
});

test('várias fichas com o mesmo nome e nenhum lançamento: não chuta', () => {
  const r = rodar([linha('Suprir')], []);
  assert.equal(r.linhas[0].situacao, 'varias_fichas');
  assert.equal(r.linhas[0].candidatos.length, 3);
  assert.equal(r.placar.duvida, 1);
});

test('empresa fora da base não ganha sugestão errada por palavra comum', () => {
  const r = rodar([linha('ACQUA MONTAGENS INDUSTRIAIS EIRELI'), linha('Siatec')], []);
  assert.equal(r.linhas[0].situacao, 'nao_achado');
  assert.equal(r.linhas[1].situacao, 'nao_achado');
});

test('reunião prometida fora da agenda, próximo passo sem data e etapa que não andou', () => {
  const zap = linha('ZAP MONTAGEM', 'reuniao_marcada', { reuniao_em: '2026-10-09T14:00', data_proximo_passo: '2026-10-09' });
  const sem = rodar([zap], [interacao('zap')]);
  assert.deepEqual(sem.linhas[0].alertas, ['reuniao_fora_agenda', 'proximo_passo_sem_data', 'resultado_diferente']);
  assert.equal(sem.placar.reunioes_fora_agenda, 1);

  const com = rodar([zap], [interacao('zap', 'REUNIAO_MARCADA')], [{ contact_id: 'zap', meeting_at: '2026-10-09T17:00:00Z', status: 'SCHEDULED' }]);
  assert.deepEqual(com.linhas[0].alertas, ['proximo_passo_sem_data']);
});

test('resultado diferente só quando o e-mail afirma algo concreto', () => {
  const r = rodar(
    [linha('Engepress', 'pediu_apresentacao'), linha('ACOPUMPS', 'falou')],
    [interacao('eng', 'SEM_RESPOSTA'), interacao('aco', 'SEM_RESPOSTA')],
  );
  assert.deepEqual(r.linhas[0].alertas, ['resultado_diferente']);
  assert.deepEqual(r.linhas[1].alertas, []);
});

test('caminho inverso: lançou no dia e não citou; o da manhã seguinte não conta', () => {
  const r = rodar([linha('Zilquímica')], [
    interacao('zil'),
    interacao('agrimix', 'RESPONDEU', '2026-10-05T14:56:00Z'),
    interacao('alpan', 'RESPONDEU', '2026-10-06T12:28:00Z'), // 06/10 9h28 em SP: trabalho do outro dia
  ]);
  assert.equal(r.nao_citados.length, 1);
  assert.equal(r.nao_citados[0].contato.id, 'agrimix');
});

// ---------- os 4 relatorios reais de 05/10/2026, se estiverem na maquina ----------
const PASTA = process.env.CONFERENCIA_EML_DIR || path.join(os.homedir(), 'Downloads');
const REAIS = {
  'mario.sergio@comlinksa.com': 'Atividades realizadas – 05_10.eml',
  'joao.vigo@comlinksa.com': 'Relatório de prospecção e reuniões dia (05_10_2026).eml',
  'fernando.gomes@easycomlink.com': 'Relatório de prospecções, recontatos e reuniões – 05_10_2026.eml',
  'daniel.lima@easycomlink.com': '[EASY] - PROSPECÇÕES 05_10.eml',
};
const temReais = Object.values(REAIS).every((f) => fs.existsSync(path.join(PASTA, f)));

test('relatórios reais de 05/10: remetente, dia e texto', { skip: !temReais && 'e-mails de 05/10 não estão nesta máquina' }, () => {
  for (const [email, arquivo] of Object.entries(REAIS)) {
    const e = lerEml(fs.readFileSync(path.join(PASTA, arquivo), 'latin1'));
    assert.equal(e.deEmail, email);
    assert.equal(dataDoRelatorio(e.assunto, e.texto, e.enviadoEm), '2026-10-05');
    assert.ok(e.texto.length > 1500, `${arquivo}: texto curto demais`);
    assert.ok(!/=E[0-9A-F]|\[cid:|Ã[§©£¡³ºª]/.test(e.texto), `${arquivo}: sobrou codificação no texto`);
  }
});
