'use client';

import { useState } from 'react';
import { PcCotacao } from '@/lib/types';
import { PC_COTACAO_RESPOSTA_LABELS, PC_COTACAO_RESPOSTA_COLORS } from '@/lib/utils/labels';

interface PcCotacaoGroupCardProps {
  cotacaoNumero: string;
  cotacaoNome: string | null;
  cotacoes: PcCotacao[];
  onEdit: (cotacao: PcCotacao) => void;
  onDelete: (id: string) => void;
  onConvertToPedido?: (cotacao: PcCotacao) => void;
  onCompare?: () => void;
  bulkMode?: boolean;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
}

export default function PcCotacaoGroupCard({
  cotacaoNumero,
  cotacaoNome,
  cotacoes,
  onEdit,
  onDelete,
  onConvertToPedido,
  onCompare,
  bulkMode,
  selectedIds,
  onToggle,
}: PcCotacaoGroupCardProps) {
  const [expanded, setExpanded] = useState(false);

  const responderam = cotacoes.filter((c) => c.resposta === 'RESPONDEU').length;
  const naoResponderam = cotacoes.filter((c) => c.resposta === 'NAO_RESPONDEU').length;

  return (
    <div className="bg-[#1e0f35] border border-purple-800/20 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-purple-800/10 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <svg className="w-4 h-4 text-neutral-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-neutral-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white">#{cotacaoNumero}</span>
              {cotacaoNome && (
                <span className="text-sm text-neutral-400">{cotacaoNome}</span>
              )}
              <span className="text-xs text-neutral-500">
                ({cotacoes.length} fornecedor{cotacoes.length !== 1 ? 'es' : ''})
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {responderam > 0 && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400">
              {responderam} respondeu
            </span>
          )}
          {naoResponderam > 0 && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400">
              {naoResponderam} nao respondeu
            </span>
          )}
          {onCompare && cotacoes.length >= 2 && (
            <button
              onClick={(e) => { e.stopPropagation(); onCompare(); }}
              className="rounded-full px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
              title="Comparar fornecedores"
            >
              Comparar
            </button>
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-purple-800/20">
          {cotacoes.map((cotacao) => (
            <div
              key={cotacao.id}
              className="flex items-center justify-between px-4 py-3 border-b border-purple-800/10 last:border-b-0 hover:bg-purple-800/5"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                {bulkMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(cotacao.id)}
                    onChange={() => onToggle?.(cotacao.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 accent-emerald-500"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-neutral-300 font-medium truncate">
                    {cotacao.fornecedor}
                  </p>
                  {cotacao.cnpj && (
                    <p className="text-xs text-neutral-500">{cotacao.cnpj}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    PC_COTACAO_RESPOSTA_COLORS[cotacao.resposta] || 'bg-neutral-500/20 text-neutral-400'
                  }`}
                >
                  {PC_COTACAO_RESPOSTA_LABELS[cotacao.resposta] || cotacao.resposta}
                </span>
                {cotacao.valor != null && (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-cyan-500/20 text-cyan-400">
                    R$ {Number(cotacao.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}
                {cotacao.prazo_entrega && (
                  <span className="shrink-0 text-xs text-neutral-500 hidden md:block">
                    Prazo: {new Date(cotacao.prazo_entrega).toLocaleDateString('pt-BR')}
                  </span>
                )}
                {cotacao.informe && (
                  <p className="text-xs text-neutral-500 truncate max-w-xs hidden lg:block">
                    {cotacao.informe}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {onConvertToPedido && cotacao.resposta === 'RESPONDEU' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onConvertToPedido(cotacao);
                    }}
                    className="p-1.5 text-neutral-400 hover:text-cyan-400 transition-colors"
                    title="Gerar Pedido"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(cotacao);
                  }}
                  className="p-1.5 text-neutral-400 hover:text-emerald-400 transition-colors"
                  title="Editar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(cotacao.id);
                  }}
                  className="p-1.5 text-neutral-400 hover:text-red-400 transition-colors"
                  title="Excluir"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
