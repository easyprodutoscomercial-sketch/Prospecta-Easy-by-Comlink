'use client';

import { useState } from 'react';
import { Interaction } from '@/lib/types';
import {
  formatInteractionType,
  formatInteractionOutcome,
  INTERACTION_TYPE_LABELS,
  INTERACTION_OUTCOME_LABELS,
  ACTIVITY_TEMPLATES,
} from '@/lib/utils/labels';
import ConfirmModal from '@/components/ui/confirm-modal';
import { useToast } from '@/lib/toast-context';

interface ContactInteractionsProps {
  contactId: string;
  interactions: Interaction[];
  setInteractions: React.Dispatch<React.SetStateAction<Interaction[]>>;
  canModify: boolean;
}

export default function ContactInteractions({ contactId, interactions, setInteractions, canModify }: ContactInteractionsProps) {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [newInteraction, setNewInteraction] = useState({ type: 'LIGACAO' as string, outcome: 'SEM_RESPOSTA' as string, note: '', happened_at: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ type: '', outcome: '', note: '', happened_at: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const inputCls = 'w-full px-3 py-2 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  const handleQuickTemplate = async (tpl: typeof ACTIVITY_TEMPLATES[number]) => {
    const r = await fetch('/api/interactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contactId, type: tpl.type, outcome: tpl.outcome, note: tpl.note }) });
    if (r.ok) { const created = await r.json(); setInteractions((p) => [created, ...p]); toast.success('Interacao registrada'); }
    else { const d = await r.json(); toast.error(d.error || 'Erro'); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, any> = { contact_id: contactId, type: newInteraction.type, outcome: newInteraction.outcome, note: newInteraction.note || null };
    if (newInteraction.happened_at) body.happened_at = new Date(newInteraction.happened_at).toISOString();
    const r = await fetch('/api/interactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { const created = await r.json(); setInteractions((p) => [created, ...p]); toast.success('Interacao adicionada'); }
    else { const d = await r.json(); toast.error(d.error || 'Erro'); }
    setNewInteraction({ type: 'LIGACAO', outcome: 'SEM_RESPOSTA', note: '', happened_at: '' }); setShowForm(false);
  };

  const startEdit = (i: Interaction) => {
    setEditingId(i.id);
    setEditData({ type: i.type, outcome: i.outcome, note: i.note || '', happened_at: i.happened_at ? new Date(i.happened_at).toISOString().slice(0, 16) : '' });
  };

  const handleSave = async () => {
    if (!editingId) return;
    setActionLoading(true);
    const body: Record<string, any> = { type: editData.type, outcome: editData.outcome, note: editData.note || null };
    if (editData.happened_at) body.happened_at = new Date(editData.happened_at).toISOString();
    const r = await fetch(`/api/interactions/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { const u = await r.json(); setInteractions((p) => p.map((i) => (i.id === editingId ? u : i))); toast.success('Atualizada'); }
    else toast.error('Erro');
    setEditingId(null); setActionLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setActionLoading(true);
    const r = await fetch(`/api/interactions/${deleteId}`, { method: 'DELETE' });
    if (r.ok) { setInteractions((p) => p.filter((i) => i.id !== deleteId)); toast.success('Removida'); } else toast.error('Erro');
    setDeleteId(null); setActionLoading(false);
  };

  const filtered = filter === 'all' ? interactions : interactions.filter((i) => i.type === filter);

  if (!canModify) {
    // Read-only view
    return (
      <div className="space-y-3">
        {interactions.slice(0, 10).map((i) => (
          <div key={i.id} className="border-l-2 border-purple-700/30 pl-3 py-2">
            <p className="text-sm text-neutral-300">{formatInteractionType(i.type)} — {formatInteractionOutcome(i.outcome)}</p>
            <p className="text-xs text-neutral-600 mt-0.5">{new Date(i.happened_at).toLocaleString('pt-BR')} · {i.created_by_name}</p>
            {i.note && <p className="mt-1 text-sm text-neutral-400 break-words">{i.note}</p>}
          </div>
        ))}
        {interactions.length > 10 && <p className="text-xs text-neutral-600 text-center py-2">+{interactions.length - 10} interacoes</p>}
        {interactions.length === 0 && <p className="text-center text-sm text-neutral-600 py-6">Nenhuma interacao registrada</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-2 py-1.5 text-xs border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="all">Todos</option>
            {Object.entries(INTERACTION_TYPE_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
          </select>
          {ACTIVITY_TEMPLATES.map((tpl) => (
            <button key={tpl.label} onClick={() => handleQuickTemplate(tpl)} className="px-2 py-1 text-[11px] font-medium text-neutral-400 bg-[#2a1245] rounded-lg hover:bg-purple-800/30 hover:text-white transition-colors">
              {tpl.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20 shrink-0">
          + Nova Interacao
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-6 p-3 sm:p-4 bg-[#2a1245]/50 rounded-xl border border-purple-700/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div><label className="block text-xs font-medium text-neutral-400 mb-1">Tipo</label>
              <select value={newInteraction.type} onChange={(e) => setNewInteraction({ ...newInteraction, type: e.target.value })} className={inputCls}>{Object.entries(INTERACTION_TYPE_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}</select></div>
            <div><label className="block text-xs font-medium text-neutral-400 mb-1">Resultado</label>
              <select value={newInteraction.outcome} onChange={(e) => setNewInteraction({ ...newInteraction, outcome: e.target.value })} className={inputCls}>{Object.entries(INTERACTION_OUTCOME_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}</select></div>
          </div>
          <div className="mb-3"><label className="block text-xs font-medium text-neutral-400 mb-1">Data/Hora</label><input type="datetime-local" value={newInteraction.happened_at} onChange={(e) => setNewInteraction({ ...newInteraction, happened_at: e.target.value })} className={inputCls} /></div>
          <div className="mb-3"><label className="block text-xs font-medium text-neutral-400 mb-1">Observacoes</label><textarea rows={3} value={newInteraction.note} onChange={(e) => setNewInteraction({ ...newInteraction, note: e.target.value })} className={inputCls} /></div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-neutral-400 border border-purple-700/30 rounded-lg hover:bg-purple-800/30 transition-colors">Cancelar</button>
            <button type="submit" className="px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors">Salvar</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {filtered.map((interaction) => (
          <div key={interaction.id} className="border-l-2 border-purple-700/30 pl-3 sm:pl-4 py-2">
            {editingId === interaction.id ? (
              <div className="p-3 bg-[#2a1245]/50 rounded-lg border border-purple-700/30 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-neutral-400 mb-1">Tipo</label>
                    <select value={editData.type} onChange={(e) => setEditData({ ...editData, type: e.target.value })} className={inputCls}>{Object.entries(INTERACTION_TYPE_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}</select></div>
                  <div><label className="block text-xs font-medium text-neutral-400 mb-1">Resultado</label>
                    <select value={editData.outcome} onChange={(e) => setEditData({ ...editData, outcome: e.target.value })} className={inputCls}>{Object.entries(INTERACTION_OUTCOME_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}</select></div>
                </div>
                <div><label className="block text-xs font-medium text-neutral-400 mb-1">Data/Hora</label><input type="datetime-local" value={editData.happened_at} onChange={(e) => setEditData({ ...editData, happened_at: e.target.value })} className={inputCls} /></div>
                <div><label className="block text-xs font-medium text-neutral-400 mb-1">Observacoes</label><textarea rows={2} value={editData.note} onChange={(e) => setEditData({ ...editData, note: e.target.value })} className={inputCls} /></div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingId(null)} disabled={actionLoading} className="px-3 py-1.5 text-xs text-neutral-400 border border-purple-700/30 rounded-lg hover:bg-purple-800/30 transition-colors">Cancelar</button>
                  <button onClick={handleSave} disabled={actionLoading} className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors">{actionLoading ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-200">{formatInteractionType(interaction.type)} — {formatInteractionOutcome(interaction.outcome)}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{new Date(interaction.happened_at).toLocaleString('pt-BR')} · {interaction.created_by_name}</p>
                  {interaction.note && <p className="mt-1.5 text-sm text-neutral-400 break-words">{interaction.note}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(interaction)} className="p-1.5 text-neutral-600 hover:text-emerald-400 rounded transition-colors" title="Editar">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => setDeleteId(interaction.id)} className="p-1.5 text-neutral-600 hover:text-red-400 rounded transition-colors" title="Excluir">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-neutral-600 py-6">{filter === 'all' ? 'Nenhuma interacao registrada' : 'Nenhuma interacao deste tipo'}</p>
        )}
      </div>

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Excluir interacao" message="Excluir esta interacao?" variant="danger" confirmLabel="Excluir" loading={actionLoading} />
    </div>
  );
}
