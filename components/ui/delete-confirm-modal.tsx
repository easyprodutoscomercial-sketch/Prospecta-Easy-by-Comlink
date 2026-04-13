'use client';

import { useState, useEffect, useRef } from 'react';

// Modal generico "digite o nome pra confirmar" usado pra delecoes pesadas:
// feira, contato, stand. Mostra preview do cascade (contagens) e so habilita
// o botao vermelho quando o usuario digita exatamente o nome da entidade.
//
// Padrao inspirado no GitHub/Vercel: impossivel clicar por engano em 2h da
// manha. Leva 5 seg a mais quando e de verdade, impede 100% dos acidentes.

interface DeleteItem {
  label: string;
  value: number | string;
  critical?: boolean; // destaca em vermelho/amarelo
  prefix?: string;    // ex: "R$ "
}

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;

  // Titulo do modal (ex: "Apagar Feira", "Apagar Contato")
  title: string;

  // Nome exato que o usuario precisa digitar pra confirmar
  confirmName: string;

  // Lista de coisas que vao ser apagadas (vem do endpoint /delete-preview)
  items: DeleteItem[];

  // Endpoint DELETE pra chamar quando confirmar
  deleteUrl: string;

  // Texto explicativo (ex: "Essa feira e tudo que ela tem vai sumir")
  description?: string;

  // Callback opcional executado depois do delete (toast, navigate, etc).
  // Se nao for passado, so chama onConfirmed.
  onSuccess?: (result: any) => void;
}

export default function DeleteConfirmModal({
  open,
  onClose,
  onConfirmed,
  title,
  confirmName,
  items,
  deleteUrl,
  description,
  onSuccess,
}: DeleteConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTyped('');
      setError(null);
      // Foca o input depois do render
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, loading, onClose]);

  if (!open) return null;

  const nameMatches = typed.trim() === confirmName.trim();

  const handleDelete = async () => {
    if (!nameMatches || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(deleteUrl, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Erro ao apagar');
        setLoading(false);
        return;
      }
      if (onSuccess) onSuccess(data);
      onConfirmed();
    } catch (e: any) {
      setError(e?.message || 'Erro de conexao');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-lg bg-[#1e0f35] border-2 border-red-500/40 rounded-2xl shadow-2xl shadow-red-900/30 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header vermelho */}
        <div className="bg-red-500/10 border-b border-red-500/20 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white">{title}</h2>
              <p className="text-xs text-red-300/80 mt-0.5">Esta acao <span className="font-bold">NAO pode ser desfeita</span>.</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {description && (
            <p className="text-sm text-purple-200/80 leading-relaxed">{description}</p>
          )}

          {items.length > 0 && (
            <div className="bg-[#2a1245]/50 border border-purple-800/30 rounded-lg p-4">
              <p className="text-[11px] font-bold text-purple-300/70 uppercase tracking-widest mb-2">
                O que vai ser apagado
              </p>
              <ul className="space-y-1.5">
                {items.map((item, i) => (
                  <li key={i} className="flex items-center justify-between text-xs">
                    <span className="text-purple-200/70">{item.label}</span>
                    <span
                      className={`font-bold tabular-nums ${
                        item.critical
                          ? 'text-red-400'
                          : Number(item.value) > 0
                          ? 'text-white'
                          : 'text-purple-300/40'
                      }`}
                    >
                      {item.prefix || ''}
                      {item.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-purple-200/80 mb-1.5">
              Pra confirmar, digite: <span className="text-red-400 font-mono">{confirmName}</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-[#2a1245] text-white placeholder-purple-300/30 focus:outline-none focus:ring-2 disabled:opacity-50 ${
                nameMatches
                  ? 'border-red-500/60 focus:ring-red-500'
                  : 'border-purple-700/30 focus:ring-purple-500'
              }`}
              placeholder={confirmName}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 min-h-[48px] bg-purple-800/40 text-purple-200 rounded-lg font-semibold text-sm hover:bg-purple-800/60 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!nameMatches || loading}
              className={`flex-1 py-3 min-h-[48px] rounded-lg font-bold text-sm transition-all ${
                nameMatches && !loading
                  ? 'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]'
                  : 'bg-red-500/20 text-red-300/40 cursor-not-allowed'
              }`}
            >
              {loading ? 'Apagando...' : 'APAGAR PERMANENTEMENTE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
