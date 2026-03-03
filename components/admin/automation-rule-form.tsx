'use client';

import { useState } from 'react';

const TRIGGER_TYPES = [
  { value: 'STAGE_CHANGE', label: 'Mudanca de Etapa' },
  { value: 'TIME_IN_STAGE', label: 'Tempo na Etapa' },
  { value: 'NO_INTERACTION', label: 'Sem Interacao' },
  { value: 'CONTACT_CREATED', label: 'Contato Criado' },
  { value: 'VALUE_THRESHOLD', label: 'Valor Acima de' },
];

const ACTION_TYPES = [
  { value: 'MOVE_STAGE', label: 'Mover para Etapa' },
  { value: 'SEND_NOTIFICATION', label: 'Enviar Notificacao' },
  { value: 'CHANGE_TEMPERATURE', label: 'Alterar Temperatura' },
  { value: 'ASSIGN_USER', label: 'Atribuir Usuario' },
];

interface AutomationRuleFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function AutomationRuleForm({ onSubmit, onCancel, loading }: AutomationRuleFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('STAGE_CHANGE');
  const [actionType, setActionType] = useState('SEND_NOTIFICATION');
  const [triggerDays, setTriggerDays] = useState('7');
  const [triggerValue, setTriggerValue] = useState('');
  const [actionTitle, setActionTitle] = useState('');
  const [actionBody, setActionBody] = useState('');
  const [actionTemp, setActionTemp] = useState('MORNO');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const triggerConfig: Record<string, any> = {};
    if (triggerType === 'TIME_IN_STAGE' || triggerType === 'NO_INTERACTION') {
      triggerConfig.days = parseInt(triggerDays) || 7;
    }
    if (triggerType === 'VALUE_THRESHOLD') {
      triggerConfig.min_value = parseFloat(triggerValue) || 0;
    }

    const actionConfig: Record<string, any> = {};
    if (actionType === 'SEND_NOTIFICATION') {
      actionConfig.title = actionTitle || `Automacao: ${name}`;
      actionConfig.body = actionBody || '';
    }
    if (actionType === 'CHANGE_TEMPERATURE') {
      actionConfig.temperatura = actionTemp;
    }

    await onSubmit({
      name,
      description,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      action_type: actionType,
      action_config: actionConfig,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-purple-300/80 mb-1">Nome da Regra</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Ex: Notificar contato parado"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-purple-300/80 mb-1">Descricao</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Opcional"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-purple-300/80 mb-1">Gatilho</label>
          <select
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {TRIGGER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-purple-300/80 mb-1">Acao</label>
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {ACTION_TYPES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Trigger config */}
      {(triggerType === 'TIME_IN_STAGE' || triggerType === 'NO_INTERACTION') && (
        <div>
          <label className="block text-xs font-medium text-purple-300/80 mb-1">Dias</label>
          <input
            type="number"
            value={triggerDays}
            onChange={(e) => setTriggerDays(e.target.value)}
            min="1"
            className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}

      {triggerType === 'VALUE_THRESHOLD' && (
        <div>
          <label className="block text-xs font-medium text-purple-300/80 mb-1">Valor minimo (R$)</label>
          <input
            type="number"
            value={triggerValue}
            onChange={(e) => setTriggerValue(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}

      {/* Action config */}
      {actionType === 'SEND_NOTIFICATION' && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1">Titulo da notificacao</label>
            <input
              type="text"
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1">Corpo da notificacao</label>
            <input
              type="text"
              value={actionBody}
              onChange={(e) => setActionBody(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      )}

      {actionType === 'CHANGE_TEMPERATURE' && (
        <div>
          <label className="block text-xs font-medium text-purple-300/80 mb-1">Nova temperatura</label>
          <select
            value={actionTemp}
            onChange={(e) => setActionTemp(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="QUENTE">Quente</option>
            <option value="MORNO">Morno</option>
            <option value="FRIO">Frio</option>
          </select>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading || !name}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 disabled:opacity-40 transition-colors"
        >
          {loading ? 'Criando...' : 'Criar Regra'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-purple-800/30 text-purple-200 text-sm font-medium rounded-lg hover:bg-purple-800/50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
