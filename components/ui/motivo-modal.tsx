'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const modalRef = useRef<HTMLDivElement>(null);

  const labels = tipo === 'CONVERTIDO' ? MOTIVO_GANHO_LABELS : MOTIVO_PERDIDO_LABELS;
  const title = tipo === 'CONVERTIDO' ? 'Motivo do Ganho' : 'Motivo da Perda';
  const subtitle = tipo === 'CONVERTIDO'
    ? 'Por que este contato foi convertido?'
    : 'Por que este contato foi perdido?';

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Reset motivo only when modal opens (not on every parent re-render)
  useEffect(() => {
    if (isOpen) setMotivo('');
  }, [isOpen]);

  // Keyboard + scroll lock + focus trap
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="motivo-modal-title">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        className="relative bg-[#1e0f35] border border-purple-800/30 rounded-xl shadow-2xl shadow-purple-900/40 max-w-md w-full mx-4 p-6 animate-modal-enter"
      >
        <h3 id="motivo-modal-title" className="text-lg font-semibold text-emerald-400 mb-1">{title}</h3>
        <p className="text-sm text-purple-300/60 mb-4">{subtitle}</p>

        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Motivos rapidos">
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

        <label htmlFor="motivo-textarea" className="sr-only">Descreva o motivo</label>
        <textarea
          id="motivo-textarea"
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
