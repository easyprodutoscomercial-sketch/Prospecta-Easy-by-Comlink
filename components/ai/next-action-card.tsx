'use client';

import { useState } from 'react';
import { ActionSuggestion } from '@/lib/ai/types';
import { PROXIMA_ACAO_LABELS } from '@/lib/utils/labels';

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'border-emerald-500/30 bg-emerald-500/5',
  MEDIUM: 'border-amber-500/30 bg-amber-500/5',
  LOW: 'border-blue-500/30 bg-blue-500/5',
};

const ACTION_ICONS: Record<string, string> = {
  LIGAR: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  ENVIAR_WHATSAPP: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  ENVIAR_EMAIL: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  REUNIAO: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  FOLLOW_UP: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  ENVIAR_PROPOSTA: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  VISITA: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
  OUTRO: 'M13 10V3L4 14h7v7l9-11h-7z',
};

interface NextActionCardProps {
  suggestion: ActionSuggestion;
  onApply: (action: string, date?: string) => void;
  loading?: boolean;
}

export default function NextActionCard({ suggestion, onApply, loading }: NextActionCardProps) {
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    setApplying(true);
    // Set action for tomorrow by default
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await onApply(suggestion.action, dateStr);
    setApplying(false);
  };

  const iconPath = ACTION_ICONS[suggestion.action] || ACTION_ICONS.OUTRO;
  const priorityStyle = PRIORITY_STYLES[suggestion.priority] || PRIORITY_STYLES.MEDIUM;

  return (
    <div className={`rounded-lg border p-3 ${priorityStyle}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">
            {PROXIMA_ACAO_LABELS[suggestion.action] || suggestion.action}
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">{suggestion.reason}</p>
        </div>
        <button
          onClick={handleApply}
          disabled={applying || loading}
          className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
        >
          {applying ? 'Aplicando...' : 'Aplicar'}
        </button>
      </div>
    </div>
  );
}
