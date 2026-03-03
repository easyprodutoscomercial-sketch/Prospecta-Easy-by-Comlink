'use client';

import { useState } from 'react';
import type { SupportComment } from '@/lib/types';
import { useToast } from '@/lib/toast-context';
import { getUserInitials } from '@/lib/utils/user-colors';

interface SuporteCommentsProps {
  ticketId: string;
  comments: SupportComment[];
  setComments: React.Dispatch<React.SetStateAction<SupportComment[]>>;
}

export default function SuporteComments({ ticketId, comments, setComments }: SuporteCommentsProps) {
  const toast = useToast();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/suporte/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [...prev, comment]);
        setContent('');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erro ao comentar');
      }
    } catch {
      toast.error('Erro ao comentar');
    }
    setSending(false);
  };

  return (
    <div>
      {/* Comments list */}
      <div className="space-y-3 mb-4">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={`p-3 rounded-lg ${
              comment.is_status_change
                ? 'bg-amber-500/5 border border-amber-500/10'
                : 'bg-[#160b2e] border border-purple-800/15'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              {comment.is_status_change ? (
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ) : (
                <div className="w-5 h-5 rounded-full bg-purple-700 flex items-center justify-center text-[8px] font-bold text-white">
                  {getUserInitials(comment.user_name || '?')}
                </div>
              )}
              <span className="text-xs font-medium text-neutral-300">{comment.user_name || 'Usuario'}</span>
              <span className="text-[10px] text-neutral-600 ml-auto">
                {new Date(comment.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className={`text-sm ${comment.is_status_change ? 'text-amber-300/70 italic' : 'text-neutral-300'}`}>
              {comment.content}
            </p>
          </div>
        ))}

        {comments.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-neutral-500">Nenhum comentario</p>
          </div>
        )}
      </div>

      {/* Add comment */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva um comentario..."
          className="flex-1 px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50"
        />
        <button
          type="submit"
          disabled={!content.trim() || sending}
          className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {sending ? '...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
