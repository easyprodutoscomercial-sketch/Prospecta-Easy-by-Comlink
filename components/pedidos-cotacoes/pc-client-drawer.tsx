'use client';

import { useState, useEffect, useCallback } from 'react';
import { PcClient, PcCotacao, PcPedido } from '@/lib/types';
import {
  PC_CLIENT_STATUS_LABELS,
  PC_CLIENT_STATUS_COLORS,
  PC_COTACAO_RESPOSTA_LABELS,
  PC_COTACAO_RESPOSTA_COLORS,
  PC_PEDIDO_SITUACAO_LABELS,
  PC_PEDIDO_SITUACAO_COLORS,
} from '@/lib/utils/labels';
import PcRecordTimeline from './pc-record-timeline';

interface PcClientDrawerProps {
  clientId: string | null;
  onClose: () => void;
  onEdit: (client: PcClient) => void;
}

export default function PcClientDrawer({ clientId, onClose, onEdit }: PcClientDrawerProps) {
  const [client, setClient] = useState<PcClient | null>(null);
  const [cotacoes, setCotacoes] = useState<PcCotacao[]>([]);
  const [pedidos, setPedidos] = useState<PcPedido[]>([]);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isOpen = !!clientId;

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedidos-cotacoes/clients/${id}/detail`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setClient(data.client);
      setCotacoes(data.cotacoes || []);
      setPedidos(data.pedidos || []);
      setCreatedByName(data.created_by_name);
    } catch {
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientId) {
      fetchDetail(clientId);
    } else {
      setClient(null);
      setCotacoes([]);
      setPedidos([]);
    }
  }, [clientId, fetchDetail]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-[#1e0f35] border-l border-purple-800/20 z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } overflow-y-auto`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-purple-800/20 sticky top-0 bg-[#1e0f35] z-10">
          <h2 className="text-lg font-semibold text-white">Visao 360</h2>
          <div className="flex items-center gap-2">
            {client && (
              <button
                onClick={() => onEdit(client)}
                className="p-1.5 text-neutral-400 hover:text-emerald-400 transition-colors"
                title="Editar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            <button onClick={onClose} className="text-neutral-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 bg-purple-800/20 rounded animate-pulse" />
            ))}
          </div>
        ) : client ? (
          <div className="p-5 space-y-6">
            {/* Client Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">Cliente</h3>
              <div>
                <p className="text-white font-medium">{client.fornecedor}</p>
                {client.cnpj && <p className="text-xs text-neutral-500">{client.cnpj}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PC_CLIENT_STATUS_COLORS[client.status_sac] || 'bg-neutral-500/20 text-neutral-400'}`}>
                  {PC_CLIENT_STATUS_LABELS[client.status_sac] || client.status_sac}
                </span>
              </div>
              {client.contato && (
                <p className="text-sm text-neutral-300">Contato: {client.contato}</p>
              )}
              {client.email && (
                <p className="text-sm text-neutral-300">Email: {client.email}</p>
              )}
              {client.notes && (
                <p className="text-xs text-neutral-500 mt-1">{client.notes}</p>
              )}
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">Historico</h3>
              <PcRecordTimeline
                created_at={client.created_at}
                updated_at={client.updated_at}
                created_by_name={createdByName || undefined}
              />
            </div>

            {/* Cotacoes */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">
                Cotacoes ({cotacoes.length})
              </h3>
              {cotacoes.length === 0 ? (
                <p className="text-xs text-neutral-500">Nenhuma cotacao vinculada</p>
              ) : (
                <div className="space-y-2">
                  {cotacoes.slice(0, 10).map((c) => (
                    <div key={c.id} className="bg-[#120826] rounded-lg p-3 border border-purple-800/20">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">#{c.cotacao_numero}</span>
                        <span className="text-sm text-neutral-400">{c.fornecedor}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PC_COTACAO_RESPOSTA_COLORS[c.resposta] || 'bg-neutral-500/20 text-neutral-400'}`}>
                          {PC_COTACAO_RESPOSTA_LABELS[c.resposta] || c.resposta}
                        </span>
                        {c.valor != null && (
                          <span className="text-xs text-cyan-400">
                            R$ {Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pedidos */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">
                Pedidos ({pedidos.length})
              </h3>
              {pedidos.length === 0 ? (
                <p className="text-xs text-neutral-500">Nenhum pedido vinculado</p>
              ) : (
                <div className="space-y-2">
                  {pedidos.slice(0, 10).map((p) => (
                    <div key={p.id} className="bg-[#120826] rounded-lg p-3 border border-purple-800/20">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">#{p.pedido_numero}</span>
                        <span className="text-sm text-neutral-400">{p.empresa}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PC_PEDIDO_SITUACAO_COLORS[p.situacao] || 'bg-neutral-500/20 text-neutral-400'}`}>
                          {PC_PEDIDO_SITUACAO_LABELS[p.situacao] || p.situacao}
                        </span>
                        {p.finalizado && (
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400">
                            Finalizado
                          </span>
                        )}
                        {p.valor != null && (
                          <span className="text-xs text-cyan-400">
                            R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-5 text-center text-neutral-500 text-sm">
            Cliente nao encontrado
          </div>
        )}
      </div>
    </>
  );
}
