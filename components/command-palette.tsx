'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { formatStatus, getStatusColor } from '@/lib/utils/labels';

interface ContactResult {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  status: string;
}

interface NavPage {
  label: string;
  href: string;
  icon: string;
}

const NAV_PAGES: NavPage[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'Contatos', href: '/contacts', icon: '👤' },
  { label: 'Pipeline', href: '/kanban', icon: '📋' },
  { label: 'Calendario', href: '/calendar', icon: '📅' },
  { label: 'Importar', href: '/import', icon: '📥' },
  { label: 'Configuracoes', href: '/settings', icon: '⚙' },
  { label: 'Admin', href: '/admin', icon: '🔒' },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<ContactResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Total items for keyboard navigation
  const items = query.trim().length > 0 ? contacts : NAV_PAGES;
  const itemCount = items.length;

  // Open/close with Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      // Small delay to ensure the modal is rendered
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // Reset state on close
      setQuery('');
      setContacts([]);
      setActiveIndex(0);
    }
  }, [open]);

  // Reset active index when items change
  useEffect(() => {
    setActiveIndex(0);
  }, [contacts, query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Debounced search
  const fetchContacts = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setContacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/contacts?search=${encodeURIComponent(searchQuery)}&limit=8`
      );
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      } else {
        setContacts([]);
      }
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        fetchContacts(value);
      }, 300);
    },
    [fetchContacts]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Navigate to a contact
  const navigateToContact = useCallback(
    (id: string) => {
      setOpen(false);
      router.push(`/contacts/${id}`);
    },
    [router]
  );

  // Navigate to a page
  const navigateToPage = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  // Select the currently active item
  const selectActiveItem = useCallback(() => {
    if (query.trim().length > 0) {
      // Contact results
      if (contacts[activeIndex]) {
        navigateToContact(contacts[activeIndex].id);
      }
    } else {
      // Nav pages
      if (NAV_PAGES[activeIndex]) {
        navigateToPage(NAV_PAGES[activeIndex].href);
      }
    }
  }, [query, contacts, activeIndex, navigateToContact, navigateToPage]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(itemCount, 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev <= 0 ? Math.max(itemCount - 1, 0) : prev - 1
        );
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        selectActiveItem();
        return;
      }
    },
    [itemCount, selectActiveItem]
  );

  if (!open) return null;

  const showingContacts = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="max-w-lg w-full mx-auto mt-[20vh] bg-[#1e0f35] border border-purple-800/30 rounded-xl shadow-2xl overflow-hidden relative">
        {/* Search input */}
        <div className="flex items-center px-4 border-b border-purple-800/20">
          {/* Magnifying glass icon */}
          <svg
            className="w-4 h-4 text-purple-300/40 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Buscar contatos, paginas..."
            className="w-full px-4 py-3 bg-transparent text-neutral-100 placeholder:text-purple-300/40 text-sm focus:outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin shrink-0" />
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {showingContacts ? (
            <>
              {contacts.length === 0 && !loading && (
                <div className="px-4 py-8 text-center text-sm text-purple-300/40">
                  Nenhum contato encontrado
                </div>
              )}
              {contacts.map((contact, index) => (
                <div
                  key={contact.id}
                  data-active={index === activeIndex}
                  onClick={() => navigateToContact(contact.id)}
                  className={`px-4 py-2.5 cursor-pointer transition-colors flex items-center gap-3 ${
                    index === activeIndex
                      ? 'bg-purple-800/20'
                      : 'hover:bg-purple-800/20'
                  }`}
                >
                  {/* Avatar placeholder */}
                  <div className="w-8 h-8 rounded-full bg-purple-700/30 flex items-center justify-center text-xs text-purple-300 shrink-0">
                    {contact.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  {/* Contact info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-neutral-100 truncate">
                        {contact.name}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${getStatusColor(
                          contact.status
                        )}`}
                      >
                        {formatStatus(contact.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-purple-300/50">
                      {contact.company && (
                        <span className="truncate">{contact.company}</span>
                      )}
                      {contact.company && contact.phone && (
                        <span>·</span>
                      )}
                      {contact.phone && (
                        <span className="shrink-0">{contact.phone}</span>
                      )}
                    </div>
                  </div>

                  {/* Arrow indicator */}
                  {index === activeIndex && (
                    <svg
                      className="w-4 h-4 text-purple-400/50 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>
                  )}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="px-4 pt-2 pb-1">
                <span className="text-[10px] uppercase tracking-wider text-purple-300/30 font-medium">
                  Paginas
                </span>
              </div>
              {NAV_PAGES.map((page, index) => (
                <div
                  key={page.href}
                  data-active={index === activeIndex}
                  onClick={() => navigateToPage(page.href)}
                  className={`px-4 py-2.5 cursor-pointer transition-colors flex items-center gap-3 ${
                    index === activeIndex
                      ? 'bg-purple-800/20'
                      : 'hover:bg-purple-800/20'
                  }`}
                >
                  <span className="text-sm w-6 text-center">{page.icon}</span>
                  <span className="text-sm text-neutral-100">{page.label}</span>
                  {index === activeIndex && (
                    <svg
                      className="w-4 h-4 text-purple-400/50 shrink-0 ml-auto"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="px-4 py-2 border-t border-purple-800/20 flex items-center justify-center gap-3">
          <span className="text-[10px] text-purple-300/30">
            ↑↓ Navegar
          </span>
          <span className="text-[10px] text-purple-300/30">•</span>
          <span className="text-[10px] text-purple-300/30">
            Enter Selecionar
          </span>
          <span className="text-[10px] text-purple-300/30">•</span>
          <span className="text-[10px] text-purple-300/30">
            Esc Fechar
          </span>
        </div>
      </div>
    </div>
  );
}
