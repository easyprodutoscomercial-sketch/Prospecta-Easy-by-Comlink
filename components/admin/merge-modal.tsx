'use client';

import { useState, useMemo, useCallback } from 'react';
import MergeFieldRow from './merge-field-row';
import { useToast } from '@/lib/toast-context';

interface MergeContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  company: string | null;
  status: string;
  created_at: string;
  [key: string]: any;
}

interface MergeModalProps {
  contactA: MergeContact;
  contactB: MergeContact;
  onClose: () => void;
  onMerged: () => void;
}

const MERGE_FIELDS: { field: string; label: string }[] = [
  { field: 'name', label: 'Nome' },
  { field: 'email', label: 'Email' },
  { field: 'phone', label: 'Telefone' },
  { field: 'cpf', label: 'CPF' },
  { field: 'cnpj', label: 'CNPJ' },
  { field: 'company', label: 'Empresa' },
  { field: 'cargo', label: 'Cargo' },
  { field: 'status', label: 'Status' },
  { field: 'temperatura', label: 'Temperatura' },
  { field: 'origem', label: 'Origem' },
  { field: 'classe', label: 'Classe' },
  { field: 'website', label: 'Website' },
  { field: 'linkedin', label: 'LinkedIn' },
  { field: 'instagram', label: 'Instagram' },
  { field: 'estado', label: 'Estado' },
  { field: 'cidade', label: 'Cidade' },
  { field: 'endereco', label: 'Endereco' },
  { field: 'cep', label: 'CEP' },
  { field: 'notes', label: 'Observacoes' },
  { field: 'tags', label: 'Tags' },
];

export default function MergeModal({ contactA, contactB, onClose, onMerged }: MergeModalProps) {
  const toast = useToast();
  const [merging, setMerging] = useState(false);

  // Auto-select: prefer non-empty values, default to A
  const initialSelections = useMemo(() => {
    const selections: Record<string, 'a' | 'b'> = {};
    for (const { field } of MERGE_FIELDS) {
      const aVal = contactA[field];
      const bVal = contactB[field];
      const aEmpty = aVal === null || aVal === undefined || aVal === '';
      const bEmpty = bVal === null || bVal === undefined || bVal === '';
      if (aEmpty && !bEmpty) {
        selections[field] = 'b';
      } else {
        selections[field] = 'a';
      }
    }
    return selections;
  }, [contactA, contactB]);

  const [selections, setSelections] = useState<Record<string, 'a' | 'b'>>(initialSelections);

  const handleSelect = useCallback((field: string, choice: 'a' | 'b') => {
    setSelections(prev => ({ ...prev, [field]: choice }));
  }, []);

  const mergedFields = useMemo(() => {
    const result: Record<string, any> = {};
    for (const { field } of MERGE_FIELDS) {
      const source = selections[field] === 'b' ? contactB : contactA;
      if (source[field] !== null && source[field] !== undefined && source[field] !== '') {
        result[field] = source[field];
      }
    }
    // Concatenate notes from both if both exist
    const notesA = contactA.notes || '';
    const notesB = contactB.notes || '';
    if (notesA && notesB && selections.notes === 'a') {
      result.notes = `${notesA}\n---\n${notesB}`;
    } else if (notesA && notesB && selections.notes === 'b') {
      result.notes = `${notesB}\n---\n${notesA}`;
    }
    return result;
  }, [selections, contactA, contactB]);

  const handleMerge = async () => {
    setMerging(true);
    try {
      const res = await fetch('/api/contacts/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_id: contactA.id,
          secondary_id: contactB.id,
          merged_fields: mergedFields,
        }),
      });
      if (res.ok) {
        toast.success('Contatos mesclados com sucesso!');
        onMerged();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao mesclar contatos');
      }
    } catch {
      toast.error('Erro ao mesclar contatos');
    }
    setMerging(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#120826] border border-purple-800/30 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-purple-800/20 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-emerald-400">Mesclar Contatos</h2>
            <p className="text-xs text-purple-300/50 mt-0.5">Selecione qual valor manter para cada campo</p>
          </div>
          <button
            onClick={onClose}
            className="text-purple-300/50 hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Column headers */}
        <div className="px-6 py-2 border-b border-purple-800/15 grid grid-cols-[140px_1fr_1fr] gap-3 shrink-0">
          <span className="text-[10px] uppercase font-bold text-purple-300/40">Campo</span>
          <span className="text-[10px] uppercase font-bold text-purple-300/40">
            Contato A — {contactA.name}
          </span>
          <span className="text-[10px] uppercase font-bold text-purple-300/40">
            Contato B — {contactB.name}
          </span>
        </div>

        {/* Field rows */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {MERGE_FIELDS.map(({ field, label }) => (
            <MergeFieldRow
              key={field}
              field={field}
              label={label}
              valueA={contactA[field]}
              valueB={contactB[field]}
              selected={selections[field]}
              onSelect={(choice) => handleSelect(field, choice)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-purple-800/20 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-purple-300/40">
            O contato B sera removido e seus registros transferidos para A.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-purple-300/70 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleMerge}
              disabled={merging}
              className="px-5 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-40 transition-colors"
            >
              {merging ? 'Mesclando...' : 'Confirmar Merge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
