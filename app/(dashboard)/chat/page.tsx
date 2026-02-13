'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: {
    notificationsSent: number;
    searchesPerformed: number;
  };
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Initial greeting
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      sendMessage(null, []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = async (userMessage: string | null, currentHistory: Message[]) => {
    let updatedMessages = [...currentHistory];

    if (userMessage) {
      const userMsg: Message = { role: 'user', content: userMessage };
      updatedMessages = [...updatedMessages, userMsg];
      setMessages(updatedMessages);
    }

    setLoading(true);
    setLoadingStatus('Analisando...');

    // Animate loading status
    const statusInterval = setTimeout(() => setLoadingStatus('Consultando pipeline...'), 2000);
    const statusInterval2 = setTimeout(() => setLoadingStatus('Processando...'), 5000);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage || '',
          history: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error('Erro na resposta');

      const data = await res.json();
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.reply,
        actions: data.actions ? {
          notificationsSent: data.actions.notificationsSent || 0,
          searchesPerformed: data.actions.searchesPerformed || 0,
        } : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errorMsg: Message = {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      clearTimeout(statusInterval);
      clearTimeout(statusInterval2);
      setLoading(false);
      setLoadingStatus('');
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput('');
    sendMessage(trimmed, messages);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen -mx-4 -my-6 sm:-mx-6 sm:-my-8 lg:-mx-10 lg:-my-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-purple-500/15 bg-[#120826]/80 backdrop-blur-sm">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Assistente IA</h1>
          <p className="text-xs text-purple-300/50">Notifica responsaveis · Pesquisa na internet · Analisa pipeline</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? '' : 'flex flex-col gap-2'}`}>
              {/* Action badges - before assistant message */}
              {msg.role === 'assistant' && msg.actions && (msg.actions.notificationsSent > 0 || msg.actions.searchesPerformed > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {msg.actions.notificationsSent > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {msg.actions.notificationsSent} notificacao{msg.actions.notificationsSent > 1 ? 'es' : ''} enviada{msg.actions.notificationsSent > 1 ? 's' : ''}
                    </span>
                  )}
                  {msg.actions.searchesPerformed > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Pesquisa web realizada
                    </span>
                  )}
                </div>
              )}

              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-emerald-600/90 text-white rounded-br-md'
                    : 'bg-purple-900/50 text-purple-100 border border-purple-500/20 rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-purple-900/50 border border-purple-500/20 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-purple-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-purple-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-purple-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                {loadingStatus && (
                  <span className="text-[11px] text-purple-400/50 ml-1">{loadingStatus}</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion chips (only when no user messages yet) */}
      {messages.length <= 1 && !loading && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2 max-w-4xl mx-auto">
            {[
              'Quais contatos estao parados?',
              'Notifique os responsaveis dos contatos parados',
              'Quais contatos nao tem responsavel?',
              'O que devo priorizar hoje?',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setInput('');
                  sendMessage(suggestion, messages);
                }}
                className="text-xs px-3 py-1.5 rounded-full border border-purple-500/20 text-purple-300/60 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-purple-500/15 bg-[#120826]/80 backdrop-blur-sm px-4 py-3">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: notifique os responsaveis, pesquise sobre o setor X, o que fazer hoje..."
            rows={1}
            className="flex-1 bg-purple-900/30 border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-purple-300/40 resize-none focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="shrink-0 w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-purple-800/50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-purple-400/30 text-center mt-2">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
