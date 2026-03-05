'use client';

import { PcCotacao } from '@/lib/types';
import { PC_COTACAO_RESPOSTA_LABELS, PC_COTACAO_RESPOSTA_COLORS } from '@/lib/utils/labels';

interface PcCotacaoComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  cotacoes: PcCotacao[];
  cotacaoNumero: string;
}

export default function PcCotacaoComparisonModal({ isOpen, onClose, cotacoes, cotacaoNumero }: PcCotacaoComparisonModalProps) {
  if (!isOpen) return null;

  // Find best (lowest) valor
  const valoresValidos = cotacoes.filter((c) => c.valor != null).map((c) => ({ id: c.id, valor: Number(c.valor) }));
  const bestValorId = valoresValidos.length > 0
    ? valoresValidos.reduce((best, cur) => (cur.valor < best.valor ? cur : best)).id
    : null;

  // Find earliest prazo
  const prazosValidos = cotacoes.filter((c) => c.prazo_entrega).map((c) => ({ id: c.id, prazo: c.prazo_entrega! }));
  const bestPrazoId = prazosValidos.length > 0
    ? prazosValidos.reduce((best, cur) => (cur.prazo < best.prazo ? cur : best)).id
    : null;

  const rows: { label: string; getter: (c: PcCotacao) => string; highlight?: (c: PcCotacao) => boolean }[] = [
    { label: 'Fornecedor', getter: (c) => c.fornecedor },
    { label: 'CNPJ', getter: (c) => c.cnpj || '-' },
    {
      label: 'Resposta',
      getter: (c) => PC_COTACAO_RESPOSTA_LABELS[c.resposta] || c.resposta,
    },
    {
      label: 'Valor (R$)',
      getter: (c) => c.valor != null ? Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-',
      highlight: (c) => c.id === bestValorId,
    },
    {
      label: 'Prazo Entrega',
      getter: (c) => c.prazo_entrega ? new Date(c.prazo_entrega).toLocaleDateString('pt-BR') : '-',
      highlight: (c) => c.id === bestPrazoId,
    },
    { label: 'Condicoes', getter: (c) => c.condicoes_pagamento || '-' },
    { label: 'Informe', getter: (c) => c.informe || '-' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[#1e0f35] border border-purple-800/20 rounded-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-purple-800/20">
          <h2 className="text-lg font-semibold text-white">
            Comparativo - Cotacao #{cotacaoNumero}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-purple-800/20">
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-3 py-2 min-w-[120px]">
                  Atributo
                </th>
                {cotacoes.map((c) => (
                  <th key={c.id} className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-3 py-2 min-w-[150px]">
                    {c.fornecedor}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-purple-800/10">
                  <td className="px-3 py-2 text-sm font-medium text-neutral-400">
                    {row.label}
                  </td>
                  {cotacoes.map((c) => {
                    const isHighlighted = row.highlight?.(c);
                    return (
                      <td
                        key={c.id}
                        className={`px-3 py-2 text-sm ${
                          isHighlighted
                            ? 'text-emerald-400 font-semibold bg-emerald-500/5'
                            : 'text-neutral-300'
                        }`}
                      >
                        {row.getter(c)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
