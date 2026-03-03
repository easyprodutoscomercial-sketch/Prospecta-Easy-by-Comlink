'use client';

import { useState, useEffect } from 'react';
import type { SupportProject } from '@/lib/types';
import { useToast } from '@/lib/toast-context';

interface ContactOption {
  id: string;
  name: string;
}

interface SuporteProjectFormProps {
  project?: SupportProject | null;
  onSave: (project: SupportProject) => void;
  onCancel: () => void;
}

export default function SuporteProjectForm({ project, onSave, onCancel }: SuporteProjectFormProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [contactId, setContactId] = useState(project?.contact_id || '');
  const [contactSearch, setContactSearch] = useState(project?.contact_name || '');
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [isActive, setIsActive] = useState(project?.is_active ?? true);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    try {
      const url = project ? `/api/suporte/projects/${project.id}` : '/api/suporte/projects';
      const method = project ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          contact_id: contactId || null,
          is_active: isActive,
        }),
      });

      if (res.ok) {
        const saved = await res.json();
        toast.success(project ? 'Projeto atualizado' : 'Projeto criado');
        onSave(saved);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erro ao salvar projeto');
      }
    } catch {
      toast.error('Erro ao salvar projeto');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Nome do Projeto *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: App Mobile v2, Website Redesign..."
          className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Descricao</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descricao do projeto..."
          rows={3}
          className="w-full px-3 py-2.5 bg-[#160b2e] border border-purple-800/30 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-600/50 resize-none"
        />
      </div>

      {/* Contact search */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">Contato (cliente)</label>
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
              placeholder="Buscar contato..."
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

      {project && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-purple-800/30 bg-[#160b2e] text-emerald-500 focus:ring-purple-600/20"
          />
          <label htmlFor="is_active" className="text-sm text-neutral-300">Projeto ativo</label>
        </div>
      )}

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
          disabled={saving || !name.trim()}
          className="px-5 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Salvando...' : (project ? 'Salvar' : 'Criar Projeto')}
        </button>
      </div>
    </form>
  );
}
