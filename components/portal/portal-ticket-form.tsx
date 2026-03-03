'use client';

import { useState, useRef } from 'react';

interface PortalTicketFormProps {
  token: string;
  onCreated: (ticket: any) => void;
  onCancel: () => void;
}

export default function PortalTicketForm({ token, onCreated, onCancel }: PortalTicketFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ticketType, setTicketType] = useState('SUPORTE');
  const [priority, setPriority] = useState('NORMAL');
  const [category, setCategory] = useState('GERAL');

  // Attachments
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileAdd = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter((f) => f.size <= 50 * 1024 * 1024);
    setPendingFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileAdd(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/portal/${token}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          ticket_type: ticketType,
          priority,
          category,
        }),
      });

      if (res.ok) {
        const ticket = await res.json();

        // Upload attachments
        for (const file of pendingFiles) {
          const formData = new FormData();
          formData.append('file', file);
          try {
            await fetch(`/api/portal/${token}/tickets/${ticket.id}/attachments`, {
              method: 'POST',
              body: formData,
            });
          } catch { /* continue */ }
        }

        onCreated(ticket);
      } else {
        const d = await res.json();
        setError(d.error || 'Erro ao criar chamado');
      }
    } catch {
      setError('Erro ao criar chamado. Tente novamente.');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Titulo *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Descreva brevemente o problema ou solicitacao..."
          className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Descricao</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalhe o problema, passos para reproduzir, resultado esperado..."
          rows={5}
          className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50 resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Tipo</label>
          <select
            value={ticketType}
            onChange={(e) => setTicketType(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
          >
            <option value="SUPORTE">Suporte</option>
            <option value="BUG">Bug</option>
            <option value="TAREFA">Tarefa</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Prioridade</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
          >
            <option value="URGENTE">Urgente</option>
            <option value="ALTA">Alta</option>
            <option value="NORMAL">Normal</option>
            <option value="BAIXA">Baixa</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
          >
            <option value="GERAL">Geral</option>
            <option value="ERRO">Erro</option>
            <option value="DUVIDA">Duvida</option>
            <option value="MELHORIA">Melhoria</option>
            <option value="ENTREGA">Entrega</option>
            <option value="CONFIGURACAO">Configuracao</option>
          </select>
        </div>
      </div>

      {/* Attachments */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Anexos</label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-purple-800/30 hover:border-purple-600/40'
          }`}
        >
          <svg className="w-6 h-6 mx-auto mb-1 text-purple-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-[10px] text-neutral-500">Arraste arquivos ou clique para selecionar</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => handleFileAdd(e.target.files)}
            className="hidden"
          />
        </div>
        {pendingFiles.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {pendingFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 bg-[#160b2e] border border-purple-800/20 rounded text-xs">
                <span className="text-neutral-300 truncate flex-1">{file.name}</span>
                <span className="text-neutral-500 shrink-0">{formatFileSize(file.size)}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-neutral-500 hover:text-red-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-purple-800/20">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-5 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Enviando...' : 'Abrir Chamado'}
        </button>
      </div>
    </form>
  );
}
