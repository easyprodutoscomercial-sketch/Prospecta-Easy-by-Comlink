'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { Interaction, Meeting, ContactAttachment } from '@/lib/types';
import { createClient as createSupabaseBrowser } from '@/lib/supabase/client';
import type { TimelineEvent, TimelineFilter } from './timeline/types';
import {
  formatInteractionType,
  formatInteractionOutcome,
  INTERACTION_TYPE_LABELS,
  INTERACTION_OUTCOME_LABELS,
  ACTIVITY_TEMPLATES,
  MEETING_STATUS_COLORS,
  formatMeetingStatus,
} from '@/lib/utils/labels';
import ConfirmModal from '@/components/ui/confirm-modal';
import { useToast } from '@/lib/toast-context';

type AttachmentWithUrl = ContactAttachment & { public_url: string };

interface ContactTimelineProps {
  contactId: string;
  interactions: Interaction[];
  setInteractions: React.Dispatch<React.SetStateAction<Interaction[]>>;
  meetings: Meeting[];
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  attachments: AttachmentWithUrl[];
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentWithUrl[]>>;
  canModify: boolean;
}

const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  'application/pdf': { icon: 'PDF', color: 'bg-red-500/20 text-red-400' },
  'image/jpeg': { icon: 'JPG', color: 'bg-blue-500/20 text-blue-400' },
  'image/png': { icon: 'PNG', color: 'bg-blue-500/20 text-blue-400' },
  'image/webp': { icon: 'WEBP', color: 'bg-blue-500/20 text-blue-400' },
  'image/gif': { icon: 'GIF', color: 'bg-purple-500/20 text-purple-400' },
  'application/msword': { icon: 'DOC', color: 'bg-blue-600/20 text-blue-300' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'DOCX', color: 'bg-blue-600/20 text-blue-300' },
  'application/vnd.ms-excel': { icon: 'XLS', color: 'bg-green-500/20 text-green-400' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: 'XLSX', color: 'bg-green-500/20 text-green-400' },
  'text/csv': { icon: 'CSV', color: 'bg-green-500/20 text-green-400' },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Hoje';
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const inputCls = 'w-full px-3 py-2 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500';

