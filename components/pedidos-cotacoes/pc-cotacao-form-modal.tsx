'use client';

import { useState, useEffect } from 'react';
import { PcCotacao, PcCotacaoResposta } from '@/lib/types';
import { PC_COTACAO_RESPOSTA_LABELS } from '@/lib/utils/labels';

interface PcCotacaoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  cotacao?: PcCotacao;
}

const respostaOptions: PcCotacaoResposta[] = ['RESPONDEU', 'NAO_RESPONDEU'];

export default function PcCotacaoFormModal({ isOpen, onClose, onSaved, cotacao }: PcCotacaoFormModalProps) {
  const [cotacaoNumero, setCotacaoNumero] = useState('');
  const [cotacaoNome, setCotacaoNome] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [informe, setInforme] = useState('');
  const [resposta, setResposta] = useState<PcCotacaoResposta>('NAO_RESPONDEU');
  const [valor, setValor] = useState('');
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [condicoesPagamento, setCondicoesPagamento] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cotacao) {
      setCotacaoNumero(cotacao.cotacao_numero);
      setCotacaoNome(cotacao.cotacao_nome || '');
      setFornecedor(cotacao.fornecedor);
      setCnpj(cotacao.cnpj || '');
      setInforme(cotacao.informe || '');
      setResposta(cotacao.resposta);
      setValor(cotacao.valor != null ? String(cotacao.valor) : '');
      setPrazoEntrega(cotacao.prazo_entrega || '');
      setCondicoesPagamento(cotacao.condicoes_pagamento || '');
    } else {
      setCotacaoNumero('');
      setCotacaoNome('');
      setFornecedor('');
      setCnpj('');
      setInforme('');
      setResposta('NAO_RESPONDEU');
      setValor('');
      setPrazoEntrega('');
      setCondicoesPagamento('');
    }
  }, [cotacao, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fornecedor.trim()) return;

    setSubmitting(true);
    try {
      const body = {
        cotacao_numero: cotacaoNumero.trim(),
        cotacao_nome: cotacaoNome.trim() || null,
        fornecedor: fornecedor.trim(),
        cnpj: cnpj.trim() || null,
        informe: informe.trim() || null,
        resposta,
        valor: valor ? Number(valor) : null,
        prazo_entrega: prazoEntrega || null,
        condicoes_pagamento: condicoesPagamento.trim() || null,
      };

      const url = cotacao
        ? `/api/pedidos-cotacoes/cotacoes/${cotacao.id}`
        : '/api/pedidos-cotacoes/cotacoes';
      const method = cotacao ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save cotacao');
      onSaved();
    } catch (err) {
      console.error('Error saving cotacao:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[#1e0f35] border border-purple-800/20 rounded-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-purple-800/20">
          <h2 className="text-lg font-semibold text-white">
            {cotacao ? 'Editar Cotacao' : 'Nova Cotacao'}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Numero Cotacao
              </label>
              <input
                type="text"
                value={cotacaoNumero}
                onChange={(e) => setCotacaoNumero(e.target.value)}
                className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
                placeholder="Ex: 001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Nome Cotacao
              </label>
              <input
                type="text"
                value={cotacaoNome}
                onChange={(e) => setCotacaoNome(e.target.value)}
                className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
                placeholder="Descricao da cotacao"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Fornecedor <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
              placeholder="Nome do fornecedor"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">CNPJ</label>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Informe</label>
            <textarea
              value={informe}
              onChange={(e) => setInforme(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none resize-none"
              placeholder="Informacoes adicionais..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Resposta</label>
            <select
              value={resposta}
              onChange={(e) => setResposta(e.target.value as PcCotacaoResposta)}
              className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
            >
              {respostaOptions.map((r) => (
                <option key={r} value={r}>
                  {PC_COTACAO_RESPOSTA_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Prazo Entrega</label>
              <input
                type="date"
                value={prazoEntrega}
                onChange={(e) => setPrazoEntrega(e.target.value)}
                className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Condicoes de Pagamento</label>
            <input
              type="text"
              value={condicoesPagamento}
              onChange={(e) => setCondicoesPagamento(e.target.value)}
              className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
              placeholder="Ex: 30/60/90 dias"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-purple-800/30 text-neutral-400 hover:text-neutral-300 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !fornecedor.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Salvando...' : cotacao ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
