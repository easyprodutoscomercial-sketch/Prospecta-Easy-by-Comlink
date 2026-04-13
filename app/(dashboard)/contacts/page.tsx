'use client';

import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Contact } from '@/lib/types';
import { formatStatus, getStatusColor, CONTACT_TYPE_LABELS, CONTACT_TYPE_COLORS, TEMPERATURA_LABELS, TEMPERATURA_COLORS, ORIGEM_LABELS, ESTADOS_BRASIL, PROXIMA_ACAO_LABELS } from '@/lib/utils/labels';
import Pagination from '@/components/ui/pagination';
import { SkeletonTable } from '@/components/ui/skeleton';
import BulkActionBar from '@/components/contacts/bulk-action-bar';
import ConfirmModal from '@/components/ui/confirm-modal';
import SavedViews from '@/components/saved-views';
import { useToast } from '@/lib/toast-context';
import { usePipeline } from '@/lib/pipeline-context';
import { getUserColor, getUserInitials } from '@/lib/utils/user-colors';
import { useUrlFilters } from '@/lib/hooks/use-url-filters';
import { useContactPreferences } from '@/lib/hooks/use-contact-preferences';
import ContactCard from '@/components/contacts/contact-card';
import ContactsToolbar from '@/components/contacts/contacts-toolbar';
import ContactsMapView from '@/components/contacts/contacts-map-view';
import ContactsImportView from '@/components/contacts/contacts-import-view';
import EmptyState from '@/components/ui/empty-state';

interface UserInfo {
  user_id: string;
  name: string;
  color: { bg: string; text: string };
  avatar_url?: string | null;
}

type SortField = 'name' | 'company' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';

const CONTACT_FILTER_DEFS = {
  search: { type: 'text' as const, default: '' },
  status: { type: 'select' as const, default: 'all' },
  tipo: { type: 'select' as const, default: 'all' },
  assigned: { type: 'select' as const, default: 'all' },
  temperatura: { type: 'select' as const, default: 'all' },
  origem: { type: 'select' as const, default: 'all' },
  classe: { type: 'select' as const, default: 'all' },
  cidade: { type: 'text' as const, default: '' },
  estado: { type: 'select' as const, default: 'all' },
  telefone: { type: 'text' as const, default: '' },
  cpf: { type: 'text' as const, default: '' },
  cnpj: { type: 'text' as const, default: '' },
  whatsapp: { type: 'text' as const, default: '' },
  empresa: { type: 'text' as const, default: '' },
  referencia: { type: 'text' as const, default: '' },
  contato_nome: { type: 'text' as const, default: '' },
  cargo: { type: 'text' as const, default: '' },
  endereco: { type: 'text' as const, default: '' },
  cep: { type: 'text' as const, default: '' },
  website: { type: 'text' as const, default: '' },
  instagram: { type: 'text' as const, default: '' },
  produtos_fornecidos: { type: 'text' as const, default: '' },
  proxima_acao_tipo: { type: 'select' as const, default: 'all' },
  event_id: { type: 'select' as const, default: 'all' },
  page: { type: 'select' as const, default: '1' },
  sortBy: { type: 'select' as const, default: 'created_at' },
  sortDir: { type: 'select' as const, default: 'desc' },
};

export default function ContactsPage() {
  return (
    <Suspense fallback={<SkeletonTable rows={6} cols={4} />}>
      <ContactsPageContent />
    </Suspense>
  );
}

