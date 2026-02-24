'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PipelineCustomField, CustomFieldType } from '@/lib/types';
import { useToast } from '@/lib/toast-context';

interface CustomFieldEditorProps {
  pipelineId: string;
}

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Texto',
  number: 'Numero',
  date: 'Data',
  select: 'Lista',
  boolean: 'Sim/Nao',
};

const FIELD_TYPE_COLORS: Record<CustomFieldType, string> = {
  text: 'bg-blue-500/15 text-blue-400',
  number: 'bg-amber-500/15 text-amber-400',
  date: 'bg-purple-500/15 text-purple-400',
  select: 'bg-emerald-500/15 text-emerald-400',
  boolean: 'bg-cyan-500/15 text-cyan-400',
};

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export default function CustomFieldEditor({ pipelineId }: CustomFieldEditorProps) {
  const toast = useToast();
  const [fields, setFields] = useState<PipelineCustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // New field form
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newType, setNewType] = useState<CustomFieldType>('text');
  const [newOptions, setNewOptions] = useState('');
  const [newRequired, setNewRequired] = useState(false);

  const loadFields = useCallback(async () => {
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/custom-fields`);
      if (res.ok) {
        setFields(await res.json());
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [pipelineId]);

  useEffect(() => { loadFields(); }, [loadFields]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/custom-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug || slugify(newName),
          field_type: newType,
          options: newType === 'select' ? newOptions.split(',').map(o => o.trim()).filter(Boolean) : null,
          is_required: newRequired,
          position: fields.length,
        }),
      });
      if (res.ok) {
        toast.success('Campo criado');
        setNewName('');
        setNewSlug('');
        setNewType('text');
        setNewOptions('');
        setNewRequired(false);
        setShowForm(false);
        loadFields();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao criar campo');
      }
    } catch {
      toast.error('Erro ao criar campo');
    }
    setSaving(false);
  };

  const handleDelete = async (fieldId: string) => {
    if (!confirm('Excluir este campo? Os valores salvos serao perdidos.')) return;
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/custom-fields/${fieldId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Campo excluido');
        loadFields();
      }
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  if (loading) {
    return <div className="text-xs text-purple-300/40 py-2">Carregando campos...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-purple-300/70 uppercase tracking-wider">Campos Personalizados</h4>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Adicionar campo'}
        </button>
      </div>

      {/* Existing fields */}
      {fields.length > 0 && (
        <div className="space-y-1.5">
          {fields.map((field) => (
            <div key={field.id} className="flex items-center gap-2 px-3 py-2 bg-[#2a1245]/50 rounded-lg">
              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${FIELD_TYPE_COLORS[field.field_type]}`}>
                {FIELD_TYPE_LABELS[field.field_type]}
              </span>
              <span className="text-xs text-neutral-200 flex-1 truncate">{field.name}</span>
              {field.is_required && (
                <span className="text-[9px] text-red-400/60 font-medium">Obrigatorio</span>
              )}
              <button
                onClick={() => handleDelete(field.id)}
                className="text-red-400/40 hover:text-red-400 transition-colors p-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {fields.length === 0 && !showForm && (
        <p className="text-[11px] text-purple-300/30">Nenhum campo personalizado</p>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-[#2a1245]/30 border border-purple-800/20 rounded-lg p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-purple-300/50 block mb-1">Nome</label>
              <input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setNewSlug(slugify(e.target.value));
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-[#2a1245] border border-purple-800/30 rounded-lg text-neutral-200 focus:outline-none focus:border-emerald-500/50"
                placeholder="Ex: Faturamento Anual"
              />
            </div>
            <div>
              <label className="text-[10px] text-purple-300/50 block mb-1">Slug</label>
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-[#2a1245] border border-purple-800/30 rounded-lg text-neutral-300/60 focus:outline-none focus:border-emerald-500/50"
                placeholder="faturamento_anual"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-purple-300/50 block mb-1">Tipo</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as CustomFieldType)}
                className="w-full px-2.5 py-1.5 text-xs bg-[#2a1245] border border-purple-800/30 rounded-lg text-neutral-200 focus:outline-none focus:border-emerald-500/50"
              >
                {Object.entries(FIELD_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRequired}
                  onChange={(e) => setNewRequired(e.target.checked)}
                  className="rounded border-purple-800/30 bg-[#2a1245] text-emerald-500 focus:ring-emerald-500/30"
                />
                <span className="text-xs text-purple-300/60">Obrigatorio</span>
              </label>
            </div>
          </div>
          {newType === 'select' && (
            <div>
              <label className="text-[10px] text-purple-300/50 block mb-1">Opcoes (separadas por virgula)</label>
              <input
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-[#2a1245] border border-purple-800/30 rounded-lg text-neutral-200 focus:outline-none focus:border-emerald-500/50"
                placeholder="Opcao 1, Opcao 2, Opcao 3"
              />
            </div>
          )}
          <button
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className="px-4 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-40 transition-colors"
          >
            {saving ? 'Salvando...' : 'Criar Campo'}
          </button>
        </div>
      )}
    </div>
  );
}
