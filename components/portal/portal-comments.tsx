'use client';

import { useState } from 'react';

interface Comment {
  id: string;
  user_name: string;
  content: string;
  is_status_change: boolean;
  created_at: string;
}

interface PortalCommentsProps {
  token: string;
  ticketId: string;
  comments: Comment[];
  onNewComment: (comment: Comment) => void;
}

export default function PortalComments({ token, ticketId, comments, onNewComment }: PortalCommentsProps) {
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/portal/${token}/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          author_name: authorName.trim() || undefined,
        }),
      });

      if (res.ok) {
        const comment = await res.json();
        onNewComment(comment);
        setContent('');
      }
    } catch { /* silent */ }
    setSaving(false);
  };

  return (
    <div>
      <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
        Comentarios ({comments.length})
      </h3>

      {/* Comment list */}
      <div className="space-y-3 mb-4">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={`px-3 py-2.5 rounded-lg ${
              comment.is_status_change
                ? 'bg-purple-800/10 border border-purple-800/15'
                : 'bg-[#160b2e] border border-purple-800/20'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-neutral-300">{comment.user_name}</span>
              <span className="text-[10px] text-neutral-500">
                {new Date(comment.created_at).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <p className={`text-sm whitespace-pre-wrap ${
              comment.is_status_change ? 'text-purple-300/60 italic' : 'text-neutral-300'
            }`}>
              {comment.content}
            </p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-xs text-neutral-600 text-center py-4">Nenhum comentario ainda</p>
        )}
      </div>

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Seu nome (opcional)"
          className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva um comentario..."
          rows={3}
          className="w-full px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50 resize-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !content.trim()}
            className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Enviando...' : 'Comentar'}
          </button>
        </div>
      </form>
    </div>
  );
}
