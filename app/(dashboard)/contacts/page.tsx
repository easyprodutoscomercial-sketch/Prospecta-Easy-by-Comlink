'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Contact } from '@/lib/types';
import { formatStatus, getStatusColor, CONTACT_TYPE_LABELS, CONTACT_TYPE_COLORS, TEMPERATURA_LABELS, TEMPERATURA_COLORS } from '@/lib/utils/labels';
import Pagination from '@/components/ui/pagination';
import { SkeletonTable } from '@/components/ui/skeleton';
import BulkActionBar from '@/components/contacts/bulk-action-bar';
import ConfirmModal from '@/components/ui/confirm-modal';
import { useToast } from '@/lib/toast-context';
import { getUserColor, getUserInitials } from '@/lib/utils/user-colors';

interface UserInfo {
  user_id: string;
  name: string;
  color: { bg: string; text: string };
  avatar_url?: string | null;
}

type SortField = 'name' | 'company' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function ContactsPage() {
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const abortRef = useRef<AbortController | null>(null);

  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

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
        }
      } catch { /* silent */ }
    }
    fetchUsersAndMe();
  }, []);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, tipoFilter, assignedFilter]);
  useEffect(() => { loadContacts(); }, [debouncedSearch, statusFilter, tipoFilter, assignedFilter, page, sortBy, sortDir]);

  const loadContacts = async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (tipoFilter !== 'all') params.set('tipo', tipoFilter);
    if (assignedFilter !== 'all') params.set('assigned', assignedFilter);
    params.set('page', String(page));
    params.set('limit', String(limit));
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    try {
      const res = await fetch(`/api/contacts?${params.toString()}`, { signal: controller.signal });
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e: any) { if (e.name === 'AbortError') return; }
    setLoading(false);
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortDir((p) => (p === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortDir('asc'); }
  };

  const toggleSelect = (id: string) => { setSelectedIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const toggleSelectAll = () => { if (selectedIds.size === contacts.length) setSelectedIds(new Set()); else setSelectedIds(new Set(contacts.map((c) => c.id))); };
  const clearSelection = () => setSelectedIds(new Set());

  const handleExport = () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (tipoFilter !== 'all') params.set('tipo', tipoFilter);
    if (assignedFilter !== 'all') params.set('assigned', assignedFilter);
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

  const selectCls = 'px-2 py-2 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
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
          <Link href="/import" className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-[#2a1245] border border-purple-700/30 rounded-lg hover:bg-purple-800/30 hover:text-white transition-all">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Importar
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-3 sm:p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <div className="relative col-span-2 sm:col-span-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-purple-700/30 rounded-lg bg-[#2a1245] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="all">Status</option>
            <option value="NOVO">Novo</option>
            <option value="EM_PROSPECCAO">Em Prospecao</option>
            <option value="CONTATADO">Contatado</option>
            <option value="REUNIAO_MARCADA">Reuniao Marcada</option>
            <option value="CONVERTIDO">Convertido</option>
            <option value="PERDIDO">Perdido</option>
          </select>
          <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} className={selectCls}>
            <option value="all">Tipo</option>
            <option value="FORNECEDOR">Fornecedor</option>
            <option value="COMPRADOR">Comprador</option>
          </select>
          <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)} className={selectCls}>
            <option value="all">Responsavel</option>
            <option value="me">Meus contatos</option>
            <option value="unassigned">Sem responsavel</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={6} cols={4} />
      ) : contacts.length === 0 ? (
        <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 text-center py-16">
          <svg className="mx-auto w-12 h-12 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          <p className="text-sm text-neutral-400 mt-3">Nenhum contato encontrado</p>
          <p className="text-xs text-neutral-600 mt-1">Tente ajustar os filtros ou criar um novo contato</p>
        </div>
      ) : (
        <>
          {/* Sort + select all */}
          <div className="flex items-center gap-2 px-1 flex-wrap">
            <input type="checkbox" checked={contacts.length > 0 && selectedIds.size === contacts.length} onChange={toggleSelectAll} className="rounded border-neutral-600 bg-[#2a1245] text-emerald-500 focus:ring-emerald-500" />
            <span className="text-xs text-neutral-500">Selecionar todos</span>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => handleSort('name')} className="text-[11px] text-neutral-500 hover:text-emerald-400 transition-colors">
                Nome {sortBy === 'name' ? (sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
              </button>
              <button onClick={() => handleSort('created_at')} className="text-[11px] text-neutral-500 hover:text-emerald-400 transition-colors">
                Data {sortBy === 'created_at' ? (sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
              </button>
              <button onClick={() => handleSort('status')} className="text-[11px] text-neutral-500 hover:text-emerald-400 transition-colors">
                Status {sortBy === 'status' ? (sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {contacts.map((contact) => {
              const isUnassigned = !contact.assigned_to_user_id;
              const ownerId = contact.assigned_to_user_id || '';
              const owner = userMap[ownerId];
              const ownerColor = ownerId ? getUserColor(ownerId) : null;
              const isSelected = selectedIds.has(contact.id);

              return (
                <div key={contact.id} className={`bg-[#1e0f35] rounded-xl border transition-all ${isSelected ? 'border-emerald-500 ring-1 ring-emerald-500/20' : 'border-purple-800/30 hover:border-purple-700/30'}`}>
                  <div className="p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(contact.id)} className="mt-1 rounded border-neutral-600 bg-[#2a1245] text-emerald-500 focus:ring-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/contacts/${contact.id}`} className="text-sm font-semibold text-white hover:text-emerald-400 transition-colors truncate">
                            {contact.name}
                          </Link>
                          {contact.tipo?.map((t) => (
                            <span key={t} className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${CONTACT_TYPE_COLORS[t] || 'bg-[#2a1245] text-neutral-400'}`}>
                              {CONTACT_TYPE_LABELS[t] || t}
                            </span>
                          ))}
                          {contact.temperatura && (
                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${TEMPERATURA_COLORS[contact.temperatura] || ''}`}>
                              {TEMPERATURA_LABELS[contact.temperatura] || contact.temperatura}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 mt-2 text-xs">
                          <div>
                            <span className="text-purple-300 text-[10px] font-bold uppercase tracking-wider">Empresa</span>
                            <p className="text-neutral-200 truncate">{contact.company || <span className="text-neutral-600">-</span>}</p>
                          </div>
                          <div>
                            <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Email</span>
                            <p className="text-neutral-200 truncate">{contact.email || <span className="text-neutral-600">-</span>}</p>
                          </div>
                          <div>
                            <span className="text-purple-300 text-[10px] font-bold uppercase tracking-wider">Telefone</span>
                            <p className="text-neutral-200">{contact.phone || <span className="text-neutral-600">-</span>}</p>
                          </div>
                          <div>
                            <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Data</span>
                            <p className="text-neutral-200">{new Date(contact.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                      </div>

                      {/* Right: status + responsavel */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full whitespace-nowrap ${getStatusColor(contact.status)}`}>
                          {formatStatus(contact.status)}
                        </span>

                        {isUnassigned ? (
                          currentUserId ? (
                            <button onClick={(e) => { e.stopPropagation(); handleClaimContact(contact.id); }}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30 rounded-full hover:bg-emerald-500/10 hover:border-emerald-400 transition-all"
                              title="Apontar para mim">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              Apontar
                            </button>
                          ) : (
                            <span className="text-[10px] text-neutral-600">Sem resp.</span>
                          )
                        ) : (
                          <div className="flex items-center gap-2" title={owner?.name || 'Responsavel'}>
                            <div className="avatar-breathe shrink-0">
                              {owner?.avatar_url ? (
                                <img src={owner.avatar_url} alt={owner.name} className="w-9 h-9 object-cover" />
                              ) : (
                                <div className="w-9 h-9 flex items-center justify-center text-xs font-bold"
                                  style={{ backgroundColor: ownerColor?.bg || '#404040', color: ownerColor?.text || '#fff' }}>
                                  {owner ? getUserInitials(owner.name) : '?'}
                                </div>
                              )}
                            </div>
                            <span className="text-[11px] text-neutral-400 max-w-[80px] truncate hidden sm:inline">{owner?.name || '...'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-purple-800/30 px-3 sm:px-4 py-2 flex justify-end">
                    <Link href={`/contacts/${contact.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-purple-300 transition-colors">
                      Ver detalhes
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={setPage} />
        </>
      )}

      <BulkActionBar selectedCount={selectedIds.size} onChangeStatus={handleBulkStatusChange} onDelete={() => setShowBulkDeleteModal(true)} onExport={handleExport} onCancel={clearSelection} />
      <ConfirmModal isOpen={showBulkDeleteModal} onClose={() => setShowBulkDeleteModal(false)} onConfirm={handleBulkDelete}
        title="Deletar contatos" message={`Tem certeza que deseja deletar ${selectedIds.size} contato${selectedIds.size > 1 ? 's' : ''}?`} variant="danger" confirmLabel="Deletar" loading={bulkLoading} />
    </div>
  );
}
