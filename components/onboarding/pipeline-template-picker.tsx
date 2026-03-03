'use client';

import { PIPELINE_TEMPLATES, type PipelineTemplate } from '@/lib/data/pipeline-templates';

interface PipelineTemplatePickerProps {
  onSelect: (template: PipelineTemplate) => void;
  onClose: () => void;
}

export function PipelineTemplatePicker({ onSelect, onClose }: PipelineTemplatePickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-100">Escolher Template de Pipeline</h2>
          <button onClick={onClose} className="text-purple-300/40 hover:text-purple-300/60">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PIPELINE_TEMPLATES.map((template) => (
            <button
              key={template.name}
              onClick={() => onSelect(template)}
              className="text-left p-4 bg-[#2a1245] border border-purple-800/20 rounded-lg hover:border-emerald-500/30 hover:bg-[#2a1245]/80 transition-all"
            >
              <h3 className="text-sm font-medium text-neutral-100 mb-1">{template.name}</h3>
              <p className="text-[10px] text-purple-300/50 mb-2">{template.description}</p>
              <div className="flex flex-wrap gap-1">
                {template.stages.map((stage) => (
                  <span
                    key={stage.slug}
                    className="text-[9px] px-1.5 py-0.5 rounded-full text-white/80 font-medium"
                    style={{ backgroundColor: stage.color }}
                  >
                    {stage.name}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
