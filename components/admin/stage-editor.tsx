'use client';

import { useState } from 'react';
import { STAGE_ICON_OPTIONS } from '@/components/kanban/kanban-column';

export interface StageEditorItem {
  id?: string;
  name: string;
  slug: string;
  color: string;
  icon?: string | null;
  position: number;
  is_terminal: boolean;
  terminal_type: 'won' | 'lost' | null;
}

interface StageEditorProps {
  stages: StageEditorItem[];
  onChange: (stages: StageEditorItem[]) => void;
}

function slugify(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export default function StageEditor({ stages, onChange }: StageEditorProps) {
  const [iconPickerIndex, setIconPickerIndex] = useState<number | null>(null);

  const addStage = () => {
    const newPos = stages.length;
    onChange([
      ...stages,
      { name: '', slug: '', color: '#a3a3a3', icon: null, position: newPos, is_terminal: false, terminal_type: null },
    ]);
  };

  const removeStage = (index: number) => {
    if (stages.length <= 1) return;
    const updated = stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i }));
    onChange(updated);
  };

  const updateStage = (index: number, field: keyof StageEditorItem, value: any) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-generate slug from name
    if (field === 'name') {
      updated[index].slug = slugify(value);
    }

    // Terminal type logic
    if (field === 'is_terminal' && !value) {
      updated[index].terminal_type = null;
    }
    if (field === 'is_terminal' && value && !updated[index].terminal_type) {
      updated[index].terminal_type = 'won';
    }

    onChange(updated);
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...stages];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated.map((s, i) => ({ ...s, position: i })));
  };

  const moveDown = (index: number) => {
    if (index >= stages.length - 1) return;
    const updated = [...stages];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated.map((s, i) => ({ ...s, position: i })));
  };

  return (
    <div className="space-y-2">
      {/* Explicacao simples */}
      <div className="p-3 bg-purple-900/20 border border-purple-700/15 rounded-lg mb-3 space-y-2">
        <p className="text-xs font-semibold text-purple-200">Como funciona?</p>
        <p className="text-[11px] text-purple-300/60 leading-relaxed">
          Cada linha abaixo vira uma <strong className="text-white">coluna no Kanban</strong>.
          A primeira etapa fica na esquerda, a ultima na direita.
          Os contatos vao sendo arrastados de coluna em coluna conforme o negocio avanca.
        </p>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-purple-700/30 flex items-center justify-center">
              <svg className="w-3 h-3 text-purple-300/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            </span>
            <span className="text-purple-300/50"><strong className="text-purple-300/80">Setas</strong> = mudar a ordem (qual coluna vem primeiro)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded" style={{background: 'linear-gradient(135deg, #f59e0b, #3b82f6)'}} />
            <span className="text-purple-300/50"><strong className="text-purple-300/80">Quadradinho colorido</strong> = cor da coluna no Kanban (clique para mudar)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-purple-700/30 flex items-center justify-center text-[8px] text-purple-300/60 font-bold">Aa</span>
            <span className="text-purple-300/50"><strong className="text-purple-300/80">Campo de texto</strong> = nome da coluna (ex: &quot;Novo&quot;, &quot;Contatado&quot;, &quot;Negociando&quot;)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-purple-700/30 flex items-center justify-center">
              <svg className="w-3 h-3 text-purple-300/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </span>
            <span className="text-purple-300/50"><strong className="text-purple-300/80">Checkbox &quot;Final&quot;</strong> = marque na ULTIMA etapa (quando o negocio acaba)</span>
          </div>
        </div>
        <div className="pt-2 border-t border-purple-700/20">
          <p className="text-[11px] text-purple-300/60 leading-relaxed">
            <strong className="text-amber-400">O que e &quot;Final&quot;?</strong> Quando um contato chega nessa etapa, ele <strong className="text-white">sai do funil</strong>.
            Existem 2 tipos: <strong className="text-emerald-400">Ganho</strong> (fechou negocio!) ou <strong className="text-red-400">Perdido</strong> (nao deu certo).
            O sistema vai pedir o motivo automaticamente.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-purple-300/60">{stages.length} etapa(s) configurada(s)</p>
        <button
          type="button"
          onClick={addStage}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          + Etapa
        </button>
      </div>

      {stages.map((stage, index) => (
        <div key={index} className={`p-3 bg-[#2a1245] rounded-lg border ${stage.is_terminal ? (stage.terminal_type === 'won' ? 'border-emerald-500/30' : 'border-red-500/30') : 'border-purple-800/20'}`}>
          <div className="flex items-center gap-2">
            {/* Reorder buttons */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="w-5 h-5 flex items-center justify-center text-purple-400/40 hover:text-purple-300 disabled:opacity-20 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => moveDown(index)}
                disabled={index === stages.length - 1}
                className="w-5 h-5 flex items-center justify-center text-purple-400/40 hover:text-purple-300 disabled:opacity-20 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Position badge */}
            <span className="text-[10px] font-bold text-purple-300/30 w-4 text-center shrink-0">{index + 1}</span>

            {/* Color picker */}
            <input
              type="color"
              value={stage.color}
              onChange={(e) => updateStage(index, 'color', e.target.value)}
              className="w-8 h-8 rounded border border-purple-700/30 cursor-pointer p-0.5 shrink-0"
            />

            {/* Icon picker */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIconPickerIndex(iconPickerIndex === index ? null : index)}
                className="w-8 h-8 rounded border border-purple-700/30 bg-[#1e0f35] flex items-center justify-center hover:border-purple-500/50 transition-colors"
                title="Icone da etapa"
              >
                <svg className="w-4 h-4" style={{ color: stage.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stage.icon && STAGE_ICON_OPTIONS[stage.icon] ? STAGE_ICON_OPTIONS[stage.icon].path : 'M13 10V3L4 14h7v7l9-11h-7z'} />
                </svg>
              </button>
              {iconPickerIndex === index && (
                <div className="absolute top-10 left-0 z-50 bg-[#1e0f35] border border-purple-700/30 rounded-xl p-2 shadow-2xl shadow-purple-900/50 grid grid-cols-4 gap-1 w-52">
                  {Object.entries(STAGE_ICON_OPTIONS).map(([key, { label, path }]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { updateStage(index, 'icon', key); setIconPickerIndex(null); }}
                      className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors ${
                        stage.icon === key ? 'bg-emerald-500/20 ring-1 ring-emerald-500/40' : 'hover:bg-purple-700/30'
                      }`}
                      title={label}
                    >
                      <svg className="w-4 h-4 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
                      </svg>
                      <span className="text-[8px] text-purple-300/50">{label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { updateStage(index, 'icon', null); setIconPickerIndex(null); }}
                    className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors ${
                      !stage.icon ? 'bg-emerald-500/20 ring-1 ring-emerald-500/40' : 'hover:bg-purple-700/30'
                    }`}
                    title="Auto (baseado no nome)"
                  >
                    <svg className="w-4 h-4 text-purple-300/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="text-[8px] text-purple-300/50">Auto</span>
                  </button>
                </div>
              )}
            </div>

            {/* Name */}
            <input
              type="text"
              value={stage.name}
              onChange={(e) => updateStage(index, 'name', e.target.value)}
              placeholder={index === 0 ? 'Ex: Novo' : index === stages.length - 1 ? 'Ex: Fechado' : 'Ex: Em Negociacao'}
              className="flex-1 px-2.5 py-1.5 text-sm bg-[#1e0f35] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/50 min-w-0"
            />

            {/* Terminal toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stage.is_terminal}
                  onChange={(e) => updateStage(index, 'is_terminal', e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-purple-700/30 bg-[#1e0f35] text-emerald-500 focus:ring-emerald-500/50"
                />
                <span className="text-[10px] text-purple-300/50">Final</span>
              </label>

              {stage.is_terminal && (
                <select
                  value={stage.terminal_type || 'won'}
                  onChange={(e) => updateStage(index, 'terminal_type', e.target.value)}
                  className="text-[10px] bg-[#1e0f35] border border-purple-700/30 text-neutral-200 rounded px-1.5 py-1 focus:outline-none"
                >
                  <option value="won">Ganho</option>
                  <option value="lost">Perdido</option>
                </select>
              )}
            </div>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => removeStage(index)}
              disabled={stages.length <= 1}
              className="w-7 h-7 flex items-center justify-center text-red-400/40 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-20 shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Label below for terminal stages */}
          {stage.is_terminal && (
            <p className={`mt-1.5 ml-[52px] text-[10px] ${stage.terminal_type === 'won' ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
              {stage.terminal_type === 'won'
                ? 'Etapa final — negocio FECHADO com sucesso'
                : 'Etapa final — oportunidade PERDIDA'}
            </p>
          )}
        </div>
      ))}

      {/* Preview bar */}
      <div className="mt-3 pt-3 border-t border-purple-800/20">
        <p className="text-[10px] text-purple-300/40 mb-1.5">Assim vai ficar o seu Kanban:</p>
        <div className="flex gap-1">
          {stages.map((stage, i) => (
            <div
              key={i}
              className={`flex-1 h-9 rounded-md flex flex-col items-center justify-center text-white truncate px-1 ${stage.is_terminal ? 'ring-1 ring-white/20' : ''}`}
              style={{ backgroundColor: stage.color || '#a3a3a3' }}
            >
              <span className="text-[10px] font-medium">{stage.name || '...'}</span>
              {stage.is_terminal && (
                <span className="text-[8px] opacity-70">
                  {stage.terminal_type === 'won' ? '(ganho)' : '(perdido)'}
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="text-[9px] text-purple-300/30 mt-1 text-center">
          ← contatos entram pela esquerda e vao avancando ate a etapa final →
        </p>
      </div>
    </div>
  );
}
