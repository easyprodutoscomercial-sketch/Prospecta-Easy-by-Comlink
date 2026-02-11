'use client';

import { useState, useEffect, useCallback } from 'react';
import { MOTIVO_GANHO_LABELS, MOTIVO_PERDIDO_LABELS } from '@/lib/utils/labels';

interface MotivoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
  tipo: 'CONVERTIDO' | 'PERDIDO';
  loading?: boolean;
}

export default function MotivoModal({
  isOpen,
  onClose,
  onConfirm,
  tipo,
  loading = false,
}: MotivoModalProps) {
  const [motivo, setMotivo] = useState('');

  const labels = tipo === 'CONVERTIDO' ? MOTIVO_GANHO_LABELS : MOTIVO_PERDIDO_LABELS;
  const title = tipo === 'CONVERTIDO' ? 'Motivo do Ganho' : 'Motivo da Perda';
  const subtitle = tipo === 'CONVERTIDO'
    ? 'Por que este contato foi convertido?'
    : 'Por que este contato foi perdido?';

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      setMotivo('');
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1e0f35] border border-purple-800/30 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 animate-fade-in">
        <h3 className="text-lg font-semibold text-emerald-400 mb-1">{title}</h3>
        <p className="text-sm text-purple-300/60 mb-4">{subtitle}</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(labels).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMotivo(label)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                motivo === label
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-[#2a1245] text-purple-200 border-purple-700/30 hover:bg-purple-800/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <textarea
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Descreva o motivo..."
          className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-4"
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm border border-purple-700/30 rounded-lg text-purple-200 hover:bg-purple-800/20 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(motivo)}
            disabled={loading || !motivo.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