export default function ContactTimeline({
  contactId,
  interactions,
  setInteractions,
  meetings,
  setMeetings,
  attachments,
  setAttachments,
  canModify,
}: ContactTimelineProps) {
  const toast = useToast();

  // Filter state
  const [filter, setFilter] = useState<TimelineFilter>('all');

  // Interaction form state
  const [showForm, setShowForm] = useState(false);
  const [newInteraction, setNewInteraction] = useState({ type: 'LIGACAO', outcome: 'SEM_RESPOSTA', note: '', happened_at: '' });

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ type: '', outcome: '', note: '', happened_at: '' });

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; kind: 'interaction' | 'attachment' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Meeting action loading
  const [meetingActionLoading, setMeetingActionLoading] = useState<string | null>(null);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Merge & sort events
  const events = useMemo<TimelineEvent[]>(() => {
    const all: TimelineEvent[] = [
      ...interactions.map((i) => ({ id: i.id, kind: 'interaction' as const, sortDate: i.happened_at, data: i })),
      ...meetings.map((m) => ({ id: m.id, kind: 'meeting' as const, sortDate: m.meeting_at, data: m })),
      ...attachments.map((a) => ({ id: a.id, kind: 'attachment' as const, sortDate: a.created_at, data: a })),
    ];
    return all.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
  }, [interactions, meetings, attachments]);

  const filtered = filter === 'all' ? events : events.filter((e) => e.kind === filter);

  // Group by date for separators
  const groupedByDate = useMemo(() => {
    const groups: { dateKey: string; label: string; events: TimelineEvent[] }[] = [];
    let currentKey = '';
    for (const event of filtered) {
      const dateKey = new Date(event.sortDate).toDateString();
      if (dateKey !== currentKey) {
        currentKey = dateKey;
        groups.push({ dateKey, label: formatDateSeparator(event.sortDate), events: [event] });
      } else {
        groups[groups.length - 1].events.push(event);
      }
    }
    return groups;
  }, [filtered]);

  // Counts
  const interactionCount = interactions.length;
  const meetingCount = meetings.length;
  const attachmentCount = attachments.length;
  const totalCount = interactionCount + meetingCount + attachmentCount;

  // --- Interaction CRUD ---
  const handleQuickTemplate = async (tpl: typeof ACTIVITY_TEMPLATES[number]) => {
    const r = await fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId, type: tpl.type, outcome: tpl.outcome, note: tpl.note }),
    });
    if (r.ok) {
      const created = await r.json();
      setInteractions((p) => [created, ...p]);
      toast.success('Interacao registrada');
    } else {
      const d = await r.json();
      toast.error(d.error || 'Erro');
    }
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, any> = { contact_id: contactId, type: newInteraction.type, outcome: newInteraction.outcome, note: newInteraction.note || null };
    if (newInteraction.happened_at) body.happened_at = new Date(newInteraction.happened_at).toISOString();
    const r = await fetch('/api/interactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) {
      const created = await r.json();
      setInteractions((p) => [created, ...p]);
      toast.success('Interacao adicionada');
    } else {
      const d = await r.json();
      toast.error(d.error || 'Erro');
    }
    setNewInteraction({ type: 'LIGACAO', outcome: 'SEM_RESPOSTA', note: '', happened_at: '' });
    setShowForm(false);
  };

  const startEdit = (i: Interaction) => {
    setEditingId(i.id);
    setEditData({ type: i.type, outcome: i.outcome, note: i.note || '', happened_at: i.happened_at ? new Date(i.happened_at).toISOString().slice(0, 16) : '' });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setActionLoading(true);
    const body: Record<string, any> = { type: editData.type, outcome: editData.outcome, note: editData.note || null };
    if (editData.happened_at) body.happened_at = new Date(editData.happened_at).toISOString();
    const r = await fetch(`/api/interactions/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) {
      const u = await r.json();
      setInteractions((p) => p.map((i) => (i.id === editingId ? u : i)));
      toast.success('Atualizada');
    } else {
      toast.error('Erro');
    }
    setEditingId(null);
    setActionLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    if (deleteTarget.kind === 'interaction') {
      const r = await fetch(`/api/interactions/${deleteTarget.id}`, { method: 'DELETE' });
      if (r.ok) {
        setInteractions((p) => p.filter((i) => i.id !== deleteTarget.id));
        toast.success('Interacao removida');
      } else {
        toast.error('Erro ao remover');
      }
    } else {
      const r = await fetch(`/api/contacts/${contactId}/attachments/${deleteTarget.id}`, { method: 'DELETE' });
      if (r.ok) {
        setAttachments((p) => p.filter((a) => a.id !== deleteTarget.id));
        toast.success('Arquivo removido');
      } else {
        toast.error('Erro ao remover');
      }
    }
    setDeleteTarget(null);
    setActionLoading(false);
  };

  // --- Meeting status update ---
  const handleMeetingStatus = async (meetingId: string, newStatus: 'COMPLETED' | 'CANCELLED') => {
    setMeetingActionLoading(meetingId);
    try {
      const r = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (r.ok) {
        const updated = await r.json();
        setMeetings((p) => p.map((m) => (m.id === meetingId ? updated : m)));
        toast.success(newStatus === 'COMPLETED' ? 'Reuniao concluida' : 'Reuniao cancelada');
      } else {
        toast.error('Erro ao atualizar reuniao');
      }
    } catch {
      toast.error('Erro ao atualizar reuniao');
    }
    setMeetingActionLoading(null);
  };

  // --- File upload (direct to Supabase Storage to bypass Vercel 4.5MB body limit) ---
  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      // We need the org_id for the path — fetch from /api/me
      const meRes = await fetch('/api/me');
      if (!meRes.ok) { toast.error('Erro de autenticacao'); setUploading(false); return; }
      const me = await meRes.json();
      const orgId = me.organization_id;
      const filePath = `${orgId}/${contactId}/${safeName}`;

      // Upload directly to Supabase Storage from browser
      const supabase = createSupabaseBrowser();
      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });

      if (uploadError) {
        toast.error('Erro ao enviar arquivo: ' + uploadError.message);
        setUploading(false);
        return;
      }

      // Save metadata via API (JSON body, no file in body)
      const r = await fetch(`/api/contacts/${contactId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
        }),
      });
      if (r.ok) {
        const attachment = await r.json();
        setAttachments((prev) => [attachment, ...prev]);
        toast.success(`"${file.name}" enviado com sucesso`);
      } else {
        const d = await r.json();
        toast.error(d.error || 'Erro ao enviar arquivo');
      }
    } catch {
      toast.error('Erro ao enviar arquivo');
    }
    setUploading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [contactId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // --- Filter chips ---
  const filterChips: { key: TimelineFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: totalCount },
    { key: 'interaction', label: 'Interacoes', count: interactionCount },
    { key: 'meeting', label: 'Reunioes', count: meetingCount },
    { key: 'attachment', label: 'Arquivos', count: attachmentCount },
  ];

  return (
    <div>
      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {filterChips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => setFilter(chip.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              filter === chip.key
                ? 'bg-emerald-600 text-white'
                : 'bg-[#2a1245] text-neutral-400 hover:bg-purple-800/30 hover:text-neutral-200'
            }`}
          >
            {chip.label} ({chip.count})
          </button>
        ))}
      </div>

      {/* Action bar */}
      {canModify && (
        <div className="mb-4 space-y-3">
          {/* Quick templates */}
          <div className="flex items-center gap-2 flex-wrap">
            {ACTIVITY_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                onClick={() => handleQuickTemplate(tpl)}
                className="px-2 py-1 text-[11px] font-medium text-neutral-400 bg-[#2a1245] rounded-lg hover:bg-purple-800/30 hover:text-white transition-colors"
              >
                {tpl.label}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20"
            >
              + Nova Interacao
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-sm font-medium text-neutral-300 border border-purple-700/30 rounded-lg hover:bg-purple-800/30 hover:text-white transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Anexar Arquivo
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv"
            />
          </div>
        </div>
      )}

      {/* Inline form for new interaction */}
      {showForm && (
        <form onSubmit={handleAddInteraction} className="mb-6 p-3 sm:p-4 bg-[#2a1245]/50 rounded-xl border border-purple-700/30 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Tipo</label>
              <select value={newInteraction.type} onChange={(e) => setNewInteraction({ ...newInteraction, type: e.target.value })} className={inputCls}>
                {Object.entries(INTERACTION_TYPE_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Resultado</label>
              <select value={newInteraction.outcome} onChange={(e) => setNewInteraction({ ...newInteraction, outcome: e.target.value })} className={inputCls}>
                {Object.entries(INTERACTION_OUTCOME_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-neutral-400 mb-1">Data/Hora</label>
            <input type="datetime-local" value={newInteraction.happened_at} onChange={(e) => setNewInteraction({ ...newInteraction, happened_at: e.target.value })} className={inputCls} />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-neutral-400 mb-1">Observacoes</label>
            <textarea rows={3} value={newInteraction.note} onChange={(e) => setNewInteraction({ ...newInteraction, note: e.target.value })} className={inputCls} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-neutral-400 border border-purple-700/30 rounded-lg hover:bg-purple-800/30 transition-colors">Cancelar</button>
            <button type="submit" className="px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors">Salvar</button>
          </div>
        </form>
      )}

      {/* Drop zone (compact) */}
      {canModify && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`mb-5 p-3 border-2 border-dashed rounded-xl transition-colors text-center ${
            dragOver
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-purple-700/20 bg-transparent'
          }`}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-emerald-400">Enviando...</span>
            </div>
          ) : (
            <p className="text-xs text-neutral-600">Arraste arquivos aqui para anexar (PDF, imagens, DOC, XLS, CSV)</p>
          )}
        </div>
      )}

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="text-center py-10">
          <svg className="w-12 h-12 mx-auto mb-3 text-purple-700/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-neutral-500">
            {filter === 'all' ? 'Nenhuma atividade registrada' : `Nenhum evento do tipo "${filterChips.find((c) => c.key === filter)?.label}" encontrado`}
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-purple-700/30" />

          <div className="space-y-1">
            {groupedByDate.map((group) => (
              <div key={group.dateKey}>
                {/* Date separator */}
                <div className="relative flex items-center py-3 pl-10">
                  <div className="absolute left-[11px] w-[11px] h-[11px] rounded-full bg-[#1e0f35] border-2 border-purple-700/50" />
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-purple-400/80 uppercase tracking-wider whitespace-nowrap">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-purple-700/20" />
                  </div>
                </div>

                {/* Events */}
                <div className="space-y-3">
                  {group.events.map((event, idx) => (
                    <div
                      key={`${event.kind}-${event.id}`}
                      className="relative pl-10"
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      {/* Dot */}
                      <div className={`absolute left-[9px] top-3 w-[15px] h-[15px] rounded-full border-2 ${
                        event.kind === 'interaction'
                          ? 'border-emerald-500 bg-emerald-500/30'
                          : event.kind === 'meeting'
                          ? 'border-cyan-400 bg-cyan-400/30'
                          : 'border-purple-400 bg-purple-400/30'
                      }`} />

                      {event.kind === 'interaction' && (
                        <InteractionCard
                          interaction={event.data as Interaction}
                          isEditing={editingId === event.id}
                          editData={editData}
                          setEditData={setEditData}
                          onStartEdit={() => startEdit(event.data as Interaction)}
                          onSaveEdit={handleSaveEdit}
                          onCancelEdit={() => setEditingId(null)}
                          onDelete={() => setDeleteTarget({ id: event.id, kind: 'interaction' })}
                          canModify={canModify}
                          actionLoading={actionLoading}
                        />
                      )}
                      {event.kind === 'meeting' && (
                        <MeetingCard
                          meeting={event.data as Meeting}
                          onMarkCompleted={() => handleMeetingStatus(event.id, 'COMPLETED')}
                          onCancel={() => handleMeetingStatus(event.id, 'CANCELLED')}
                          canModify={canModify}
                          loading={meetingActionLoading === event.id}
                        />
                      )}
                      {event.kind === 'attachment' && (
                        <AttachmentCard
                          attachment={event.data as AttachmentWithUrl}
                          onDelete={() => setDeleteTarget({ id: event.id, kind: 'attachment' })}
                          canModify={canModify}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget?.kind === 'interaction' ? 'Excluir interacao' : 'Excluir arquivo'}
        message={deleteTarget?.kind === 'interaction' ? 'Excluir esta interacao?' : 'Tem certeza que deseja excluir este arquivo? Esta acao e irreversivel.'}
        variant="danger"
        confirmLabel="Excluir"
        loading={actionLoading}
      />
    </div>
  );
}

// --- Sub-components ---

function InteractionCard({
  interaction,
  isEditing,
  editData,
  setEditData,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  canModify,
  actionLoading,
}: {
  interaction: Interaction;
  isEditing: boolean;
  editData: { type: string; outcome: string; note: string; happened_at: string };
  setEditData: React.Dispatch<React.SetStateAction<{ type: string; outcome: string; note: string; happened_at: string }>>;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  canModify: boolean;
  actionLoading: boolean;
}) {
  if (isEditing) {
    return (
      <div className="p-3 bg-[#2a1245]/50 rounded-lg border border-emerald-500/30 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Tipo</label>
            <select value={editData.type} onChange={(e) => setEditData((p) => ({ ...p, type: e.target.value }))} className={inputCls}>
              {Object.entries(INTERACTION_TYPE_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Resultado</label>
            <select value={editData.outcome} onChange={(e) => setEditData((p) => ({ ...p, outcome: e.target.value }))} className={inputCls}>
              {Object.entries(INTERACTION_OUTCOME_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">Data/Hora</label>
          <input type="datetime-local" value={editData.happened_at} onChange={(e) => setEditData((p) => ({ ...p, happened_at: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">Observacoes</label>
          <textarea rows={2} value={editData.note} onChange={(e) => setEditData((p) => ({ ...p, note: e.target.value }))} className={inputCls} />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancelEdit} disabled={actionLoading} className="px-3 py-1.5 text-xs text-neutral-400 border border-purple-700/30 rounded-lg hover:bg-purple-800/30 transition-colors">Cancelar</button>
          <button onClick={onSaveEdit} disabled={actionLoading} className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors">
            {actionLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Salvando...
              </span>
            ) : 'Salvar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#2a1245]/30 rounded-lg p-3 border border-purple-700/20 hover:border-purple-700/40 transition-colors">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/20 text-emerald-400">
              {formatInteractionType(interaction.type)}
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-300">
              {formatInteractionOutcome(interaction.outcome)}
            </span>
          </div>
          {interaction.note && (
            <p className="mt-1.5 text-sm text-neutral-400 break-words">{interaction.note}</p>
          )}
        </div>
        {canModify && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onStartEdit} className="p-1.5 text-neutral-600 hover:text-emerald-400 rounded transition-colors" title="Editar">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button onClick={onDelete} className="p-1.5 text-neutral-600 hover:text-red-400 rounded transition-colors" title="Excluir">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        )}
      </div>
      <p className="text-[11px] text-neutral-600 mt-2">
        {new Date(interaction.happened_at).toLocaleString('pt-BR')} · {interaction.created_by_name}
      </p>
    </div>
  );
}

function MeetingCard({
  meeting,
  onMarkCompleted,
  onCancel,
  canModify,
  loading,
}: {
  meeting: Meeting;
  onMarkCompleted: () => void;
  onCancel: () => void;
  canModify: boolean;
  loading: boolean;
}) {
  const statusColor = MEETING_STATUS_COLORS[meeting.status] || 'bg-neutral-500/20 text-neutral-400';
  const meetingDate = new Date(meeting.meeting_at);

  return (
    <div className="bg-cyan-500/5 rounded-lg p-3 border border-cyan-500/15 hover:border-cyan-500/30 transition-colors">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium text-neutral-200">{meeting.title}</span>
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${statusColor}`}>
              {formatMeetingStatus(meeting.status)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-500 flex-wrap">
            <span>{meetingDate.toLocaleString('pt-BR')}</span>
            <span>·</span>
            <span>{meeting.duration_minutes}min</span>
            {meeting.location && (
              <>
                <span>·</span>
                <span>{meeting.location}</span>
              </>
            )}
          </div>
          {meeting.notes && (
            <p className="mt-1.5 text-sm text-neutral-400 break-words">{meeting.notes}</p>
          )}
        </div>
      </div>

      {/* Meeting actions */}
      {canModify && meeting.status === 'SCHEDULED' && (
        <div className="flex items-center gap-2 mt-2.5">
          <button
            onClick={onMarkCompleted}
            disabled={loading}
            className="px-2.5 py-1 text-[11px] font-medium text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ...
              </span>
            ) : 'Marcar Concluida'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-2.5 py-1 text-[11px] font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

function AttachmentCard({
  attachment,
  onDelete,
  canModify,
}: {
  attachment: AttachmentWithUrl;
  onDelete: () => void;
  canModify: boolean;
}) {
  const fileInfo = FILE_ICONS[attachment.mime_type] || { icon: 'FILE', color: 'bg-neutral-500/20 text-neutral-400' };

  return (
    <div className="bg-[#2a1245]/30 rounded-lg p-3 border border-purple-700/20 hover:border-purple-700/40 transition-colors">
      <div className="flex items-center gap-3">
        {/* File icon */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${fileInfo.color}`}>
          {fileInfo.icon}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <a
            href={attachment.public_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-neutral-200 hover:text-emerald-400 transition-colors truncate block"
          >
            {attachment.file_name}
          </a>
          <p className="text-[11px] text-neutral-600">
            {formatFileSize(attachment.file_size)} · {new Date(attachment.created_at).toLocaleString('pt-BR')} · {attachment.uploaded_by_name}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={attachment.public_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-neutral-500 hover:text-emerald-400 rounded transition-colors"
            title="Download"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </a>
          {canModify && (
            <button
              onClick={onDelete}
              className="p-1.5 text-neutral-500 hover:text-red-400 rounded transition-colors"
              title="Excluir"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
