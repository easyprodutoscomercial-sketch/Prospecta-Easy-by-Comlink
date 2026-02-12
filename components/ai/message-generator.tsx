'use client';

import { useState } from 'react';
import { MessageChannel, MessageIntent } from '@/lib/ai/types';

const CHANNELS: { value: MessageChannel; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'ligacao', label: 'Ligacao' },
];

const INTENTS: { value: MessageIntent; label: string }[] = [
  { value: 'primeiro_contato', label: 'Primeiro contato' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'reagendar', label: 'Reagendar reuniao' },
  { value: 'enviar_proposta', label: 'Enviar proposta' },
  { value: 'cobrar_retorno', label: 'Cobrar retorno' },
  { value: 'pos_reuniao', label: 'Pos-reuniao' },
  { value: 'reativacao', label: 'Reativacao' },
];

interface MessageGeneratorProps {
  contactId: string;
}

export default function MessageGenerator({ contactId }: MessageGeneratorProps) {
  const [channel, setChannel] = useState<MessageChannel>('whatsapp');
  const [intent, setIntent] = useState<MessageIntent>('follow_up');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ subject?: string; body: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/ai/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId, channel, intent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar mensagem');
      setResult({ subject: data.subject, body: data.body });
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = result.subject ? `Assunto: ${result.subject}\n\n${result.body}` : result.body;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        Gerador de Mensagem IA
      </h4>

      <div className="flex flex-wrap gap-2">
        {/* Channel selector */}
        <div className="flex-1 min-w-[120px]">
          <label className="text-[11px] text-neutral-500 block mb-1">Canal</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as MessageChannel)}
            className="w-full px-2.5 py-1.5 text-xs bg-[#120826] border border-purple-800/30 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
          >
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Intent selector */}
        <div className="flex-1 min-w-[140px]">
          <label className="text-[11px] text-neutral-500 block mb-1">Intencao</label>
          <select
            value={intent}
            onChange={(e) => setIntent(e.target.value as MessageIntent)}
            className="w-full px-2.5 py-1.5 text-xs bg-[#120826] border border-purple-800/30 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
          >
            {INTENTS.map((i) => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full px-4 py-2 text-xs font-semibold bg-gradient-to-r from-emerald-500/20 to-purple-500/20 text-emerald-400 rounded-lg hover:from-emerald-500/30 hover:to-purple-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-emerald-500/20"
      >
        {loading ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Gerar com IA
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-2">
          {result.subject && (
            <div className="px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg">
              <span className="text-[10px] text-neutral-500">Assunto:</span>
              <p className="text-xs text-white">{result.subject}</p>
            </div>
          )}
          <div className="px-3 py-2 bg-[#120826] border border-purple-800/30 rounded-lg">
            <p className="text-xs text-neutral-200 whitespace-pre-wrap">{result.body}</p>
          </div>
          <button
            onClick={handleCopy}
            className="w-full px-3 py-1.5 text-xs font-semibold bg-purple-500/10 text-purple-300 rounded-lg hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-1.5"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copiado!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copiar mensagem
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
