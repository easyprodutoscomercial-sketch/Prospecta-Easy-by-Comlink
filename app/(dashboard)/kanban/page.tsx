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
import type { Contact, ContactStatus, ContactType, PipelineSettings, PipelineStage, PipelineType, KanbanViewMode } from '@/lib/types';
import { TEMPERATURA_LABELS, ORIGEM_LABELS, PROXIMA_ACAO_LABELS, ESTADOS_BRASIL } from '@/lib/utils/labels';
import { useToast } from '@/lib/toast-context';
import { usePipeline } from '@/lib/pipeline-context';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { KanbanSkeleton } from '@/components/kanban/kanban-skeleton';
import type { UserInfo } from '@/components/kanban/kanban-card';
import { KanbanFilterBar } from '@/components/kanban/kanban-filter-bar';
import { KanbanKpiBar } from '@/components/kanban/kanban-kpi-bar';
import { KanbanFilterPopover, FilterChips } from '@/components/kanban/kanban-filter-popover';
import { KanbanListView } from '@/components/kanban/kanban-list-view';
import KanbanViewToggle from '@/components/kanban/kanban-view-toggle';
import ContactPreviewDrawer from '@/components/kanban/contact-preview-drawer';
import { getUserColor } from '@/lib/utils/user-colors';
import MotivoModal from '@/components/ui/motivo-modal';
import MeetingModal from '@/components/meetings/meeting-modal';
import AiChatPanel from '@/components/ai-chat-panel';
import { normalizeSearch } from '@/lib/utils/normalize';
import { useSessionState } from '@/lib/hooks/use-session-state';
import { useIsMobile } from '@/lib/hooks/use-is-mobile';


