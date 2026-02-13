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

interface AiChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AiChatPanel({ isOpen, onClose }: AiChatPanelProps) {
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

  // Initial greeting when panel first opens
  useEffect(() => {
    if (isOpen && !initialized) {
      setInitialized(true);
      sendMessage(null, []);
    }
  }, [isOpen, initialized]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = async (userMessage: string | null, currentHistory: Message[]) => {
    let updatedMessages = [...currentHistory];

    if (userMessage) {
      const userMsg: Message = { role: 'user', content: userMessage };
      updatedMessages = [...updatedMessages, userMsg];
      setMessages(updatedMessages);
    }

    setLoading(true);
    setLoadingStatus('Analisando...');

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
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 flex flex-col bg-[#120826] border-l border-purple-500/20 shadow-2xl shadow-purple-900/50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } w-full sm:w-[420px]`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-purple-500/15 bg-[#120826]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Assistente IA</h2>
              <p className="text-[10px] text-purple-300/40">Pipeline · Notificacoes · Pesquisa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-purple-300/50 hover:text-white hover:bg-purple-500/20 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] ${msg.role === 'user' ? '' : 'flex flex-col gap-1.5'}`}>
                {/* Action badges */}
                {msg.role === 'assistant' && msg.actions && (msg.actions.notificationsSent > 0 || msg.actions.searchesPerformed > 0) && (
                  <div className="flex flex-wrap gap-1 mb-0.5">
                    {msg.actions.notificationsSent > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        {msg.actions.notificationsSent} notificacao{msg.actions.notificationsSent > 1 ? 'es' : ''} enviada{msg.actions.notificationsSent > 1 ? 's' : ''}
                      </span>
                    )}
                    {msg.actions.searchesPerformed > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Pesquisa web
                      </span>
                    )}
                  </div>
                )}

                <div
                  className={`px-3 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-emerald-600/90 text-white rounded-br-md'
                      : 'bg-purple-900/40 text-purple-100 border border-purple-500/15 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-purple-900/40 border border-purple-500/15 px-3 py-2.5 rounded-2xl rounded-bl-md">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-purple-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  {loadingStatus && (
                    <span className="text-[10px] text-purple-400/40 ml-1">{loadingStatus}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion chips */}
        {messages.length <= 1 && !loading && (
          <div className="px-3 pb-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                'Contatos parados?',
                'Notificar responsaveis',
                'Sem responsavel?',
                'Priorizar hoje?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput('');
                    sendMessage(suggestion, messages);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-purple-500/20 text-purple-300/50 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-purple-500/15 bg-[#120826] px-3 py-2.5">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre o pipeline..."
              rows={1}
              className="flex-1 bg-purple-900/30 border border-purple-500/20 rounded-xl px-3 py-2 text-[13px] text-white placeholder-purple-300/30 resize-none focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="shrink-0 w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-purple-800/50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-[9px] text-purple-400/25 text-center mt-1.5">
            Enter enviar · Shift+Enter nova linha
          </p>
        </div>
      </div>
    </>
  );
}
