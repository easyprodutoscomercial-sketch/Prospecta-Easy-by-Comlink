'use client';

import { useState, useEffect } from 'react';
import { PcClient, PcClientStatus } from '@/lib/types';
import { PC_CLIENT_STATUS_LABELS } from '@/lib/utils/labels';

interface PcClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  client?: PcClient;
}

const statusOptions: PcClientStatus[] = ['SIM', 'NAO', 'AGUARDANDO_ACEITE', 'PRE_CADASTRO'];

export default function PcClientFormModal({ isOpen, onClose, onSaved, client }: PcClientFormModalProps) {
  const [fornecedor, setFornecedor] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [contato, setContato] = useState('');
  const [email, setEmail] = useState('');
  const [statusSac, setStatusSac] = useState<PcClientStatus>('PRE_CADASTRO');
  const [filhosCount, setFilhosCount] = useState(0);
  const [contatoData, setContatoData] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (client) {
      setFornecedor(client.fornecedor);
      setCnpj(client.cnpj || '');
      setContato(client.contato || '');
      setEmail(client.email || '');
      setStatusSac(client.status_sac);
      setFilhosCount(client.filhos_count);
      setContatoData(client.contato_data || '');
      setNotes(client.notes || '');
    } else {
      setFornecedor('');
      setCnpj('');
      setContato('');
      setEmail('');
      setStatusSac('PRE_CADASTRO');
      setFilhosCount(0);
      setContatoData('');
      setNotes('');
    }
  }, [client, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fornecedor.trim()) return;

    setSubmitting(true);
    try {
      const body = {
        fornecedor: fornecedor.trim(),
        cnpj: cnpj.trim() || null,
        contato: contato.trim() || null,
        email: email.trim() || null,
        status_sac: statusSac,
        filhos_count: filhosCount,
        contato_data: contatoData.trim() || null,
        notes: notes.trim() || null,
      };

      const url = client
        ? `/api/pedidos-cotacoes/clients/${client.id}`
        : '/api/pedidos-cotacoes/clients';
      const method = client ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save client');
      onSaved();
    } catch (err) {
      console.error('Error saving client:', err);
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
            {client ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Contato</label>
              <input
                type="text"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
                placeholder="Nome do contato"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Status SAC</label>
              <select
                value={statusSac}
                onChange={(e) => setStatusSac(e.target.value as PcClientStatus)}
                className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {PC_CLIENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Filhos Count</label>
              <input
                type="number"
                value={filhosCount}
                onChange={(e) => setFilhosCount(Number(e.target.value))}
                min={0}
                className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Data Contato</label>
            <input
              type="text"
              value={contatoData}
              onChange={(e) => setContatoData(e.target.value)}
              className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none"
              placeholder="Informacoes de contato"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg text-white text-sm focus:border-emerald-500/50 focus:outline-none resize-none"
              placeholder="Observacoes..."
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
              {submitting ? 'Salvando...' : client ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