function ContactsPageContent() {
  const toast = useToast();
  const { selectedPipelineId, currentPipeline, pipelines } = usePipeline();
  const [contactsPipelineFilter, setContactsPipelineFilter] = useState('all');
  const { values: filters, inputValues, setFilter, setFilters, resetAll } = useUrlFilters(CONTACT_FILTER_DEFS);
  const prefs = useContactPreferences();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [mapContacts, setMapContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mapAbortRef = useRef<AbortController | null>(null);

  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');

  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Faceted search counters (counts per filter value across ALL contacts)
  const [facetCounts, setFacetCounts] = useState<{
    statusCounts: Record<string, number>;
    tipoCounts: Record<string, number>;
    temperaturaCounts: Record<string, number>;
    origemCounts: Record<string, number>;
    classeCounts: Record<string, number>;
    eventCounts: Record<string, number>;
    events: { id: string; name: string; cover_image_url: string | null }[];
  }>({
    statusCounts: {},
    tipoCounts: {},
    temperaturaCounts: {},
    origemCounts: {},
    classeCounts: {},
    eventCounts: {},
    events: [],
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [singleDeleteLoading, setSingleDeleteLoading] = useState(false);

  const isMapView = prefs.activeView === 'map';
  const isImportView = prefs.activeView === 'import';

  useEffect(() => {
    async function fetchUsersAndMe() {
      try {
        const [usersRes, meRes] = await Promise.all([fetch('/api/users'), fetch('/api/me')]);
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const map: Record<string, UserInfo> = {};
          for (const u of usersData.users || []) {
            map[u.user_id] = { user_id: u.user_id, name: u.name, color: getUserColor(u.user_id), avatar_url: u.avatar_url || null };
          }
          setUserMap(map);
        }
        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUserId(meData.user_id);
          setCurrentUserRole(meData.role || 'user');
        }
      } catch { /* silent */ }
    }
    fetchUsersAndMe();
  }, []);

  // Fetch faceted counts for filter dropdowns (all contacts, no filters)
  const loadFacets = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts/facets');
      if (res.ok) {
        const data = await res.json();
        setFacetCounts({
          statusCounts: data.statusCounts || {},
          tipoCounts: data.tipoCounts || {},
          temperaturaCounts: data.temperaturaCounts || {},
          origemCounts: data.origemCounts || {},
          classeCounts: data.classeCounts || {},
          eventCounts: data.eventCounts || {},
          events: data.events || [],
        });
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadFacets(); }, [loadFacets]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadContacts(); }, [JSON.stringify(filters), contactsPipelineFilter]);

  // Load all contacts for map view (no pagination)
  useEffect(() => {
    if (isMapView) loadMapContacts();
  }, [isMapView, JSON.stringify(filters), contactsPipelineFilter]);

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.tipo !== 'all') params.set('tipo', filters.tipo);
    if (filters.assigned !== 'all') params.set('assigned', filters.assigned);
    if (filters.temperatura !== 'all') params.set('temperatura', filters.temperatura);
    if (filters.origem !== 'all') params.set('origem', filters.origem);
    if (filters.classe !== 'all') params.set('classe', filters.classe);
    if (filters.cidade) params.set('cidade', filters.cidade);
    if (filters.estado !== 'all') params.set('estado', filters.estado);
    if (filters.telefone) params.set('telefone', filters.telefone);
    if (filters.cpf) params.set('cpf', filters.cpf);
    if (filters.cnpj) params.set('cnpj', filters.cnpj);
    if (filters.whatsapp) params.set('whatsapp', filters.whatsapp);
    if (filters.empresa) params.set('empresa', filters.empresa);
    if (filters.referencia) params.set('referencia', filters.referencia);
    if (filters.contato_nome) params.set('contato_nome', filters.contato_nome);
    if (filters.cargo) params.set('cargo', filters.cargo);
    if (filters.endereco) params.set('endereco', filters.endereco);
    if (filters.cep) params.set('cep', filters.cep);
    if (filters.website) params.set('website', filters.website);
    if (filters.instagram) params.set('instagram', filters.instagram);
    if (filters.proxima_acao_tipo !== 'all') params.set('proxima_acao_tipo', filters.proxima_acao_tipo);
    if (filters.produtos_fornecidos) params.set('produtos_fornecidos', filters.produtos_fornecidos);
    if (filters.event_id !== 'all') params.set('event_id', filters.event_id);
    if (contactsPipelineFilter && contactsPipelineFilter !== 'all') params.set('pipeline_id', contactsPipelineFilter);
    return params;
  }, [filters, contactsPipelineFilter]);

  const loadContacts = async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    const params = buildFilterParams();
    params.set('page', filters.page);
    params.set('limit', String(limit));
    params.set('sortBy', filters.sortBy);
    params.set('sortDir', filters.sortDir);
    try {
      const res = await fetch(`/api/contacts?${params.toString()}`, { signal: controller.signal });
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e: any) { if (e.name === 'AbortError') return; }
    setLoading(false);
    // Refresh facet counts alongside contact list
    loadFacets();
  };

  const loadMapContacts = async () => {
    if (mapAbortRef.current) mapAbortRef.current.abort();
    const controller = new AbortController();
    mapAbortRef.current = controller;
    const params = buildFilterParams();
    params.set('page', '1');
    params.set('limit', '9999');
    params.set('sortBy', filters.sortBy);
    params.set('sortDir', filters.sortDir);
    try {
      const res = await fetch(`/api/contacts?${params.toString()}`, { signal: controller.signal });
      const data = await res.json();
      setMapContacts(data.contacts || []);
    } catch (e: any) { if (e.name === 'AbortError') return; }
  };

  // Ref para sempre ter a versão mais recente de loadContacts (evita stale closure)
  const loadContactsRef = useRef(loadContacts);
  loadContactsRef.current = loadContacts;

  // Refresh ao voltar para a aba/página (usa ref para pegar page/filtros atuais)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadContactsRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const handleSort = (field: SortField) => {
    if (filters.sortBy === field) {
      setFilter('sortDir', filters.sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setFilters({ sortBy: field, sortDir: 'asc' });
    }
  };

  // Filter out hidden contacts for the list view
  const visibleContacts = useMemo(
    () => contacts.filter((c) => !prefs.hiddenContactIds.has(c.id)),
    [contacts, prefs.hiddenContactIds]
  );

  const toggleSelect = (id: string) => { setSelectedIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const toggleSelectAll = () => {
    if (selectedIds.size === visibleContacts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(visibleContacts.map((c) => c.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleExport = () => {
    const params = buildFilterParams();
    window.open(`/api/contacts/export?${params.toString()}`, '_blank');
    toast.success('Exportacao iniciada');
  };

  const handleBulkStatusChange = async (status: string) => {
    setBulkLoading(true);
    const res = await fetch('/api/contacts/batch', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selectedIds), status }) });
    if (res.ok) { toast.success(`Status atualizado para ${selectedIds.size} contatos`); clearSelection(); loadContacts(); }
    else toast.error('Erro ao atualizar status em massa');
    setBulkLoading(false);
  };

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    const res = await fetch('/api/contacts/batch', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selectedIds) }) });
    if (res.ok) { toast.success(`${selectedIds.size} contatos deletados`); clearSelection(); setShowBulkDeleteModal(false); loadContacts(); }
    else toast.error('Erro ao deletar contatos em massa');
    setBulkLoading(false);
  };

  const handleSingleDelete = async () => {
    if (!singleDeleteId) return;
    setSingleDeleteLoading(true);
    const res = await fetch(`/api/contacts/${singleDeleteId}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Contato deletado permanentemente'); setSingleDeleteId(null); loadContacts(); }
    else toast.error('Erro ao deletar contato');
    setSingleDeleteLoading(false);
  };

  const handleClaimContact = useCallback(async (contactId: string) => {
    setContacts((p) => p.map((c) => (c.id === contactId ? { ...c, assigned_to_user_id: currentUserId } : c)));
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigned_to_user_id: currentUserId }) });
      if (!res.ok) throw new Error();
      toast.success('Contato atribuido a voce');
    } catch {
      setContacts((p) => p.map((c) => (c.id === contactId ? { ...c, assigned_to_user_id: null } : c)));
      toast.error('Erro ao apontar contato');
    }
  }, [currentUserId, toast]);

  const handleToggleInexistente = useCallback(async (contactId: string) => {
    const current = contacts.find((c) => c.id === contactId);
    if (!current) return;
    const newValue = !current.inexistente;
    setContacts((p) => p.map((c) => (c.id === contactId ? { ...c, inexistente: newValue } : c)));
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inexistente: newValue }) });
      if (!res.ok) throw new Error();
      toast.success(newValue ? 'Contato marcado como inexistente' : 'Marca de inexistente removida');
    } catch {
      setContacts((p) => p.map((c) => (c.id === contactId ? { ...c, inexistente: !newValue } : c)));
      toast.error('Erro ao atualizar contato');
    }
  }, [contacts, toast]);

  const handleBulkInexistente = async () => {
    setBulkLoading(true);
    const res = await fetch('/api/contacts/batch', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selectedIds), inexistente: true }) });
    if (res.ok) { toast.success(`${selectedIds.size} contatos marcados como inexistente`); clearSelection(); loadContacts(); }
    else toast.error('Erro ao marcar contatos como inexistente');
    setBulkLoading(false);
  };

  const selectCls = 'px-2 py-2 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status !== 'all') count++;
    if (filters.tipo !== 'all') count++;
    if (filters.assigned !== 'all') count++;
    if (filters.temperatura !== 'all') count++;
    if (filters.origem !== 'all') count++;
    if (filters.classe !== 'all') count++;
    if (filters.cidade) count++;
    if (filters.estado !== 'all') count++;
    if (filters.telefone) count++;
    if (filters.cpf) count++;
    if (filters.cnpj) count++;
    if (filters.whatsapp) count++;
    if (filters.empresa) count++;
    if (filters.referencia) count++;
    if (filters.contato_nome) count++;
    if (filters.cargo) count++;
    if (filters.endereco) count++;
    if (filters.cep) count++;
    if (filters.website) count++;
    if (filters.instagram) count++;
    if (filters.produtos_fornecidos) count++;
    if (filters.proxima_acao_tipo !== 'all') count++;
    if (filters.event_id !== 'all') count++;
    if (contactsPipelineFilter !== 'all') count++;
    return count;
  }, [filters, contactsPipelineFilter]);

  function clearAllFilters() {
    resetAll();
    setContactsPipelineFilter('all');
  }

  const hiddenCount = contacts.length - visibleContacts.length;
  const pipelineStages = currentPipeline?.stages && currentPipeline.stages.length > 0 ? currentPipeline.stages : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-emerald-400">Contatos</h1>
            <p className="text-xs sm:text-sm text-purple-300/60">{total} contato{total !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/contacts/new" className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="hidden sm:inline">Novo Contato</span>
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExport} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-[#2a1245] border border-purple-700/30 rounded-lg hover:bg-purple-800/30 hover:text-white transition-all">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Exportar
          </button>
          <SavedViews
            storageKey="crm_contacts_views"
            currentFilters={{ search: inputValues.search, status: filters.status, tipo: filters.tipo, assigned: filters.assigned, temperatura: filters.temperatura, origem: filters.origem, classe: filters.classe, cidade: inputValues.cidade, estado: filters.estado, telefone: inputValues.telefone }}
            onApply={(f) => {
              setFilters({
                search: f.search || '',
                status: f.status || 'all',
                tipo: f.tipo || 'all',
                assigned: f.assigned || 'all',
                temperatura: f.temperatura || 'all',
                origem: f.origem || 'all',
                classe: f.classe || 'all',
                cidade: f.cidade || '',
                estado: f.estado || 'all',
                telefone: f.telefone || '',
              });
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-3 sm:p-4">
        {/* Filter header with count + clear button */}
        {activeFilterCount > 0 && (
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-purple-800/20">
            <span className="flex items-center gap-2 text-xs text-purple-300/70">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="font-medium text-emerald-400">{activeFilterCount}</span> filtro{activeFilterCount !== 1 ? 's' : ''} ativo{activeFilterCount !== 1 ? 's' : ''}
            </span>
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpar filtros
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Buscar..." value={inputValues.search} onChange={(e) => setFilter('search', e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={selectCls}>
            <option value="all">Status</option>
            <option value="NOVO">Novo ({facetCounts.statusCounts['NOVO'] || 0})</option>
            <option value="EM_PROSPECCAO">Em Prospecao ({facetCounts.statusCounts['EM_PROSPECCAO'] || 0})</option>
            <option value="CONTATADO">Contatado ({facetCounts.statusCounts['CONTATADO'] || 0})</option>
            <option value="REUNIAO_MARCADA">Reuniao Marcada ({facetCounts.statusCounts['REUNIAO_MARCADA'] || 0})</option>
            <option value="CONVERTIDO">Convertido ({facetCounts.statusCounts['CONVERTIDO'] || 0})</option>
            <option value="PERDIDO">Perdido ({facetCounts.statusCounts['PERDIDO'] || 0})</option>
          </select>
          <select value={filters.tipo} onChange={(e) => setFilter('tipo', e.target.value)} className={selectCls}>
            <option value="all">Tipo</option>
            <option value="FORNECEDOR">Fornecedor ({facetCounts.tipoCounts['FORNECEDOR'] || 0})</option>
            <option value="COMPRADOR">Comprador ({facetCounts.tipoCounts['COMPRADOR'] || 0})</option>
            <option value="AMBOS">Ambos ({facetCounts.tipoCounts['AMBOS'] || 0})</option>
          </select>
          <select value={filters.assigned} onChange={(e) => setFilter('assigned', e.target.value)} className={selectCls}>
            <option value="all">Responsavel</option>
            <option value="me">Meus contatos</option>
            <option value="unassigned">Sem responsavel</option>
          </select>
          <select value={filters.temperatura} onChange={(e) => setFilter('temperatura', e.target.value)} className={selectCls}>
            <option value="all">Temperatura</option>
            {Object.entries(TEMPERATURA_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label} ({facetCounts.temperaturaCounts[key] || 0})</option>
            ))}
          </select>
          <select value={contactsPipelineFilter} onChange={(e) => setContactsPipelineFilter(e.target.value)} className={selectCls}>
            <option value="all">Todos Pipelines</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {facetCounts.events.length > 0 && (
            <select value={filters.event_id} onChange={(e) => setFilter('event_id', e.target.value)} className={selectCls}>
              <option value="all">Feira / Evento</option>
              {facetCounts.events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name} ({facetCounts.eventCounts[ev.id] || 0})</option>
              ))}
            </select>
          )}
          <select value={filters.origem} onChange={(e) => setFilter('origem', e.target.value)} className={selectCls}>
            <option value="all">Origem</option>
            {Object.entries(ORIGEM_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label} ({facetCounts.origemCounts[key] || 0})</option>
            ))}
          </select>
          <select value={filters.classe} onChange={(e) => setFilter('classe', e.target.value)} className={selectCls}>
            <option value="all">Classe</option>
            <option value="A">Classe A ({facetCounts.classeCounts['A'] || 0})</option>
            <option value="B">Classe B ({facetCounts.classeCounts['B'] || 0})</option>
            <option value="C">Classe C ({facetCounts.classeCounts['C'] || 0})</option>
            <option value="D">Classe D ({facetCounts.classeCounts['D'] || 0})</option>
          </select>
          <input type="text" placeholder="Telefone..." value={inputValues.telefone} onChange={(e) => setFilter('telefone', e.target.value)} className="px-2 py-2 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input type="text" placeholder="Cidade..." value={inputValues.cidade} onChange={(e) => setFilter('cidade', e.target.value)} className="px-2 py-2 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <select value={filters.estado} onChange={(e) => setFilter('estado', e.target.value)} className={selectCls}>
            <option value="all">Estado</option>
            {ESTADOS_BRASIL.map((uf) => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
        </div>
        <button onClick={() => setShowAdvanced((p) => !p)} className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
          {showAdvanced ? 'Ocultar filtros avancados' : 'Mostrar filtros avancados'}
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mt-3 pt-3 border-t border-purple-800/20">
            <input type="text" placeholder="CPF..." value={inputValues.cpf} onChange={(e) => setFilter('cpf', e.target.value)} className={selectCls} />
            <input type="text" placeholder="CNPJ..." value={inputValues.cnpj} onChange={(e) => setFilter('cnpj', e.target.value)} className={selectCls} />
            <input type="text" placeholder="WhatsApp..." value={inputValues.whatsapp} onChange={(e) => setFilter('whatsapp', e.target.value)} className={selectCls} />
            <input type="text" placeholder="Empresa..." value={inputValues.empresa} onChange={(e) => setFilter('empresa', e.target.value)} className={selectCls} />
            <input type="text" placeholder="Referencia..." value={inputValues.referencia} onChange={(e) => setFilter('referencia', e.target.value)} className={selectCls} />
            <input type="text" placeholder="Nome Contato..." value={inputValues.contato_nome} onChange={(e) => setFilter('contato_nome', e.target.value)} className={selectCls} />
            <input type="text" placeholder="Cargo..." value={inputValues.cargo} onChange={(e) => setFilter('cargo', e.target.value)} className={selectCls} />
            <input type="text" placeholder="Endereco..." value={inputValues.endereco} onChange={(e) => setFilter('endereco', e.target.value)} className={selectCls} />
            <input type="text" placeholder="CEP..." value={inputValues.cep} onChange={(e) => setFilter('cep', e.target.value)} className={selectCls} />
            <input type="text" placeholder="Website..." value={inputValues.website} onChange={(e) => setFilter('website', e.target.value)} className={selectCls} />
            <input type="text" placeholder="Instagram..." value={inputValues.instagram} onChange={(e) => setFilter('instagram', e.target.value)} className={selectCls} />
            <input type="text" placeholder="Produtos Fornecidos..." value={inputValues.produtos_fornecidos} onChange={(e) => setFilter('produtos_fornecidos', e.target.value)} className={selectCls} />
            <select value={filters.proxima_acao_tipo} onChange={(e) => setFilter('proxima_acao_tipo', e.target.value)} className={selectCls}>
              <option value="all">Proxima Acao</option>
              {Object.entries(PROXIMA_ACAO_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Toolbar: view toggle + density slider + hidden counter */}
      <ContactsToolbar
        activeView={prefs.activeView}
        onViewChange={prefs.setActiveView}
        density={prefs.density}
        onDensityChange={prefs.setDensity}
        hiddenCount={hiddenCount}
        onRevealAll={prefs.revealAll}
        isMapView={isMapView}
      />

      {/* Content */}
      {isImportView ? (
        /* ========== IMPORT VIEW ========== */
        <ContactsImportView onImportComplete={loadContacts} />
      ) : isMapView ? (
        /* ========== MAP VIEW ========== */
        <ContactsMapView contacts={mapContacts} onEnrichComplete={loadMapContacts} />
      ) : loading ? (
        <SkeletonTable rows={6} cols={4} />
      ) : contacts.length === 0 ? (
        activeFilterCount > 0 ? (
          <EmptyState
            icon="search"
            title="Nenhum contato encontrado"
            description="Nenhum contato corresponde aos filtros aplicados. Tente ajustar os criterios de busca ou limpe os filtros."
            actions={[
              { label: 'Limpar filtros', onClick: clearAllFilters, variant: 'primary', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> },
            ]}
          />
        ) : (
          <EmptyState
            icon="contacts"
            title="Comece adicionando seus contatos"
            description="Adicione contatos manualmente ou importe uma planilha CSV para comecar a gerenciar suas oportunidades."
            actions={[
              { label: 'Criar Contato', href: '/contacts/new', variant: 'primary', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> },
              { label: 'Importar CSV', onClick: () => prefs.setActiveView('import'), variant: 'secondary', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> },
            ]}
          />
        )
      ) : (
        <>
          {/* Sort + select all */}
          <div className="flex items-center gap-2 px-1 flex-wrap">
            <input type="checkbox" checked={visibleContacts.length > 0 && selectedIds.size === visibleContacts.length} onChange={toggleSelectAll} className="rounded border-neutral-600 bg-[#2a1245] text-emerald-500 focus:ring-emerald-500" />
            <span className="text-xs text-neutral-500">Selecionar todos</span>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => handleSort('name')} className="text-[11px] text-neutral-500 hover:text-emerald-400 transition-colors">
                Nome {filters.sortBy === 'name' ? (filters.sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
              </button>
              <button onClick={() => handleSort('created_at')} className="text-[11px] text-neutral-500 hover:text-emerald-400 transition-colors">
                Data {filters.sortBy === 'created_at' ? (filters.sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
              </button>
              <button onClick={() => handleSort('status')} className="text-[11px] text-neutral-500 hover:text-emerald-400 transition-colors">
                Status {filters.sortBy === 'status' ? (filters.sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {visibleContacts.map((contact) => {
              const ownerId = contact.assigned_to_user_id || '';
              const owner = userMap[ownerId];
              const ownerColor = ownerId ? getUserColor(ownerId) : null;

              return (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  densityMode={prefs.densityMode}
                  isSelected={selectedIds.has(contact.id)}
                  onToggleSelect={toggleSelect}
                  onHide={prefs.hideContact}
                  onClaim={handleClaimContact}
                  onToggleInexistente={handleToggleInexistente}
                  onDelete={currentUserRole === 'admin' ? (id) => setSingleDeleteId(id) : undefined}
                  owner={owner}
                  ownerColor={ownerColor}
                  currentUserId={currentUserId}
                  currentPipelineStages={pipelineStages}
                />
              );
            })}
          </div>

          <Pagination page={Number(filters.page)} totalPages={totalPages} total={total} limit={limit} onPageChange={(p) => setFilter('page', String(p))} />
        </>
      )}

      <BulkActionBar selectedCount={selectedIds.size} onChangeStatus={handleBulkStatusChange} onDelete={currentUserRole === 'admin' ? () => setShowBulkDeleteModal(true) : undefined} onMarkInexistente={handleBulkInexistente} onExport={handleExport} onCancel={clearSelection} />
      <ConfirmModal isOpen={showBulkDeleteModal} onClose={() => setShowBulkDeleteModal(false)} onConfirm={handleBulkDelete}
        title="Deletar contatos" message={`Tem certeza que deseja deletar ${selectedIds.size} contato${selectedIds.size > 1 ? 's' : ''}?`} variant="danger" confirmLabel="Deletar" loading={bulkLoading} />
      <ConfirmModal isOpen={!!singleDeleteId} onClose={() => setSingleDeleteId(null)} onConfirm={handleSingleDelete}
        title="Deletar contato" message={`Deletar "${contacts.find(c => c.id === singleDeleteId)?.name || ''}"? Esta acao e irreversivel e remove de todos os usuarios.`} variant="danger" confirmLabel="Deletar" loading={singleDeleteLoading} />
    </div>
  );
}
