'use client';

import { useState, useEffect } from 'react';
import type { FairEvent } from '@/lib/types';

interface EditEventModalProps {
  event: FairEvent;
  onClose: () => void;
  onSaved: () => void;
}

// Modal compartilhado de edição de evento. Antes estava duplicado em
// app/(dashboard)/eventos/page.tsx e app/(dashboard)/eventos/[id]/page.tsx.
// Mudanças agora acontecem em um lugar só.
export default function EditEventModal({ event, onClose, onSaved }: EditEventModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: event.name,
    location: event.location || '',
    start_date: event.start_date,
    end_date: event.end_date,
    pipeline_id: event.pipeline_id || '',
    stage_id: event.stage_id || '',
    uses_association: !!event.uses_association,
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(event.cover_image_url || null);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/pipelines').then((r) => r.json()).then((d) => setPipelines(d.pipelines || d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.pipeline_id) {
      const p = pipelines.find((p: any) => p.id === form.pipeline_id);
      setStages(p?.stages || []);
    } else {
      setStages([]);
    }
  }, [form.pipeline_id, pipelines]);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.start_date || !form.end_date) {
      setError('Preencha nome e datas');
      return;
    }
    if (!form.pipeline_id) {
      setError('Selecione uma pipeline');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let res: Response;
      if (coverFile) {
        const formData = new FormData();
        formData.append('name', form.name);
        formData.append('location', form.location);
        formData.append('start_date', form.start_date);
        formData.append('end_date', form.end_date);
        formData.append('pipeline_id', form.pipeline_id);
        formData.append('stage_id', form.stage_id);
        formData.append('uses_association', String(form.uses_association));
        formData.append('cover_image', coverFile);
        res = await fetch(`/api/events/${event.id}`, { method: 'PUT', body: formData });
      } else {
        res = await fetch(`/api/events/${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro');
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 text-sm border rounded-lg bg-[#2a1245] text-neutral-100 placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 border-purple-700/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#1e0f35] rounded-xl border border-purple-800/30 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-4">Editar Evento</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover image */}
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-1">Capa do Evento</label>
            <div className="relative">
              {coverPreview ? (
                <div className="relative h-36 rounded-lg overflow-hidden border border-purple-700/30">
                  <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setCoverFile(null);
                      setCoverPreview(null);
                    }}
                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                    aria-label="Remover capa"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-purple-700/30 rounded-lg cursor-pointer hover:border-emerald-500/30 transition-colors">
                  <svg className="w-8 h-8 text-purple-500/30 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-purple-300/40">Clique para adicionar capa</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-1">Nome *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-1">Local</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-purple-200/80 mb-1">Data Inicio *</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-200/80 mb-1">Data Fim *</label>
              <input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-1">
              Pipeline <span className="text-red-400">*</span>
            </label>
            <select
              value={form.pipeline_id}
              onChange={(e) => setForm((f) => ({ ...f, pipeline_id: e.target.value, stage_id: '' }))}
              className={inputClass}
              required
            >
              <option value="">Selecione uma pipeline</option>
              {pipelines.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {stages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-purple-200/80 mb-1">Estagio Inicial</label>
              <select
                value={form.stage_id}
                onChange={(e) => setForm((f) => ({ ...f, stage_id: e.target.value }))}
                className={inputClass}
              >
                {stages.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-start gap-3 p-3 rounded-lg bg-[#2a1245] border border-purple-700/30 cursor-pointer hover:border-cyan-500/40 transition-colors">
            <input
              type="checkbox"
              checked={form.uses_association}
              onChange={(e) => setForm((f) => ({ ...f, uses_association: e.target.checked }))}
              className="mt-0.5 rounded border-purple-700/30 bg-[#2a1245] text-cyan-500 focus:ring-cyan-500"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">Usa associacao / cooperativa?</div>
              <div className="text-xs text-purple-300/60 mt-0.5">
                Adiciona o campo "Associacao" no cadastro de contatos desta feira.
              </div>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 text-sm"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-purple-800/30 text-purple-200 rounded-lg font-medium hover:bg-purple-800/50 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
