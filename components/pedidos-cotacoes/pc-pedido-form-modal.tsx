'use client';

import { useState, useEffect } from 'react';
import { PcPedido, PcPedidoSituacao, PcCotacao } from '@/lib/types';
import { PC_PEDIDO_SITUACAO_LABELS } from '@/lib/utils/labels';

interface PcPedidoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  pedido?: PcPedido;
  fromCotacao?: PcCotacao | null;
}

const situacaoOptions: PcPedidoSituacao[] = ['PENDENTE', 'ACEITO', 'RECUSADO', 'EM_ANDAMENTO', 'FINALIZADO'];

export default function PcPedidoFormModal({ isOpen, onClose, onSaved, pedido, fromCotacao }: PcPedidoFormModalProps) {
  const [pedidoNumero, setPedidoNumero] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [situacao, setSituacao] = useState<PcPedidoSituacao>('PENDENTE');
  const [informe, setInforme] = useState('');
  const [valor, setValor] = useState('');
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [condicoesPagamento, setCondicoesPagamento] = useState('');
  const [cotacaoId, setCotacaoId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (fromCotacao) {
      setPedidoNumero('');
      setEmpresa(fromCotacao.fornecedor);
      setSituacao('PENDENTE');
      setInforme(fromCotacao.informe || '');
      setValor(fromCotacao.valor != null ? String(fromCotacao.valor) : '');
      setPrazoEntrega(fromCotacao.prazo_entrega || '');
      setCondicoesPagamento(fromCotacao.condicoes_pagamento || '');
      setCotacaoId(fromCotacao.id);
    } else if (pedido) {
      setPedidoNumero(pedido.pedido_numero);
      setEmpresa(pedido.empresa);
      setSituacao(pedido.situacao);
      setInforme(pedido.informe || '');
      setValor(pedido.valor != null ? String(pedido.valor) : '');
      setPrazoEntrega(pedido.prazo_entrega || '');
      setCondicoesPagamento(pedido.condicoes_pagamento || '');
      setCotacaoId(pedido.cotacao_id || null);
    } else {
      setPedidoNumero('');
      setEmpresa('');
      setSituacao('PENDENTE');
      setInforme('');
      setValor('');
      setPrazoEntrega('');
      setCondicoesPagamento('');
      setCotacaoId(null);
    }
  }, [pedido, fromCotacao, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa.trim()) return;

    setSubmitting(true);
    try {
      const body: any = {
        pedido_numero: pedidoNumero.trim(),
        empresa: empresa.trim(),
        situacao,
        informe: informe.trim() || null,
        valor: valor ? Number(valor) : null,
        prazo_entrega: prazoEntrega || null,
        condicoes_pagamento: condicoesPagamento.trim() || null,
      };
      if (cotacaoId) body.cotacao_id = cotacaoId;

      const url = pedido
        ? `/api/pedidos-cotacoes/pedidos/${pedido.id}`
        : '/api/pedidos-cotacoes/pedidos';
      const method = pedido ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save pedido');
      onSaved();
    } catch (err) {
      console.error('Error saving pedido:', err);
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
          <div>
            <h2 className="text-lg font-semibold text-white">
              {fromCotacao ? 'Novo Pedido (da Cotacao)' : pedido ? 'Editar Pedido' : 'Novo Pedido'}
            </h2>
            {cotacaoId && (
              <span className="text-xs text-purple-400 mt-0.5">Originado da Cotacao</span>
            )}
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Numero Pedido
            </label>
            <input
              type="text"
              value={pedidoNumero}
              onChange={(e) => setPedidoNumero(e.target.value)}
              className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
              placeholder="Ex: PED-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Empresa <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
              placeholder="Nome da empresa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Situacao</label>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value as PcPedidoSituacao)}
              className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
            >
              {situacaoOptions.map((s) => (
                <option key={s} value={s}>
                  {PC_PEDIDO_SITUACAO_LABELS[s]}
                </option>
              ))}
            </select>
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
              disabled={submitting || !empresa.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Salvando...' : pedido ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
