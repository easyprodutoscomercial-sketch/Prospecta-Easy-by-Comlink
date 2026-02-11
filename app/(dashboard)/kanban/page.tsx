'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Contact, ContactStatus, ContactType, PipelineSettings } from '@/lib/types';
import { useToast } from '@/lib/toast-context';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { KanbanSkeleton } from '@/components/kanban/kanban-skeleton';
import type { UserInfo } from '@/components/kanban/kanban-card';
import { getUserColor } from '@/lib/utils/user-colors';
import MotivoModal from '@/components/ui/motivo-modal';
import { PICK_ME_PHRASES } from '@/lib/utils/pick-me-phrases';

const ALL_STATUSES: ContactStatus[] = [
  'NOVO',
  'EM_PROSPECCAO',
  'CONTATADO',
  'REUNIAO_MARCADA',
  'CONVERTIDO',
  'PERDIDO',
];

export default function KanbanPage() {
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'' | ContactType>('');
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});
  const [showMotivoModal, setShowMotivoModal] = useState(false);
  const [pendingDrag, setPendingDrag] = useState<{ contactId: string; newStatus: 'CONVERTIDO' | 'PERDIDO'; oldStatus: ContactStatus } | null>(null);
  const [motivoLoading, setMotivoLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');
  const [pipelineSettings, setPipelineSettings] = useState<PipelineSettings | null>(null);

  // Pick-me speech bubble rotation
  const [talkingIndex, setTalkingIndex] = useState(0);
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [phraseKey, setPhraseKey] = useState(0);

  useEffect(() => {
    const userKeys = Object.keys(userMap);
    if (userKeys.length === 0) return;
    // Pick random phrase
    setCurrentPhrase(PICK_ME_PHRASES[Math.floor(Math.random() * PICK_ME_PHRASES.length)]);
    setPhraseKey((k) => k + 1);
    const interval = setInterval(() => {
      setTalkingIndex((prev) => {
        const next = (prev + 1) % userKeys.length;
        return next;
      });
      setCurrentPhrase(PICK_ME_PHRASES[Math.floor(Math.random() * PICK_ME_PHRASES.length)]);
      setPhraseKey((k) => k + 1);
    }, 2800);
    return () => clearInterval(interval);
  }, [userMap]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Fetch contacts + users + me + pipeline settings in parallel
  const fetchData = useCallback(async () => {
    try {
      const [contactsRes, usersRes, meRes, settingsRes] = await Promise.all([
        fetch('/api/contacts?limit=500'),
        fetch('/api/users'),
        fetch('/api/me'),
        fetch('/api/pipeline-settings'),
      ]);

      if (!contactsRes.ok) throw new Error('Erro ao carregar contatos');
      const contactsData = await contactsRes.json();
      setContacts(contactsData.contacts);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const map: Record<string, UserInfo> = {};
        for (const u of usersData.users || []) {
          map[u.user_id] = {
            name: u.name,
            color: getUserColor(u.user_id),
            avatar_url: u.avatar_url || null,
          };
        }
        setUserMap(map);
      }

      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUserId(meData.user_id);
        setCurrentUserRole(meData.role);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData.columns) {
          setPipelineSettings(settingsData);
        }
      }
    } catch {
      toast.error('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter contacts
  const filtered = useMemo(() => {
    let result = contacts;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.email?.toLowerCase().includes(q)
      );
    }

    if (tipoFilter) {
      result = result.filter((c) => c.tipo?.includes(tipoFilter));
    }

    return result;
  }, [contacts, search, tipoFilter]);

  // Group by status
  const grouped = useMemo(() => {
    const groups = {} as Record<ContactStatus, Contact[]>;
    for (const s of ALL_STATUSES) groups[s] = [];
    for (const c of filtered) {
      if (groups[c.status]) groups[c.status].push(c);
    }
    return groups;
  }, [filtered]);

  // Drag handlers
  function handleDragStart(event: DragStartEvent) {
    const contact = contacts.find((c) => c.id === event.active.id);
    setActiveContact(contact || null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveContact(null);
    const { active, over } = event;
    if (!over) return;

    const contactId = active.id as string;
    let newStatus = over.id as string;

    // If dropped on a card, get its column status
    const overContact = contacts.find((c) => c.id === newStatus);
    if (overContact) {
      newStatus = overContact.status;
    }

    // Validate it's a real status
    if (!ALL_STATUSES.includes(newStatus as ContactStatus)) return;

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact || contact.status === newStatus) return;

    // Intercept CONVERTIDO/PERDIDO to ask for motivo
    if (newStatus === 'CONVERTIDO' || newStatus === 'PERDIDO') {
      setPendingDrag({ contactId, newStatus, oldStatus: contact.status });
      setShowMotivoModal(true);
      return;
    }

    const oldStatus = contact.status;

    // Optimistic update
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, status: newStatus as ContactStatus } : c))
    );

    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro');
      }
      toast.success('Status atualizado');
    } catch (err: any) {
      // Rollback
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, status: oldStatus } : c))
      );
      toast.error(err.message || 'Erro ao atualizar status');
    }
  }

  async function handleMotivoConfirm(motivo: string) {
    if (!pendingDrag) return;
    const { contactId, newStatus, oldStatus } = pendingDrag;
    setMotivoLoading(true);

    // Optimistic update
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, status: newStatus as ContactStatus, motivo_ganho_perdido: motivo } : c))
    );

    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, motivo_ganho_perdido: motivo }),
      });

      if (!res.ok) throw new Error();
      toast.success('Status atualizado');
    } catch {
      // Rollback
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, status: oldStatus } : c))
      );
      toast.error('Erro ao atualizar status');
    }

    setMotivoLoading(false);
    setShowMotivoModal(false);
    setPendingDrag(null);
  }

  // Claim contact (apontar para mim)
  async function handleClaimContact(contactId: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact || contact.assigned_to_user_id) return;

    // Optimistic
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, assigned_to_user_id: currentUserId } : c))
    );

    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to_user_id: currentUserId }),
      });

      if (!res.ok) throw new Error();
      toast.success('Contato atribuído a você');
    } catch {
      // Rollback
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, assigned_to_user_id: null } : c))
      );
      toast.error('Erro ao apontar contato');
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-emerald-400">Pipeline</h1>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm bg-[#2a1245] border border-purple-700/30 rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48"
            />
          </div>

          {/* Type filter */}
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value as '' | ContactType)}
            className="text-sm bg-[#2a1245] border border-purple-700/30 rounded-lg px-2 py-1.5 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todos os tipos</option>
            <option value="FORNECEDOR">Fornecedor</option>
            <option value="COMPRADOR">Comprador</option>
          </select>
        </div>
      </div>

      {/* Legenda de usuários com speech bubbles */}
      {Object.keys(userMap).length > 0 && (
        <div className="flex items-end gap-4 flex-wrap pt-8">
          <span className="text-xs text-purple-300/60 font-medium self-center">Responsáveis:</span>
          {Object.values(userMap).map((u, i) => {
            const isTalking = i === talkingIndex;
            return (
              <div key={u.name} className="flex flex-col items-center gap-1 relative">
                {/* Speech bubble — só aparece no avatar da vez */}
                {isTalking && (
                  <div key={phraseKey} className="speech-bubble">
                    {currentPhrase}
                  </div>
                )}
                <div className={isTalking ? 'avatar-pick-me-talking shrink-0' : 'avatar-pick-me-idle shrink-0'}>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.name} className="w-10 h-10 object-cover" />
                  ) : (
                    <div
                      className="w-10 h-10 flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: u.color.bg, color: u.color.text }}
                    >
                      {u.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                  )}
                </div>
                <span className={`text-[10px] transition-colors duration-300 ${isTalking ? 'text-emerald-400 font-bold' : 'text-purple-300/50'}`}>
                  {u.name.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Board */}
      {loading ? (
        <KanbanSkeleton />
      ) : (
        <div className="bg-[#1e0f35]/50 rounded-xl p-4 border border-purple-800/20">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <KanbanBoard
              grouped={grouped}
              activeContact={activeContact}
              userMap={userMap}
              currentUserId={currentUserId}
              onClaimContact={handleClaimContact}
              pipelineSettings={pipelineSettings}
            />
          </DndContext>
        </div>
      )}

      {/* Motivo modal for CONVERTIDO/PERDIDO */}
      {pendingDrag && (
        <MotivoModal
          isOpen={showMotivoModal}
          onClose={() => { setShowMotivoModal(false); setPendingDrag(null); }}
          onConfirm={handleMotivoConfirm}
          tipo={pendingDrag.newStatus}
          loading={motivoLoading}
        />
      )}
    </div>
  );
}
