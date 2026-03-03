'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Profile, SupportProject } from '@/lib/types';
import { useToast } from '@/lib/toast-context';

interface ContactOption {
  id: string;
  name: string;
}

export default function SuporteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [projects, setProjects] = useState<SupportProject[]>([]);

  const initialType = searchParams.get('type') || 'SUPORTE';
  const initialProject = searchParams.get('project_id') || '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ticketType, setTicketType] = useState(initialType);
  const [category, setCategory] = useState('GERAL');
  const [priority, setPriority] = useState('NORMAL');
  const [severity, setSeverity] = useState('MEDIO');
  const [assignedTo, setAssignedTo] = useState('');
  const [contactId, setContactId] = useState('');
  const [projectId, setProjectId] = useState(initialProject);
  const [dueDate, setDueDate] = useState('');

  // Attachment drag-and-drop
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, projectsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/suporte/projects'),
        ]);
        if (usersRes.ok) { const d = await usersRes.json(); setUsers(d.users || []); }
        if (projectsRes.ok) { const d = await projectsRes.json(); setProjects(d.projects || []); }
      } catch { /* silent */ }
    };
    load();
  }, []);

  useEffect(() => {
    if (contactSearch.length < 2) { setContacts([]); return; }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts?search=${encodeURIComponent(contactSearch)}&limit=10`);
        if (res.ok) {
          const d = await res.json();
          setContacts((d.contacts || []).map((c: any) => ({ id: c.id, name: c.name })));
        }
      } catch { /* silent */ }
    }, 300);
    return () => clearTimeout(timeout);
  }, [contactSearch]);

  const handleFileAdd = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter(
      (f) => f.size <= 50 * 1024 * 1024 // max 50MB each
    );
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

  const uploadAttachments = async (ticketId: string) => {
    for (const file of pendingFiles) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        await fetch(`/api/suporte/${ticketId}/attachments`, {
          method: 'POST',
          body: formData,
        });
      } catch {
        // continue with other files
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/suporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          ticket_type: ticketType,
          category,
          priority,
          severity: ticketType === 'BUG' ? severity : null,
          assigned_to: assignedTo || null,
          contact_id: contactId || null,
          project_id: projectId || null,
          due_date: dueDate || null,
        }),
      });
      if (res.ok) {
        const ticket = await res.json();
        // Upload pending attachments
        if (pendingFiles.length > 0) {
          await uploadAttachments(ticket.id);
        }
        toast.success('Chamado criado com sucesso');
        router.push(`/suporte/${ticket.id}`);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erro ao criar chamado');
      }
    } catch {
      toast.error('Erro ao criar chamado');
    }
    setSaving(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Titulo *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Descreva o chamado brevemente..."
          className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/20"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Descricao</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalhes do chamado..."
          rows={5}
          className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/20 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Tipo</label>
          <select
            value={ticketType}
            onChange={(e) => setTicketType(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
          >
            <option value="SUPORTE">Suporte</option>
            <option value="TAREFA">Tarefa</option>
            <option value="BUG">Bug</option>
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

      <div className="grid grid-cols-2 gap-4">
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
        {ticketType === 'BUG' && (
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Severidade</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
            >
              <option value="CRITICO">Critico</option>
              <option value="ALTO">Alto</option>
              <option value="MEDIO">Medio</option>
              <option value="BAIXO">Baixo</option>
            </select>
          </div>
        )}
        {ticketType !== 'BUG' && (
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Data Limite</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
            />
          </div>
        )}
      </div>

      {ticketType === 'BUG' && (
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Data Limite</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Responsavel</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
          >
            <option value="">Nenhum</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Projeto</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-600/50"
          >
            <option value="">Nenhum</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Contact search */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Contato (opcional)</label>
        {contactId ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#160b2e] border border-purple-800/30 rounded-lg">
            <svg className="w-4 h-4 text-purple-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-sm text-neutral-200 flex-1">
              {contacts.find((c) => c.id === contactId)?.name || contactSearch}
            </span>
            <button
              type="button"
              onClick={() => { setContactId(''); setContactSearch(''); }}
              className="text-neutral-500 hover:text-neutral-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Buscar contato pelo nome..."
              className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50"
            />
            {contacts.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-[#1e0f35] border border-purple-800/30 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                {contacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setContactId(c.id); setContactSearch(c.name); setContacts([]); }}
                    className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-purple-800/20 transition-colors"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attachments drag-and-drop */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Anexos</label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-purple-800/30 hover:border-purple-600/40 hover:bg-purple-800/5'
          }`}
        >
          <svg className="w-8 h-8 mx-auto mb-2 text-purple-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-xs text-neutral-500">Arraste arquivos aqui ou clique para selecionar</p>
          <p className="text-[10px] text-neutral-600 mt-0.5">Maximo 50MB por arquivo</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => handleFileAdd(e.target.files)}
            className="hidden"
          />
        </div>

        {pendingFiles.length > 0 && (
          <div className="mt-2 space-y-1">
            {pendingFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-[#160b2e] border border-purple-800/20 rounded-lg">
                <svg className="w-4 h-4 text-purple-400/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-xs text-neutral-300 truncate flex-1">{file.name}</span>
                <span className="text-[10px] text-neutral-500 shrink-0">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="text-neutral-500 hover:text-red-400 shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-purple-800/20">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-6 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Criando...' : 'Criar Chamado'}
        </button>
      </div>
    </form>
  );
}
