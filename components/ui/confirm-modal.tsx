'use client';

import { useEffect, useCallback, useRef } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  variant?: 'danger' | 'warning';
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  variant = 'danger',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      // Auto-focus cancel button
      setTimeout(() => cancelRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const btnColor =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-500 text-white'
      : 'bg-amber-500 hover:bg-amber-400 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      {/* Overlay with animation */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Card with animation */}
      <div
        ref={modalRef}
        className="relative bg-[#1e0f35] border border-purple-800/30 rounded-xl shadow-2xl shadow-purple-900/40 max-w-md w-full mx-4 p-6 animate-modal-enter"
      >
        <h3 id="confirm-modal-title" className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-purple-200/70 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm border border-purple-700/30 rounded-lg text-purple-200 hover:bg-purple-800/20 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${btnColor}`}
          >
            {loading ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
