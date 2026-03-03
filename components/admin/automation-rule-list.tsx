'use client';

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  action_type: string;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  STAGE_CHANGE: 'Mudanca de Etapa',
  TIME_IN_STAGE: 'Tempo na Etapa',
  NO_INTERACTION: 'Sem Interacao',
  CONTACT_CREATED: 'Contato Criado',
  VALUE_THRESHOLD: 'Valor Acima de',
};

const ACTION_LABELS: Record<string, string> = {
  MOVE_STAGE: 'Mover Etapa',
  SEND_NOTIFICATION: 'Notificacao',
  CHANGE_TEMPERATURE: 'Mudar Temperatura',
  ASSIGN_USER: 'Atribuir Usuario',
};

interface AutomationRuleListProps {
  rules: AutomationRule[];
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}

export function AutomationRuleList({ rules, onToggle, onDelete }: AutomationRuleListProps) {
  if (rules.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-purple-300/40">Nenhuma regra de automacao criada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <div key={rule.id} className="flex items-center gap-3 p-3 bg-[#2a1245] rounded-lg">
          {/* Toggle */}
          <button
            onClick={() => onToggle(rule.id, !rule.is_active)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              rule.is_active ? 'bg-emerald-500' : 'bg-purple-800/50'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                rule.is_active ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-100 truncate">{rule.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-800/30 text-purple-300/60">
                {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
              </span>
              <svg className="w-3 h-3 text-purple-300/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80">
                {ACTION_LABELS[rule.action_type] || rule.action_type}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="text-right shrink-0">
            <p className="text-xs text-purple-300/50">{rule.run_count}x executada</p>
            {rule.last_run_at && (
              <p className="text-[10px] text-purple-300/30">
                {new Date(rule.last_run_at).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={() => onDelete(rule.id)}
            className="text-red-400/60 hover:text-red-400 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
