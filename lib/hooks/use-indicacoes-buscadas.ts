'use client';

import { useSyncExternalStore } from 'react';

// Quantas empresas a IA ja achou para cada contato. Uma busca so ao servidor,
// compartilhada por todos os cards do kanban (sao milhares: um fetch por card derrubaria a tela).
let dados: Record<string, number> = {};
let carregado = false;
const ouvintes = new Set<() => void>();

export function recarregarIndicacoesBuscadas() {
  carregado = true;
  fetch('/api/indicacoes/buscadas')
    .then((r) => (r.ok ? r.json() : {}))
    .then((j: Record<string, number> | { error: string }) => {
      dados = j && typeof j === 'object' && !('error' in j) ? (j as Record<string, number>) : {};
      ouvintes.forEach((f) => f());
    })
    .catch(() => { /* sem selo, o resto funciona */ });
}

function assinar(f: () => void) {
  ouvintes.add(f);
  if (!carregado) recarregarIndicacoesBuscadas();
  return () => { ouvintes.delete(f); };
}

export function useIndicacoesBuscadas(contactId: string): number {
  return useSyncExternalStore(assinar, () => dados[contactId] || 0, () => 0);
}
