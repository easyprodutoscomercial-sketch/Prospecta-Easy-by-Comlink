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
import { TEMPERATURA_LABELS, ORIGEM_LABELS, PROXIMA_ACAO_LABELS, ESTADOS_BRASIL } from '@/lib/utils/labels';
import { useToast } from '@/lib/toast-context';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { KanbanSkeleton } from '@/components/kanban/kanban-skeleton';
import type { UserInfo } from '@/components/kanban/kanban-card';
import { getUserColor } from '@/lib/utils/user-colors';
import MotivoModal from '@/components/ui/motivo-modal';
import { PICK_ME_PHRASES } from '@/lib/utils/pick-me-phrases';
import AiChatPanel from '@/components/ai-chat-panel';

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
  const [temperaturaFilter, setTemperaturaFilter] = useState('');
  const [origemFilter, setOrigemFilter] = useState('');
  const [classeFilter, setClasseFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [proximaAcaoFilter, setProximaAcaoFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [advSearch, setAdvSearch] = useState({ cpf: '', cnpj: '', whatsapp: '', empresa: '', cidade: '', telefone: '', referencia: '', contato_nome: '', cargo: '', produtos_fornecidos: '' });
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
  const [chatOpen, setChatOpen] = useState(false);

  // Open chat if ?chat=1 in URL
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('chat=1')) {
      setChatOpen(true);
    }
  }, []);

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
    }, 12500);
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

    if (temperaturaFilter) {
      result = result.filter((c) => c.temperatura === temperaturaFilter);
    }

    if (origemFilter) {
      result = result.filter((c) => c.origem === origemFilter);
    }

    if (classeFilter) {
      result = result.filter((c) => c.classe === classeFilter);
    }
    if (estadoFilter) {
      result = result.filter((c) => c.estado === estadoFilter);
    }
    if (proximaAcaoFilter) {
      result = result.filter((c) => c.proxima_acao_tipo === proximaAcaoFilter);
    }
    const ilike = (val: string | null | undefined, q: string) => val ? val.toLowerCase().includes(q.toLowerCase()) : false;
    if (advSearch.cpf) result = result.filter((c) => ilike(c.cpf, advSearch.cpf));
    if (advSearch.cnpj) result = result.filter((c) => ilike(c.cnpj, advSearch.cnpj));
    if (advSearch.whatsapp) result = result.filter((c) => ilike(c.whatsapp, advSearch.whatsapp));
    if (advSearch.empresa) result = result.filter((c) => ilike(c.company, advSearch.empresa));
    if (advSearch.cidade) result = result.filter((c) => ilike(c.cidade, advSearch.cidade));
    if (advSearch.telefone) result = result.filter((c) => ilike(c.phone, advSearch.telefone));
    if (advSearch.referencia) result = result.filter((c) => ilike(c.referencia, advSearch.referencia));
    if (advSearch.contato_nome) result = result.filter((c) => ilike(c.contato_nome, advSearch.contato_nome));
    if (advSearch.cargo) result = result.filter((c) => ilike(c.cargo, advSearch.cargo));
    if (advSearch.produtos_fornecidos) result = result.filter((c) => ilike(c.produtos_fornecidos, advSearch.produtos_fornecidos));

    return result;
  }, [contacts, search, tipoFilter, responsavelFilter, temperaturaFilter, origemFilter, classeFilter, estadoFilter, proximaAcaoFilter, advSearch]);

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

  // KPI calculations
  const kpis = useMemo(() => {
    const active = contacts.filter(c => !['CONVERTIDO', 'PERDIDO'].includes(c.status));
    const convertidos = contacts.filter(c => c.status === 'CONVERTIDO').length;
    const perdidos = contacts.filter(c => c.status === 'PERDIDO').length;
    const closedTotal = convertidos + perdidos;
    const conversionRate = closedTotal > 0 ? Math.round((convertidos / closedTotal) * 100) : 0;
    const totalValue = active.reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
    const noOwner = active.filter(c => !c.assigned_to_user_id).length;
    return { activeCount: active.length, totalValue, conversionRate, noOwner, convertidos, perdidos };
  }, [contacts]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (tipoFilter) count++;
    if (responsavelFilter) count++;
    if (temperaturaFilter) count++;
    if (origemFilter) count++;
    if (classeFilter) count++;
    if (estadoFilter) count++;
    if (proximaAcaoFilter) count++;
    Object.values(advSearch).forEach(v => { if (v) count++; });
    return count;
  }, [tipoFilter, responsavelFilter, temperaturaFilter, origemFilter, classeFilter, estadoFilter, proximaAcaoFilter, advSearch]);

  function clearAllFilters() {
    setTipoFilter('');
    setResponsavelFilter('');
    setTemperaturaFilter('');
    setOrigemFilter('');
    setClasseFilter('');
    setEstadoFilter('');
    setProximaAcaoFilter('');
    setAdvSearch({ cpf: '', cnpj: '', whatsapp: '', empresa: '', cidade: '', telefone: '', referencia: '', contato_nome: '', cargo: '', produtos_fornecidos: '' });
    setSearch('');
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

  const selectClass = "text-xs bg-[#1e0f35] border border-purple-700/20 rounded-lg px-2.5 py-2 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 w-full";
  const inputClass = "text-xs bg-[#1e0f35] border border-purple-700/20 rounded-lg px-2.5 py-2 text-neutral-200 placeholder:text-purple-300/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 w-full";

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 sm:-my-8 lg:-mx-10 lg:-my-10 min-h-screen flex flex-col">
      {/* Emoji explosion overlay */}
      {emojiParticles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {emojiParticles.map((p) => (
            <span
              key={p.id}
              className="absolute animate-emoji-fall"
              style={{ left: `${p.x}%`, top: `-5%`, fontSize: `${p.size}px`, animationDelay: `${p.delay}s` }}
            >
              {p.emoji}
            </span>
          ))}
        </div>
      )}

      {/* === TOP BAR: Header + Search + Filters === */}
      <div className="bg-[#120826]/80 backdrop-blur-sm border-b border-purple-500/10 px-4 lg:px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Title */}
          <div className="flex items-center gap-2.5 mr-auto">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-purple-600/20 border border-emerald-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2m0 10V7m6 10V7" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Pipeline</h1>
              <p className="text-[10px] text-purple-300/40">{filtered.length} de {contacts.length} contatos</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-300/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar nome, empresa, tel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-[#1e0f35] border border-purple-700/20 rounded-lg text-neutral-200 placeholder:text-purple-300/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 w-52"
            />
          </div>

          {/* Filter toggle button */}
          <div className="relative">
            <button
              onClick={() => setShowFilters((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showFilters || activeFilterCount > 0
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#1e0f35] text-purple-300/60 border border-purple-700/20 hover:text-purple-200 hover:border-purple-600/30'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtros
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {activeFilterCount > 0 && (
            <button onClick={clearAllFilters} className="text-[10px] text-red-400/70 hover:text-red-400 font-medium">
              Limpar filtros
            </button>
          )}
        </div>

        {/* Filter Panel (collapsible) */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-purple-500/10 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
              <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value as '' | ContactType)} className={selectClass}>
                <option value="">Tipo</option>
                <option value="FORNECEDOR">Fornecedor</option>
                <option value="COMPRADOR">Comprador</option>
              </select>
              <select value={responsavelFilter} onChange={(e) => setResponsavelFilter(e.target.value)} className={selectClass}>
                <option value="">Responsavel</option>
                <option value="_none">Sem responsavel</option>
                {Object.entries(userMap).map(([userId, user]) => (
                  <option key={userId} value={userId}>{user.name}</option>
                ))}
              </select>
              <select value={temperaturaFilter} onChange={(e) => setTemperaturaFilter(e.target.value)} className={selectClass}>
                <option value="">Temperatura</option>
                {Object.entries(TEMPERATURA_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <select value={origemFilter} onChange={(e) => setOrigemFilter(e.target.value)} className={selectClass}>
                <option value="">Origem</option>
                {Object.entries(ORIGEM_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <select value={classeFilter} onChange={(e) => setClasseFilter(e.target.value)} className={selectClass}>
                <option value="">Classe</option>
                <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
              </select>
              <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className={selectClass}>
                <option value="">Estado</option>
                {ESTADOS_BRASIL.map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
              </select>
              <select value={proximaAcaoFilter} onChange={(e) => setProximaAcaoFilter(e.target.value)} className={selectClass}>
                <option value="">Proxima Acao</option>
                {Object.entries(PROXIMA_ACAO_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
              </select>
            </div>
            {/* Advanced text search */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-2">
              <input type="text" placeholder="CPF" value={advSearch.cpf} onChange={(e) => setAdvSearch((p) => ({ ...p, cpf: e.target.value }))} className={inputClass} />
              <input type="text" placeholder="CNPJ" value={advSearch.cnpj} onChange={(e) => setAdvSearch((p) => ({ ...p, cnpj: e.target.value }))} className={inputClass} />
              <input type="text" placeholder="Telefone" value={advSearch.telefone} onChange={(e) => setAdvSearch((p) => ({ ...p, telefone: e.target.value }))} className={inputClass} />
              <input type="text" placeholder="Empresa" value={advSearch.empresa} onChange={(e) => setAdvSearch((p) => ({ ...p, empresa: e.target.value }))} className={inputClass} />
              <input type="text" placeholder="Cidade" value={advSearch.cidade} onChange={(e) => setAdvSearch((p) => ({ ...p, cidade: e.target.value }))} className={inputClass} />
              <input type="text" placeholder="WhatsApp" value={advSearch.whatsapp} onChange={(e) => setAdvSearch((p) => ({ ...p, whatsapp: e.target.value }))} className={inputClass} />
              <input type="text" placeholder="Referencia" value={advSearch.referencia} onChange={(e) => setAdvSearch((p) => ({ ...p, referencia: e.target.value }))} className={inputClass} />
              <input type="text" placeholder="Contato" value={advSearch.contato_nome} onChange={(e) => setAdvSearch((p) => ({ ...p, contato_nome: e.target.value }))} className={inputClass} />
              <input type="text" placeholder="Cargo" value={advSearch.cargo} onChange={(e) => setAdvSearch((p) => ({ ...p, cargo: e.target.value }))} className={inputClass} />
              <input type="text" placeholder="Produtos" value={advSearch.produtos_fornecidos} onChange={(e) => setAdvSearch((p) => ({ ...p, produtos_fornecidos: e.target.value }))} className={inputClass} />
            </div>
          </div>
        )}
      </div>

      {/* === KPI BAR === */}
      {!loading && (
        <div className="px-4 lg:px-6 py-3 border-b border-purple-500/10 bg-[#120826]/40">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20">
              <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium">Valor no Pipeline</p>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">
                {kpis.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20">
              <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium">Contatos Ativos</p>
              <p className="text-lg font-bold text-white mt-0.5">{kpis.activeCount}</p>
            </div>
            <div className="bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20">
              <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium">Taxa Conversao</p>
              <div className="flex items-end gap-2 mt-0.5">
                <p className="text-lg font-bold text-white">{kpis.conversionRate}%</p>
                <p className="text-[10px] text-purple-300/30 pb-0.5">{kpis.convertidos}W / {kpis.perdidos}L</p>
              </div>
            </div>
            <div className="bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20">
              <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium">Sem Responsavel</p>
              <p className={`text-lg font-bold mt-0.5 ${kpis.noOwner > 0 ? 'text-amber-400' : 'text-white'}`}>{kpis.noOwner}</p>
            </div>
            <div className="hidden lg:flex bg-[#1e0f35]/80 rounded-xl px-4 py-3 border border-purple-800/20 items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-purple-300/40 uppercase tracking-wider font-medium mb-1.5">Funil</p>
                <div className="flex flex-col items-center gap-[2px]">
                  {(() => {
                    const funnelStatuses = ALL_STATUSES.filter(s => !['CONVERTIDO', 'PERDIDO'].includes(s));
                    const funnelLabels: Record<string, string> = { NOVO: 'Novo', EM_PROSPECCAO: 'Prospecção', CONTATADO: 'Contatado', REUNIAO_MARCADA: 'Reunião' };
                    const funnelColors = ['#a3a3a3', '#f59e0b', '#3b82f6', '#22c55e'];
                    const total = funnelStatuses.length;
                    return funnelStatuses.map((status, i) => {
                      const count = grouped[status]?.length || 0;
                      const widthPct = 100 - (i / total) * 60;
                      return (
                        <div
                          key={status}
                          className="flex items-center justify-center relative transition-all"
                          style={{
                            width: `${widthPct}%`,
                            height: '14px',
                            backgroundColor: `${funnelColors[i]}25`,
                            borderLeft: `2px solid ${funnelColors[i]}50`,
                            borderRight: `2px solid ${funnelColors[i]}50`,
                            borderTop: i === 0 ? `2px solid ${funnelColors[i]}50` : 'none',
                            borderBottom: i === total - 1 ? `2px solid ${funnelColors[i]}50` : 'none',
                            borderRadius: i === 0 ? '4px 4px 0 0' : i === total - 1 ? '0 0 3px 3px' : '0',
                          }}
                          title={`${funnelLabels[status]}: ${count}`}
                        >
                          <span className="text-[7px] font-bold" style={{ color: funnelColors[i] }}>
                            {funnelLabels[status]} ({count})
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === AVATAR CAINDO NO LADO DIREITO === */}
      {!loading && Object.keys(userMap).length > 0 && (() => {
        const users = Object.values(userMap);
        const fallingUser = users[talkingIndex % users.length];
        const dur = 12;
        return (
          <div
            key={`fall-${talkingIndex}-${phraseKey}`}
            className="fixed pointer-events-none z-20"
            style={{
              right: 'calc((100vw - 16rem) / 6 - 12px)',
              top: 0,
              width: '48px',
              height: '48px',
              animation: `avatar-fall-land-run ${dur}s linear forwards`,
            }}
          >
            {/* Frase — posicionada absoluta à esquerda */}
            {currentPhrase && (
              <div
                className="speech-bubble-land"
                style={{ animation: `speech-land-appear ${dur}s linear forwards` }}
              >
                {currentPhrase}
              </div>
            )}

            {/* Avatar — tamanho fixo 48x48 */}
            <div className="w-12 h-12 rounded-full overflow-hidden shadow-lg shadow-purple-900/40 border-2 border-white/20">
              {fallingUser.avatar_url ? (
                <img src={fallingUser.avatar_url} alt={fallingUser.name} className="w-12 h-12 object-cover" />
              ) : (
                <div
                  className="w-12 h-12 flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: fallingUser.color.bg, color: fallingUser.color.text }}
                >
                  {fallingUser.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>
              )}
            </div>

            {/* Perninhas — centralizadas abaixo do avatar */}
            <div className="flex gap-[6px] justify-center -mt-[1px]" style={{ animation: `legs-appear ${dur}s linear forwards` }}>
              <div
                className="w-[3px] h-[14px] rounded-full origin-top"
                style={{
                  backgroundColor: fallingUser.color.bg,
                  animation: `leg-run-left 0.18s linear infinite`,
                  animationDelay: `${dur * 0.80}s`,
                }}
              />
              <div
                className="w-[3px] h-[14px] rounded-full origin-top"
                style={{
                  backgroundColor: fallingUser.color.bg,
                  animation: `leg-run-right 0.18s linear infinite`,
                  animationDelay: `${dur * 0.80}s`,
                }}
              />
            </div>

            {/* Nome */}
            <p className="text-[9px] text-emerald-400 font-bold whitespace-nowrap text-center mt-0.5">
              {fallingUser.name.split(' ')[0]}
            </p>
          </div>
        );
      })()}

      {/* === BOARD === */}
      <div className="flex-1 overflow-hidden px-4 lg:px-6 py-4">
        {loading ? (
          <KanbanSkeleton />
        ) : (
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
        )}
      </div>

      {/* Motivo modal */}
      {(pendingDrag || pendingJump) && (
        <MotivoModal
          isOpen={showMotivoModal}
          onClose={() => { setShowMotivoModal(false); setPendingDrag(null); setPendingJump(null); }}
          onConfirm={handleMotivoConfirm}
          tipo={(pendingDrag || pendingJump)!.newStatus}
          loading={motivoLoading}
        />
      )}

      {/* AI Chat FAB */}
      <button
        onClick={() => setChatOpen(true)}
        className={`fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-purple-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 flex items-center justify-center transition-all duration-200 ${
          chatOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
        title="Assistente IA"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
      </button>

      {/* AI Chat Panel */}
      <AiChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
