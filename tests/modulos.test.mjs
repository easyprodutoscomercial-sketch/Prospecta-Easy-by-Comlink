// Testes dos modulos liga/desliga (Admin -> Modulos do sistema). npm test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULOS, DESLIGADOS_PADRAO, normalizarDesligados, moduloDaRota, rotaBloqueada } from '../lib/modulos/regras.ts';

test('cada endereco cai no modulo certo', () => {
  assert.equal(moduloDaRota('/quiz-feira'), 'quiz');
  assert.equal(moduloDaRota('/quiz/abc123'), 'quiz'); // link publico do quiz
  assert.equal(moduloDaRota('/eventos/9f1e?stand=2'), 'eventos');
  assert.equal(moduloDaRota('/walkin-fill/uuid'), 'eventos');
  assert.equal(moduloDaRota('/portal/tok'), 'suporte');
  assert.equal(moduloDaRota('/suporte/projects'), 'suporte');
  assert.equal(moduloDaRota('/pedidos-cotacoes'), 'pedidos');
  assert.equal(moduloDaRota('/admin/automations'), 'automacoes');
  assert.equal(moduloDaRota('/lead-capture/tok'), 'captura');
  assert.equal(moduloDaRota('/reports'), 'relatorios');
});

test('o que e de uso diario nunca e desligavel', () => {
  for (const r of ['/dashboard', '/contacts', '/contacts/123', '/kanban', '/kanban?chat=1', '/calendar',
    '/admin', '/admin/conferencia', '/settings', '/requests', '/import', '/login']) {
    assert.equal(moduloDaRota(r), null, r);
  }
});

test('prefixo parecido nao confunde (/quiz nao pega /quiz-feira e vice-versa)', () => {
  assert.equal(moduloDaRota('/quizzes'), null);
  assert.equal(moduloDaRota('/reportsx'), null);
});

test('modulo desligado bloqueia, ligado libera', () => {
  assert.equal(rotaBloqueada('/quiz-feira', ['quiz']), true);
  assert.equal(rotaBloqueada('/quiz-feira', ['suporte']), false);
  assert.equal(rotaBloqueada('/contacts', DESLIGADOS_PADRAO), false);
});

test('sem configuracao salva, comeca tudo desligado (decisao do dono em 09/10/2026)', () => {
  assert.deepEqual(normalizarDesligados(undefined), DESLIGADOS_PADRAO);
  assert.deepEqual([...DESLIGADOS_PADRAO].sort(), MODULOS.map((m) => m.chave).sort());
});

test('lista salva manda: vazia = tudo ligado; lixo e repeticao sao descartados', () => {
  assert.deepEqual(normalizarDesligados([]), []);
  assert.deepEqual(normalizarDesligados(['quiz', 'quiz', 'contatos', 42, 'eventos']), ['quiz', 'eventos']);
});