// Sons usando Web Audio API
function playSound(type: 'celebrate' | 'sad') {
  try {
    const ctx = new AudioContext();
    if (type === 'celebrate') {
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

// localStorage helpers for collapsed columns
function loadCollapsedColumns(pipelineId: string): Set<string> {
  try {
    const raw = localStorage.getItem('kanban:collapsed-columns');
    if (!raw) return new Set();
    const data = JSON.parse(raw);
    return new Set(data[pipelineId] || []);
  } catch { return new Set(); }
}

function saveCollapsedColumns(pipelineId: string, collapsed: Set<string>) {
  try {
    const raw = localStorage.getItem('kanban:collapsed-columns');
    const data = raw ? JSON.parse(raw) : {};
    data[pipelineId] = Array.from(collapsed);
    localStorage.setItem('kanban:collapsed-columns', JSON.stringify(data));
  } catch {}
}

export default function KanbanPage() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const { pipelines, selectedPipelineId, setSelectedPipelineId, currentPipeline, refetch: refetchPipelines } = usePipeline();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useSessionState('kanban:search', '');
  const [tipoFilter, setTipoFilter] = useSessionState<'' | ContactType>('kanban:tipo', '');
  const [responsavelFilter, setResponsavelFilter] = useSessionState('kanban:responsavel', '');
  const [temperaturaFilter, setTemperaturaFilter] = useSessionState('kanban:temperatura', '');
  const [origemFilter, setOrigemFilter] = useSessionState('kanban:origemFilter', '');
  const [classeFilter, setClasseFilter] = useSessionState('kanban:classe', '');
  const [estadoFilter, setEstadoFilter] = useSessionState('kanban:estado', '');
  const [proximaAcaoFilter, setProximaAcaoFilter] = useSessionState('kanban:proximaAcao', '');
  const [feiraFilter, setFeiraFilter] = useSessionState('kanban:feira', '');
  const [eventOptions, setEventOptions] = useState<{ id: string; name: string; cover_image_url?: string | null }[]>([]);
  const [advSearch, setAdvSearch] = useSessionState('kanban:advSearch', { cpf: '', cnpj: '', whatsapp: '', empresa: '', cidade: '', telefone: '', referencia: '', contato_nome: '', cargo: '', produtos_fornecidos: '' });
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});
  const [showMotivoModal, setShowMotivoModal] = useState(false);
  const [pendingDrag, setPendingDrag] = useState<{ contactId: string; newStageId: string; terminalType: 'won' | 'lost' } | null>(null);
  const [pendingJump, setPendingJump] = useState<{ contactId: string; newStageId: string; terminalType: 'won' | 'lost' } | null>(null);
  const [motivoLoading, setMotivoLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');
  const [pipelineSettings, setPipelineSettings] = useState<PipelineSettings | null>(null);
  const [emojiParticles, setEmojiParticles] = useState<EmojiParticle[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingContact, setMeetingContact] = useState<{ id: string; name: string } | null>(null);
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [contactsWithMeeting, setContactsWithMeeting] = useState<Set<string>>(new Set());
  const [lastInteractionMap, setLastInteractionMap] = useState<Record<string, string>>({});
  const [attachmentCountMap, setAttachmentCountMap] = useState<Record<string, number>>({});
  const [totalContactsFromApi, setTotalContactsFromApi] = useState<number>(0);
  const [pendingRequestContactIds, setPendingRequestContactIds] = useState<Set<string>>(new Set());

  // Kanban chip filter state
  const [dimmedContactIds, setDimmedContactIds] = useState<Set<string>>(new Set());
  const [hiddenContactIds, setHiddenContactIds] = useState<Set<string>>(new Set());
  const [stuckContactIds, setStuckContactIds] = useState<Set<string>>(new Set());

  // New UX state
  const [viewMode, setViewMode] = useState<KanbanViewMode>('kanban');
  const [kpiExpanded, setKpiExpanded] = useState(false);
  const [showChipFilters, setShowChipFilters] = useState(true);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [drawerContactId, setDrawerContactId] = useState<string | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [collapsedColumnsInitialized, setCollapsedColumnsInitialized] = useState(false);

  // Swimlane grouping
  const [swimlaneBy, setSwimlaneBy] = useState<'' | 'responsible' | 'temperatura' | 'origem'>('');
  const [swimlaneDropdownOpen, setSwimlaneDropdownOpen] = useState(false);

  const handleChipFiltersChange = useCallback((dimmed: Set<string>, hidden: Set<string>, stuck: Set<string>) => {
    setDimmedContactIds(dimmed);
    setHiddenContactIds(hidden);
    setStuckContactIds(stuck);
  }, []);

  // Bulk selection state
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Open chat if ?chat=1 in URL
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('chat=1')) {
      setChatOpen(true);
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const stages = useMemo(() => {
    return currentPipeline?.stages || [];
  }, [currentPipeline]);

  // Stage lookup maps
  const stageMap = useMemo(() => {
    const map: Record<string, PipelineStage> = {};
    for (const s of stages) map[s.id] = s;
    return map;
  }, [stages]);

  const stageIds = useMemo(() => new Set(stages.map(s => s.id)), [stages]);

  // Initialize collapsed columns (terminal stages collapsed by default on first access)
  useEffect(() => {
    if (!selectedPipelineId || stages.length === 0 || collapsedColumnsInitialized) return;

    const stored = loadCollapsedColumns(selectedPipelineId);
    if (stored.size > 0) {
      setCollapsedColumns(stored);
    } else {
      // First access: collapse terminal stages by default
      const terminalIds = new Set(stages.filter(s => s.is_terminal).map(s => s.id));
      setCollapsedColumns(terminalIds);
      saveCollapsedColumns(selectedPipelineId, terminalIds);
    }
    setCollapsedColumnsInitialized(true);
  }, [selectedPipelineId, stages, collapsedColumnsInitialized]);

  // Reset collapsed state when pipeline changes
  useEffect(() => {
    setCollapsedColumnsInitialized(false);
  }, [selectedPipelineId]);

  const handleToggleCollapse = useCallback((stageId: string) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      if (selectedPipelineId) saveCollapsedColumns(selectedPipelineId, next);
      return next;
    });
  }, [selectedPipelineId]);

  // Collision detection that prioritizes columns (stage ids) over cards
  const columnFirstCollision: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    const columnHit = pointerCollisions.find((c) => stageIds.has(c.id as string));
    if (columnHit) return [columnHit];
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  }, [stageIds]);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, meRes, settingsRes, meetingsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/me'),
        fetch('/api/pipeline-settings'),
        fetch('/api/meetings?status=SCHEDULED'),
      ]);

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

      if (meetingsRes.ok) {
        const meetingsData = await meetingsRes.json();
        const ids = new Set<string>((meetingsData.meetings || []).map((m: any) => m.contact_id));
        setContactsWithMeeting(ids);
      }

      // Fetch last interaction per contact
      try {
        const intRes = await fetch('/api/interactions?limit=5000');
        if (intRes.ok) {
          const intData = await intRes.json();
          const map: Record<string, string> = {};
          for (const i of intData.interactions || []) {
            const existing = map[i.contact_id];
            if (!existing || i.created_at > existing) {
              map[i.contact_id] = i.created_at;
            }
          }
          setLastInteractionMap(map);
        }
      } catch { /* silent */ }

      // Fetch events for feira filter dropdown (from facets — only events with contacts)
      try {
        const facetsRes = await fetch('/api/contacts/facets');
        if (facetsRes.ok) {
          const facetsData = await facetsRes.json();
          setEventOptions(facetsData.events || []);
        }
      } catch { /* silent */ }

      // Fetch pending access requests (sent by current user)
      try {
        const arRes = await fetch('/api/access-requests?role=requester');
        if (arRes.ok) {
          const arData = await arRes.json();
          const ids = new Set<string>(
            (arData.requests || [])
              .filter((r: any) => r.status === 'PENDING')
              .map((r: any) => r.contact_id)
          );
          setPendingRequestContactIds(ids);
        }
      } catch { /* silent */ }
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    refetchPipelines();
  }, [fetchData, refetchPipelines]);

  // Current pipeline type
  const pipelineType: PipelineType = currentPipeline?.pipeline_type || 'PADRAO';

  // Fetch contacts when pipeline changes
  const fetchContacts = useCallback(async (pipelineId: string) => {
    if (!pipelineId) return;
    try {
      const res = await fetch(`/api/contacts?limit=10000&pipeline_id=${pipelineId}`);
      if (!res.ok) throw new Error('Erro ao carregar contatos');
      const data = await res.json();
      const contactsList = data.contacts || [];
      setContacts(contactsList);
      setTotalContactsFromApi(data.total ?? contactsList.length);

      // If bugs pipeline, fetch attachment counts
      const pipeline = pipelines.find(p => p.id === pipelineId);
      if (pipeline?.pipeline_type === 'BUGS' && contactsList.length > 0) {
        try {
          const contactIds = contactsList.map((c: Contact) => c.id);
          const attRes = await fetch(`/api/contacts/attachment-counts?ids=${contactIds.join(',')}`);
          if (attRes.ok) {
            const attData = await attRes.json();
            setAttachmentCountMap(attData.counts || {});
          }
        } catch { /* silent */ }
      } else {
        setAttachmentCountMap({});
      }
    } catch {
      toast.error('Erro ao carregar contatos');
    }
  }, [toast, pipelines]);

  useEffect(() => {
    if (selectedPipelineId) {
      fetchContacts(selectedPipelineId);
    }
  }, [selectedPipelineId, fetchContacts]);

  // Auto-refresh a cada 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
      refetchPipelines();
      if (selectedPipelineId) fetchContacts(selectedPipelineId);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData, fetchContacts, selectedPipelineId, refetchPipelines]);

  // Refresh ao voltar para a aba/página (garante dados frescos após ações em outras páginas)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && selectedPipelineId) {
        fetchContacts(selectedPipelineId);
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchContacts, fetchData, selectedPipelineId]);

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
      const q = normalizeSearch(search);
      result = result.filter(
        (c) =>
          normalizeSearch(c.name).includes(q) ||
          (c.company && normalizeSearch(c.company).includes(q)) ||
          c.phone?.includes(q) ||
          (c.email && normalizeSearch(c.email).includes(q))
      );
    }

    if (tipoFilter) {
      if (tipoFilter === 'AMBOS') {
        result = result.filter((c) => c.tipo?.includes('FORNECEDOR') && c.tipo?.includes('COMPRADOR'));
      } else {
        result = result.filter((c) => c.tipo?.includes(tipoFilter));
      }
    }
    if (responsavelFilter) result = result.filter((c) => responsavelFilter === '_none' ? !c.assigned_to_user_id : c.assigned_to_user_id === responsavelFilter);
    if (temperaturaFilter) result = result.filter((c) => c.temperatura === temperaturaFilter);
    if (origemFilter) result = result.filter((c) => c.origem === origemFilter);
    if (classeFilter) result = result.filter((c) => c.classe === classeFilter);
    if (estadoFilter) result = result.filter((c) => c.estado === estadoFilter);
    if (proximaAcaoFilter) result = result.filter((c) => c.proxima_acao_tipo === proximaAcaoFilter);
    if (feiraFilter) result = result.filter((c) => c.event_id === feiraFilter);

    const ilike = (val: string | null | undefined, q: string) => val ? normalizeSearch(val).includes(normalizeSearch(q)) : false;
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
  }, [contacts, search, tipoFilter, responsavelFilter, temperaturaFilter, origemFilter, classeFilter, estadoFilter, proximaAcaoFilter, feiraFilter, advSearch]);

  // Apply chip filter IDs for views that don't support dimming (list view)
  const chipFiltered = useMemo(() => {
    if (hiddenContactIds.size === 0 && dimmedContactIds.size === 0) return filtered;
    return filtered.filter(c => !hiddenContactIds.has(c.id) && !dimmedContactIds.has(c.id));
  }, [filtered, hiddenContactIds, dimmedContactIds]);

  // Group by stage_id
  const grouped = useMemo(() => {
    const groups: Record<string, Contact[]> = {};
    for (const s of stages) groups[s.id] = [];
    const firstStage = stages[0];
    for (const c of filtered) {
      if (c.stage_id && groups[c.stage_id]) {
        groups[c.stage_id].push(c);
      } else if (firstStage) {
        groups[firstStage.id].push(c);
      }
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return groups;
  }, [filtered, stages]);

  // Drag handlers
  function handleDragStart(event: DragStartEvent) {
    const contact = contacts.find((c) => c.id === event.active.id);
    setActiveContact(contact || null);
  }

  async function moveContact(contactId: string, newStageId: string, motivo?: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    const currentStage = contact.stage_id ? stageMap[contact.stage_id] : null;
    const newStage = stageMap[newStageId];
    if (!newStage) return;
    if (contact.stage_id === newStageId) return;

    const currentPos = currentStage?.position ?? -1;
    const newPos = newStage.position;
    const isForward = newPos > currentPos;

    // Optimistic update
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, stage_id: newStageId, status: newStage.slug as ContactStatus, ...(motivo ? { motivo_ganho_perdido: motivo } : {}) } : c))
    );

    if (isForward) triggerEmojis('celebrate');
    else triggerEmojis('sad');

    try {
      const body: Record<string, string> = { stage_id: newStageId };
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
      toast.success(isForward ? 'Avancou no pipeline!' : 'Status atualizado');

      // Auto-completar reunioes ao sair da coluna de reuniao
      const isOldStageReuniao = currentStage && (/reuni[aã]o/i.test(currentStage.slug || '') || /reuni[aã]o/i.test(currentStage.name || '') || currentStage.allow_meeting === true);
      const isNewStageReuniao = newStage && (/reuni[aã]o/i.test(newStage.slug || '') || /reuni[aã]o/i.test(newStage.name || '') || newStage.allow_meeting === true);

      if (isOldStageReuniao && !isNewStageReuniao && contactsWithMeeting.has(contactId)) {
        try {
          await fetch('/api/meetings/complete-by-contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact_id: contactId }),
          });
          setContactsWithMeeting((prev) => { const next = new Set(prev); next.delete(contactId); return next; });
          toast.success('Reuniao marcada como realizada');
        } catch {}
      }
    } catch (err: any) {
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, stage_id: contact.stage_id, status: contact.status } : c))
      );
      toast.error(err.message || 'Erro ao atualizar status');
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveContact(null);
    const { active, over } = event;
    if (!over) return;

    const contactId = active.id as string;
    let targetStageId = over.id as string;

    if (!stageIds.has(targetStageId)) {
      const overContact = contacts.find((c) => c.id === targetStageId);
      if (overContact?.stage_id) targetStageId = overContact.stage_id;
      else return;
    }

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact || contact.stage_id === targetStageId) return;

    // Ownership check
    if (currentUserRole !== 'admin') {
      if (!contact.assigned_to_user_id) {
        toast.error('Este contato nao tem responsavel. Aponte para voce primeiro.');
        return;
      }
      if (contact.assigned_to_user_id !== currentUserId) {
        const ownerName = userMap[contact.assigned_to_user_id]?.name || 'outro usuario';
        toast.error(`Contato atribuido a ${ownerName}. Aponte para voce primeiro.`);
        return;
      }
    }

    const targetStage = stageMap[targetStageId];
    if (targetStage?.is_terminal && targetStage.terminal_type) {
      setPendingDrag({ contactId, newStageId: targetStageId, terminalType: targetStage.terminal_type as 'won' | 'lost' });
      setShowMotivoModal(true);
      return;
    }

    await moveContact(contactId, targetStageId);
  }

  async function handleMotivoConfirm(motivo: string) {
    const pending = pendingDrag || pendingJump;
    if (!pending) return;
    setMotivoLoading(true);
    await moveContact(pending.contactId, pending.newStageId, motivo);
    setMotivoLoading(false);
    setShowMotivoModal(false);
    setPendingDrag(null);
    setPendingJump(null);
  }

  function canMoveContact(contact: Contact): boolean {
    if (currentUserRole === 'admin') return true;
    return !!contact.assigned_to_user_id && contact.assigned_to_user_id === currentUserId;
  }

  async function handleJumpForward(contactId: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    if (!canMoveContact(contact)) { toast.error('Voce nao e o responsavel deste contato.'); return; }

    const currentStage = contact.stage_id ? stageMap[contact.stage_id] : null;
    const currentPos = currentStage?.position ?? -1;
    const sortedStages = [...stages].sort((a, b) => a.position - b.position);
    const nextStage = sortedStages.find(s => s.position > currentPos);
    if (!nextStage) return;

    if (nextStage.is_terminal && nextStage.terminal_type) {
      setPendingJump({ contactId, newStageId: nextStage.id, terminalType: nextStage.terminal_type as 'won' | 'lost' });
      setShowMotivoModal(true);
      return;
    }
    await moveContact(contactId, nextStage.id);
  }

  async function handleJumpBackward(contactId: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    if (!canMoveContact(contact)) { toast.error('Voce nao e o responsavel deste contato.'); return; }

    const currentStage = contact.stage_id ? stageMap[contact.stage_id] : null;
    const currentPos = currentStage?.position ?? stages.length;
    const sortedStages = [...stages].sort((a, b) => b.position - a.position);
    const prevStage = sortedStages.find(s => s.position < currentPos);
    if (!prevStage) return;
    await moveContact(contactId, prevStage.id);
  }

  // KPI calculations
  const kpis = useMemo(() => {
    const terminalStageIds = new Set(stages.filter(s => s.is_terminal).map(s => s.id));
    const wonStageIds = new Set(stages.filter(s => s.terminal_type === 'won').map(s => s.id));
    const lostStageIds = new Set(stages.filter(s => s.terminal_type === 'lost').map(s => s.id));

    const active = contacts.filter(c => !c.stage_id || !terminalStageIds.has(c.stage_id));
    const convertidos = contacts.filter(c => c.stage_id && wonStageIds.has(c.stage_id)).length;
    const perdidos = contacts.filter(c => c.stage_id && lostStageIds.has(c.stage_id)).length;
    const closedTotal = convertidos + perdidos;
    const conversionRate = closedTotal > 0 ? Math.round((convertidos / closedTotal) * 100) : 0;
    const totalValue = active.reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
    const noOwner = active.filter(c => !c.assigned_to_user_id).length;
    return { activeCount: active.length, totalValue, conversionRate, noOwner, convertidos, perdidos };
  }, [contacts, stages]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (tipoFilter) count++;
    if (responsavelFilter) count++;
    if (temperaturaFilter) count++;
    if (origemFilter) count++;
    if (classeFilter) count++;
    if (estadoFilter) count++;
    if (proximaAcaoFilter) count++;
    if (feiraFilter) count++;
    Object.values(advSearch).forEach(v => { if (v) count++; });
    return count;
  }, [search, tipoFilter, responsavelFilter, temperaturaFilter, origemFilter, classeFilter, estadoFilter, proximaAcaoFilter, feiraFilter, advSearch]);

  function clearAllFilters() {
    setTipoFilter('');
    setResponsavelFilter('');
    setTemperaturaFilter('');
    setOrigemFilter('');
    setClasseFilter('');
    setEstadoFilter('');
    setProximaAcaoFilter('');
    setFeiraFilter('');
    setAdvSearch({ cpf: '', cnpj: '', whatsapp: '', empresa: '', cidade: '', telefone: '', referencia: '', contato_nome: '', cargo: '', produtos_fornecidos: '' });
    setSearch('');
    setFilterPopoverOpen(false);
  }

  // Filter change handler for popover
  const handleFilterChange = useCallback(<K extends keyof typeof filterState>(key: K, value: (typeof filterState)[K]) => {
    switch (key) {
      case 'tipoFilter': setTipoFilter(value as '' | ContactType); break;
      case 'responsavelFilter': setResponsavelFilter(value as string); break;
      case 'temperaturaFilter': setTemperaturaFilter(value as string); break;
      case 'origemFilter': setOrigemFilter(value as string); break;
      case 'classeFilter': setClasseFilter(value as string); break;
      case 'estadoFilter': setEstadoFilter(value as string); break;
      case 'proximaAcaoFilter': setProximaAcaoFilter(value as string); break;
      case 'feiraFilter': setFeiraFilter(value as string); break;
      case 'advSearch': setAdvSearch(value as typeof advSearch); break;
    }
  }, []);

  const filterState = useMemo(() => ({
    tipoFilter,
    responsavelFilter,
    temperaturaFilter,
    origemFilter,
    classeFilter,
    estadoFilter,
    proximaAcaoFilter,
    feiraFilter,
    advSearch,
  }), [tipoFilter, responsavelFilter, temperaturaFilter, origemFilter, classeFilter, estadoFilter, proximaAcaoFilter, feiraFilter, advSearch]);

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
      toast.success('Contato atribuido a voce');
    } catch {
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, assigned_to_user_id: null } : c))
      );
      toast.error('Erro ao apontar contato');
    }
  }

  // Request contact
  async function handleRequestContact(contactId: string) {
    if (pendingRequestContactIds.has(contactId)) {
      toast.error('Substituicao ja solicitada. Aguarde aprovacao do responsavel.');
      return;
    }

    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId }),
      });

      if (res.status === 409) {
        setPendingRequestContactIds(prev => new Set(prev).add(contactId));
        toast.error('Substituicao ja solicitada. Aguarde aprovacao do responsavel.');
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao solicitar');
      }

      setPendingRequestContactIds(prev => new Set(prev).add(contactId));
      toast.success('Substituicao solicitada! Aguarde aprovacao do responsavel.');
      fetchData();
      if (selectedPipelineId) fetchContacts(selectedPipelineId);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao solicitar contato');
    }
  }

  // Schedule meeting
  function handleScheduleMeeting(contactId: string, contactName: string) {
    setMeetingContact({ id: contactId, name: contactName });
    setShowMeetingModal(true);
  }

  async function handleMeetingConfirm(data: { title: string; meeting_at: string; duration_minutes: number; location: string; notes: string; meeting_type: string; participant_ids?: string[]; external_participants?: { name: string; email: string }[] }) {
    if (!meetingContact) return;
    setMeetingLoading(true);

    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: meetingContact.id, ...data }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao agendar');
      }

      toast.success('Reuniao agendada com sucesso!');
      setShowMeetingModal(false);
      setMeetingContact(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao agendar reuniao');
    } finally {
      setMeetingLoading(false);
    }
  }

  const motivoTipo = useMemo(() => {
    const pending = pendingDrag || pendingJump;
    if (!pending) return 'CONVERTIDO' as const;
    return pending.terminalType === 'lost' ? 'PERDIDO' as const : 'CONVERTIDO' as const;
  }, [pendingDrag, pendingJump]);

  // Bulk action handlers
  const handleBulkToggle = (contactId: string) => {
    setBulkSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const handleBulkMoveToStage = async (stageId: string) => {
    if (bulkSelectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const promises = Array.from(bulkSelectedIds).map(id =>
        fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_id: stageId }) })
      );
      await Promise.all(promises);
      toast.success(`${bulkSelectedIds.size} contatos movidos`);
      setBulkSelectedIds(new Set());
      setBulkMode(false);
      fetchContacts(selectedPipelineId);
    } catch {
      toast.error('Erro ao mover contatos');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkAssign = async (userId: string) => {
    if (bulkSelectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const promises = Array.from(bulkSelectedIds).map(id =>
        fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigned_to_user_id: userId || null }) })
      );
      await Promise.all(promises);
      toast.success(`${bulkSelectedIds.size} contatos atribuidos`);
      setBulkSelectedIds(new Set());
      setBulkMode(false);
      fetchContacts(selectedPipelineId);
    } catch {
      toast.error('Erro ao atribuir contatos');
    } finally {
      setBulkLoading(false);
    }
  };

  // Card click handler — opens drawer
  const handleCardClick = useCallback((contactId: string) => {
    setDrawerContactId(contactId);
  }, []);

  const totalInColumns = useMemo(() => {
    return Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
  }, [grouped]);

  const hasTruncation = totalContactsFromApi > contacts.length;
  const funnelStages = useMemo(() => stages.filter(s => !s.is_terminal), [stages]);

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

      {/* === TOP BAR: Compact header === */}
      <div className="bg-[#120826]/80 backdrop-blur-sm border-b border-purple-500/10 px-3 sm:px-4 lg:px-6 py-2">
        {/* Row 1: Title + Search */}
        <div className="flex items-center gap-2">
          {/* Title */}
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-purple-600/20 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2m0 10V7m6 10V7" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-white leading-tight">Pipeline</h1>
                {currentPipeline && (
                  <span className="text-[9px] font-semibold text-emerald-400/70 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5 truncate max-w-[80px] sm:max-w-[140px]">
                    {currentPipeline.name}
                  </span>
                )}
              </div>
              <p className="text-[9px] text-purple-300/40 leading-none mt-0.5">
                {totalInColumns} de {totalContactsFromApi}
                {hasTruncation && <span className="text-amber-400 ml-1">(limite)</span>}
              </p>
            </div>
          </div>

          {/* Search - grows to fill space */}
          <div className="relative flex-1 max-w-[200px] sm:max-w-[240px] ml-auto">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-300/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-[#1e0f35] border border-purple-700/20 rounded-lg text-neutral-200 placeholder:text-purple-300/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Row 2: Action buttons - scrollable on mobile */}
        <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap">
          {/* Filter button (popover) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setFilterPopoverOpen(p => !p)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                filterPopoverOpen || activeFilterCount > 0
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#1e0f35] text-purple-300/60 border border-purple-700/20 hover:text-purple-200 hover:border-purple-600/30'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>
            <KanbanFilterPopover
              filters={filterState}
              onFilterChange={handleFilterChange}
              onClearAll={clearAllFilters}
              activeFilterCount={activeFilterCount}
              userMap={userMap}
              events={eventOptions}
              isOpen={filterPopoverOpen}
              onClose={() => setFilterPopoverOpen(false)}
            />
          </div>

          {/* Bulk mode */}
          <button
            onClick={() => { setBulkMode(p => !p); setBulkSelectedIds(new Set()); }}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all shrink-0 ${
              bulkMode
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-[#1e0f35] text-purple-300/60 border border-purple-700/20 hover:text-purple-200'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {bulkMode ? bulkSelectedIds.size.toString() : ''}
          </button>

          {/* View toggle */}
          <div className="shrink-0">
            <KanbanViewToggle view={viewMode} onChange={setViewMode} />
          </div>

          {/* KPI toggle */}
          <button
            onClick={() => setKpiExpanded(p => !p)}
            className="px-2 py-1.5 rounded-lg text-[11px] font-medium bg-[#1e0f35] text-purple-300/60 border border-purple-700/20 hover:text-purple-200 transition-all shrink-0"
            title={kpiExpanded ? 'Compactar KPIs' : 'Expandir KPIs'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>

          {/* Chip filter toggle */}
          <button
            onClick={() => setShowChipFilters(p => !p)}
            className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all shrink-0 ${
              showChipFilters
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                : 'bg-[#1e0f35] text-purple-300/60 border border-purple-700/20 hover:text-purple-200'
            }`}
            title={showChipFilters ? 'Ocultar chips' : 'Mostrar chips'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </button>

          {/* Swimlane grouping dropdown */}
          {viewMode !== 'list' && (
            <div className="relative shrink-0">
              <button
                onClick={() => setSwimlaneDropdownOpen(p => !p)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                  swimlaneBy
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-[#1e0f35] text-purple-300/60 border border-purple-700/20 hover:text-purple-200 hover:border-purple-600/30'
                }`}
                title="Agrupar por raias"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">Agrupar</span>
                {swimlaneBy && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                )}
              </button>
              {swimlaneDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSwimlaneDropdownOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 z-50 bg-[#1e0f35] border border-purple-700/30 rounded-lg shadow-xl shadow-purple-900/40 py-1 min-w-[160px]">
                    {[
                      { value: '' as const, label: 'Sem agrupamento' },
                      { value: 'responsible' as const, label: 'Por Responsavel' },
                      { value: 'temperatura' as const, label: 'Por Temperatura' },
                      { value: 'origem' as const, label: 'Por Origem' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setSwimlaneBy(opt.value); setSwimlaneDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                          swimlaneBy === opt.value
                            ? 'text-cyan-400 bg-cyan-500/10'
                            : 'text-purple-200/70 hover:text-purple-100 hover:bg-purple-700/20'
                        }`}
                      >
                        {swimlaneBy === opt.value && (
                          <svg className="w-3 h-3 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Active filter chips inline */}
        {activeFilterCount > 0 && (
          <div className="mt-1.5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <div className="shrink-0">
              <FilterChips filters={filterState} onFilterChange={handleFilterChange} userMap={userMap} events={eventOptions} />
            </div>
            <button
              onClick={clearAllFilters}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* === KPI BAR (compact by default, toggleable) === */}
      {!loading && (
        <KanbanKpiBar
          kpis={kpis}
          funnelStages={funnelStages}
          grouped={grouped}
          expanded={kpiExpanded}
          onToggle={() => setKpiExpanded(p => !p)}
        />
      )}

      {/* === CHIP FILTER BAR (toggleable) === */}
      {!loading && showChipFilters && filtered.length > 0 && (
        <div className="px-2 sm:px-4 lg:px-6 py-2 border-b border-purple-500/10 bg-[#120826]/40 overflow-x-auto">
          <KanbanFilterBar
            contacts={filtered}
            userMap={userMap}
            onFiltersChange={handleChipFiltersChange}
          />
        </div>
      )}

      {/* === BOARD / LIST / COMPACT === */}
      <div className="flex-1 overflow-hidden px-2 sm:px-4 lg:px-6 py-2 sm:py-4" data-tour="kanban-board">
        {loading ? (
          <KanbanSkeleton />
        ) : viewMode === 'list' ? (
          <KanbanListView
            contacts={chipFiltered}
            stages={stages}
            userMap={userMap}
            onCardClick={handleCardClick}
            lastInteractionMap={lastInteractionMap}
            stageMap={stageMap}
          />
        ) : (
          isMobile ? (
            <KanbanBoard
              stages={stages}
              grouped={grouped}
              activeContact={null}
              userMap={userMap}
              currentUserId={currentUserId}
              onClaimContact={handleClaimContact}
              onRequestContact={handleRequestContact}
              pendingRequestContactIds={pendingRequestContactIds}
              onJumpForward={handleJumpForward}
              onJumpBackward={handleJumpBackward}
              onScheduleMeeting={handleScheduleMeeting}
              pipelineSettings={pipelineSettings}
              contactsWithMeeting={contactsWithMeeting}
              lastInteractionMap={lastInteractionMap}
              bulkMode={bulkMode}
              bulkSelectedIds={bulkSelectedIds}
              onBulkToggle={handleBulkToggle}
              pipelineType={pipelineType}
              attachmentCountMap={attachmentCountMap}
              dimmedContactIds={dimmedContactIds}
              hiddenContactIds={hiddenContactIds}
              stuckContactIds={stuckContactIds}
              compact={viewMode === 'kanban'}
              onCardClick={handleCardClick}
              collapsedColumns={collapsedColumns}
              onToggleCollapse={handleToggleCollapse}
              swimlaneBy={swimlaneBy}
            />
          ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={columnFirstCollision}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <KanbanBoard
              stages={stages}
              grouped={grouped}
              activeContact={activeContact}
              userMap={userMap}
              currentUserId={currentUserId}
              onClaimContact={handleClaimContact}
              onRequestContact={handleRequestContact}
              pendingRequestContactIds={pendingRequestContactIds}
              onJumpForward={handleJumpForward}
              onJumpBackward={handleJumpBackward}
              onScheduleMeeting={handleScheduleMeeting}
              pipelineSettings={pipelineSettings}
              contactsWithMeeting={contactsWithMeeting}
              lastInteractionMap={lastInteractionMap}
              bulkMode={bulkMode}
              bulkSelectedIds={bulkSelectedIds}
              onBulkToggle={handleBulkToggle}
              pipelineType={pipelineType}
              attachmentCountMap={attachmentCountMap}
              dimmedContactIds={dimmedContactIds}
              hiddenContactIds={hiddenContactIds}
              stuckContactIds={stuckContactIds}
              compact={viewMode === 'kanban'}
              onCardClick={handleCardClick}
              collapsedColumns={collapsedColumns}
              onToggleCollapse={handleToggleCollapse}
              swimlaneBy={swimlaneBy}
            />
          </DndContext>
          )
        )}
      </div>

      {/* Contact Preview Drawer */}
      <ContactPreviewDrawer
        contactId={drawerContactId}
        onClose={() => setDrawerContactId(null)}
        userMap={userMap}
        stages={stages}
        pipelineName={currentPipeline?.name || ''}
        onJumpForward={handleJumpForward}
        onJumpBackward={handleJumpBackward}
        onScheduleMeeting={handleScheduleMeeting}
        onClaimContact={handleClaimContact}
        onRequestContact={handleRequestContact}
        currentUserId={currentUserId}
        onInteractionAdded={() => { fetchData(); if (selectedPipelineId) fetchContacts(selectedPipelineId); }}
      />

      {/* Motivo modal */}
      {(pendingDrag || pendingJump) && (
        <MotivoModal
          isOpen={showMotivoModal}
          onClose={() => { setShowMotivoModal(false); setPendingDrag(null); setPendingJump(null); }}
          onConfirm={handleMotivoConfirm}
          tipo={motivoTipo}
          loading={motivoLoading}
        />
      )}

      {/* Meeting modal */}
      {meetingContact && (
        <MeetingModal
          isOpen={showMeetingModal}
          onClose={() => { setShowMeetingModal(false); setMeetingContact(null); }}
          onConfirm={handleMeetingConfirm}
          contactName={meetingContact.name}
          loading={meetingLoading}
          currentUserId={currentUserId}
        />
      )}

      {/* Kanban Bulk Action Bar */}
      {bulkMode && bulkSelectedIds.size > 0 && (
        <div className="fixed bottom-16 sm:bottom-20 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 bg-[#1e0f35] border border-purple-800/30 rounded-xl shadow-2xl shadow-purple-900/40 px-3 sm:px-5 py-3 flex items-center gap-2 sm:gap-3 animate-fade-in">
          <span className="text-xs font-bold text-amber-400">{bulkSelectedIds.size} selecionados</span>
          <div className="w-px h-5 bg-purple-800/30" />
          <select
            onChange={(e) => { if (e.target.value) handleBulkMoveToStage(e.target.value); e.target.value = ''; }}
            disabled={bulkLoading}
            className="text-xs bg-[#2a1245] border border-purple-700/30 rounded-lg px-2 py-1.5 text-neutral-200 focus:outline-none disabled:opacity-40"
          >
            <option value="">Mover para...</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            onChange={(e) => { if (e.target.value) handleBulkAssign(e.target.value === '_none' ? '' : e.target.value); e.target.value = ''; }}
            disabled={bulkLoading}
            className="text-xs bg-[#2a1245] border border-purple-700/30 rounded-lg px-2 py-1.5 text-neutral-200 focus:outline-none disabled:opacity-40"
          >
            <option value="">Atribuir a...</option>
            <option value="_none">Sem responsavel</option>
            {Object.entries(userMap).map(([id, u]) => <option key={id} value={id}>{u.name}</option>)}
          </select>
          <button
            onClick={() => { setBulkSelectedIds(new Set()); setBulkMode(false); }}
            className="text-xs text-red-400/70 hover:text-red-400 font-medium"
          >
            Cancelar
          </button>
          {bulkLoading && <div className="w-4 h-4 border-2 border-purple-800/30 border-t-emerald-500 rounded-full animate-spin" />}
        </div>
      )}

      {/* AI Chat FAB */}
      <button
        onClick={() => setChatOpen(true)}
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-purple-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 flex items-center justify-center transition-all duration-200 ${
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
