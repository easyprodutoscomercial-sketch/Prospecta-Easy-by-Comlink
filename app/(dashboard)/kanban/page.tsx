'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
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

// Collision detection que prioriza colunas sobre cards
const columnFirstCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const columnHit = pointerCollisions.find((c) => ALL_STATUSES.includes(c.id as ContactStatus));
  if (columnHit) return [columnHit];
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

// Sons usando Web Audio API
function playSound(type: 'celebrate' | 'sad') {
  try {
    const ctx = new AudioContext();
    if (type === 'celebrate') {
      // Som de "ihuuul" — notas ascendentes alegres
      [0, 0.15, 0.3, 0.45].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 400 + i * 150;
        gain.gain.value = 0.15;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.4);
      });
    } else {
      // Som de "nãooo" — nota descendente triste
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 400;
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.6);
      gain.gain.value = 0.15;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.start();
      osc.stop(ctx.currentTime + 0.7);
    }
  } catch {}
}

// Emoji particle
interface EmojiParticle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  size: number;
  delay: number;
}

const CELEBRATE_EMOJIS = ['👏', '🎉', '🥳', '🎊', '🏆', '⭐', '🔥', '💪', '🚀', '✨'];
const SAD_EMOJIS = ['😢', '😭', '💔', '😞', '😿', '🥺', '😩', '😔', '💧', '🫠'];

export default function KanbanPage() {
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'' | ContactType>('');
  const [responsavelFilter, setResponsavelFilter] = useState('');
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});
  const [showMotivoModal, setShowMotivoModal] = useState(false);
  const [pendingDrag, setPendingDrag] = useState<{ contactId: string; newStatus: 'CONVERTIDO' | 'PERDIDO'; oldStatus: ContactStatus } | null>(null);
  const [pendingJump, setPendingJump] = useState<{ contactId: string; newStatus: 'CONVERTIDO' | 'PERDIDO'; oldStatus: ContactStatus } | null>(null);
  const [motivoLoading, setMotivoLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');
  const [pipelineSettings, setPipelineSettings] = useState<PipelineSettings | null>(null);
  const [emojiParticles, setEmojiParticles] = useState<EmojiParticle[]>([]);

  // Pick-me speech bubble rotation
  const [talkingIndex, setTalkingIndex] = useState(0);
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [phraseKey, setPhraseKey] = useState(0);

  useEffect(() => {
    const userKeys = Object.keys(userMap);
    if (userKeys.length === 0) return;
    setCurrentPhrase(PICK_ME_PHRASES[Math.floor(Math.random() * PICK_ME_PHRASES.length)]);
    setPhraseKey((k) => k + 1);
    const interval = setInterval(() => {
      setTalkingIndex((prev) => (prev + 1) % userKeys.length);
      setCurrentPhrase(PICK_ME_PHRASES[Math.floor(Math.random() * PICK_ME_PHRASES.length)]);
      setPhraseKey((k) => k + 1);
    }, 2800);
    return () => clearInterval(interval);
  }, [userMap]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

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
        setCurrentUserRole(meData.role || 'user');
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

  // Emoji explosion effect
  function triggerEmojis(type: 'celebrate' | 'sad') {
    playSound(type);
    const emojis = type === 'celebrate' ? CELEBRATE_EMOJIS : SAD_EMOJIS;
    const particles: EmojiParticle[] = Array.from({ length: 30 }, (_, i) => ({
      id: Date.now() + i,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 20 + Math.random() * 30,
      delay: Math.random() * 0.5,
    }));
    setEmojiParticles(particles);
    setTimeout(() => setEmojiParticles([]), 2500);
  }

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

    if (responsavelFilter) {
      result = result.filter((c) =>
        responsavelFilter === '_none'
          ? !c.assigned_to_user_id
          : c.assigned_to_user_id === responsavelFilter || c.created_by_user_id === responsavelFilter
      );
    }

    return result;
  }, [contacts, search, tipoFilter, responsavelFilter]);

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

  async function moveContact(contactId: string, newStatus: ContactStatus, motivo?: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact || contact.status === newStatus) return;

    const oldStatus = contact.status;
    const oldIdx = ALL_STATUSES.indexOf(oldStatus);
    const newIdx = ALL_STATUSES.indexOf(newStatus);
    const isForward = newIdx > oldIdx;

    // Optimistic update
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, status: newStatus, ...(motivo ? { motivo_ganho_perdido: motivo } : {}) } : c))
    );

    // Trigger celebration or sad effect
    if (isForward) {
      triggerEmojis('celebrate');
    } else {
      triggerEmojis('sad');
    }

    try {
      const body: Record<string, string> = { status: newStatus };
      if (motivo) body.motivo_ganho_perdido = motivo;

      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro');
      }
      toast.success(isForward ? 'Avançou no pipeline!' : 'Status atualizado');
    } catch (err: any) {
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, status: oldStatus } : c))
      );
      toast.error(err.message || 'Erro ao atualizar status');
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveContact(null);
    const { active, over } = event;
    if (!over) return;

    const contactId = active.id as string;
    let newStatus = over.id as string;

    const overContact = contacts.find((c) => c.id === newStatus);
    if (overContact) {
      newStatus = overContact.status;
    }

    if (!ALL_STATUSES.includes(newStatus as ContactStatus)) return;

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact || contact.status === newStatus) return;

    // Ownership: só o responsável (ou admin) pode mover
    if (currentUserRole !== 'admin') {
      if (!contact.assigned_to_user_id) {
        toast.error('Este contato não tem responsável. Aponte para você primeiro.');
        return;
      }
      if (contact.assigned_to_user_id !== currentUserId) {
        const ownerName = userMap[contact.assigned_to_user_id]?.name || 'outro usuário';
        toast.error(`Contato atribuído a ${ownerName}. Aponte para você primeiro.`);
        return;
      }
    }

    // Intercept CONVERTIDO/PERDIDO
    if (newStatus === 'CONVERTIDO' || newStatus === 'PERDIDO') {
      setPendingDrag({ contactId, newStatus, oldStatus: contact.status });
      setShowMotivoModal(true);
      return;
    }

    await moveContact(contactId, newStatus as ContactStatus);
  }

  async function handleMotivoConfirm(motivo: string) {
    const pending = pendingDrag || pendingJump;
    if (!pending) return;
    setMotivoLoading(true);

    await moveContact(pending.contactId, pending.newStatus as ContactStatus, motivo);

    setMotivoLoading(false);
    setShowMotivoModal(false);
    setPendingDrag(null);
    setPendingJump(null);
  }

  // Verifica se o usuário pode mover este contato
  function canMoveContact(contact: Contact): boolean {
    if (currentUserRole === 'admin') return true;
    return !!contact.assigned_to_user_id && contact.assigned_to_user_id === currentUserId;
  }

  // Jump forward/backward
  async function handleJumpForward(contactId: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    if (!canMoveContact(contact)) {
      toast.error('Você não é o responsável deste contato.');
      return;
    }

    const idx = ALL_STATUSES.indexOf(contact.status);
    if (idx >= ALL_STATUSES.length - 2) return;

    const newStatus = ALL_STATUSES[idx + 1];

    if (newStatus === 'CONVERTIDO' || newStatus === 'PERDIDO') {
      setPendingJump({ contactId, newStatus: newStatus as 'CONVERTIDO' | 'PERDIDO', oldStatus: contact.status });
      setShowMotivoModal(true);
      return;
    }

    await moveContact(contactId, newStatus);
  }

  async function handleJumpBackward(contactId: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    if (!canMoveContact(contact)) {
      toast.error('Você não é o responsável deste contato.');
      return;
    }

    const idx = ALL_STATUSES.indexOf(contact.status);
    if (idx <= 0) return;

    const newStatus = ALL_STATUSES[idx - 1];
    await moveContact(contactId, newStatus);
  }

  // Claim contact
  async function handleClaimContact(contactId: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact || contact.assigned_to_user_id) return;

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
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, assigned_to_user_id: null } : c))
      );
      toast.error('Erro ao apontar contato');
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Emoji explosion overlay */}
      {emojiParticles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {emojiParticles.map((p) => (
            <span
              key={p.id}
              className="absolute animate-emoji-fall"
              style={{
                left: `${p.x}%`,
                top: `-5%`,
                fontSize: `${p.size}px`,
                animationDelay: `${p.delay}s`,
              }}
            >
              {p.emoji}
            </span>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-emerald-400">Pipeline</h1>

        <div className="flex items-center gap-2 flex-wrap">
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
              className="pl-8 pr-3 py-1.5 text-sm bg-[#2a1245] border border-purple-700/30 rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44"
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

          {/* Responsavel filter */}
          <select
            value={responsavelFilter}
            onChange={(e) => setResponsavelFilter(e.target.value)}
            className="text-sm bg-[#2a1245] border border-purple-700/30 rounded-lg px-2 py-1.5 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todos responsáveis</option>
            <option value="_none">Sem responsável</option>
            {Object.entries(userMap).map(([userId, user]) => (
              <option key={userId} value={userId}>{user.name}</option>
            ))}
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
            collisionDetection={columnFirstCollision}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <KanbanBoard
              grouped={grouped}
              activeContact={activeContact}
              userMap={userMap}
              currentUserId={currentUserId}
              onClaimContact={handleClaimContact}
              onJumpForward={handleJumpForward}
              onJumpBackward={handleJumpBackward}
              pipelineSettings={pipelineSettings}
            />
          </DndContext>
        </div>
      )}

      {/* Motivo modal for CONVERTIDO/PERDIDO */}
      {(pendingDrag || pendingJump) && (
        <MotivoModal
          isOpen={showMotivoModal}
          onClose={() => { setShowMotivoModal(false); setPendingDrag(null); setPendingJump(null); }}
          onConfirm={handleMotivoConfirm}
          tipo={(pendingDrag || pendingJump)!.newStatus}
          loading={motivoLoading}
        />
      )}
    </div>
  );
}
