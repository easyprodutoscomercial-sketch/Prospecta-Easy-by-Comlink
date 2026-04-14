'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import NotificationBell from '@/components/notifications/notification-bell';
import PipelineSelectorGlobal from '@/components/pipeline-selector-global';
import WorkFrontSelector from '@/components/work-fronts/work-front-selector';
import { useQueueCount, useOnlineStatus, useInstallQueueAutoFlush, processQueue } from '@/lib/offline/hooks';

interface SidebarProps {
  profileName: string | null;
  userRole: string;
  visibleMenus?: string[];
  signOutAction: () => Promise<void>;
}

const navItems = [
  {
    key: 'dashboard',
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
  },
  {
    key: 'contacts',
    href: '/contacts',
    label: 'Contatos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: 'kanban',
    href: '/kanban',
    label: 'Pipeline',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2m0 10V7m6 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    key: 'associacoes',
    href: '/associacoes',
    label: 'Associacoes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  // {
  //   href: '/work-fronts',
  //   label: 'Frentes',
  //   icon: (
  //     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  //     </svg>
  //   ),
  // },
  // {
  //   key: 'focus',
  //   href: '/focus',
  //   label: 'Modo Foco',
  //   icon: (
  //     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
  //     </svg>
  //   ),
  // },
  {
    key: 'suporte',
    href: '/suporte',
    label: 'Suporte',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    key: 'pedidos',
    href: '/pedidos-cotacoes',
    label: 'Pedidos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    key: 'calendar',
    href: '/calendar',
    label: 'Calendario',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: 'ai',
    href: '/kanban?chat=1',
    label: 'Assistente IA',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
  {
    key: 'reports',
    href: '/reports',
    label: 'Relatorios',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: 'requests',
    href: '/requests',
    label: 'Solicitacoes',
    badge: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    key: 'eventos',
    href: '/eventos',
    label: 'Feiras',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  {
    key: 'quiz-feira',
    href: '/quiz-feira',
    label: 'Quiz Feira',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5A3.375 3.375 0 0019.875 10.875 3.375 3.375 0 0016.5 7.5h-9A3.375 3.375 0 004.125 10.875 3.375 3.375 0 007.5 14.25v4.5m9-13.5V3m-9 2.25V3m4.5 0v2.25M12 3v2.25" />
      </svg>
    ),
  },
  {
    key: 'settings',
    href: '/settings',
    label: 'Configuracoes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    href: '/admin',
    label: 'Admin',
    adminOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function Sidebar({ profileName, userRole, visibleMenus, signOutAction }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [quizDia, setQuizDia] = useState<{ dia: number; total: number } | null>(null);

  // Fila offline: instala auto-flush e assina o contador pra badge visível.
  useInstallQueueAutoFlush();
  const offlineQueueCount = useQueueCount();
  const online = useOnlineStatus();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  useEffect(() => {
    const fetchQuizDia = async () => {
      try {
        const res = await fetch('/api/quiz/config');
        if (res.ok) {
          const data = await res.json();
          const cfg = data.config;
          if (cfg && cfg.data_inicio && cfg.dias_feira > 1) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const inicio = new Date(cfg.data_inicio + 'T00:00:00');
            const diffMs = hoje.getTime() - inicio.getTime();
            const dia = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
            if (dia >= 1 && dia <= cfg.dias_feira) {
              setQuizDia({ dia, total: cfg.dias_feira });
            } else {
              setQuizDia(null);
            }
          } else {
            setQuizDia(null);
          }
        }
      } catch { /* silent */ }
    };
    const fetchData = async () => {
      try {
        const [countRes, meRes, tasksRes] = await Promise.all([
          fetch('/api/access-requests/count'),
          fetch('/api/me'),
          fetch('/api/tasks/count'),
        ]);
        if (countRes.ok) { const data = await countRes.json(); setPendingCount(data.count || 0); }
        if (meRes.ok) { const data = await meRes.json(); setAvatarUrl(data.avatar_url || null); }
        if (tasksRes.ok) { const data = await tasksRes.json(); setTasksCount(data.count || 0); }
      } catch { /* silent */ }
    };
    fetchData();
    fetchQuizDia();
    const interval = setInterval(async () => {
      try {
        const [res, tasksRes] = await Promise.all([
          fetch('/api/access-requests/count'),
          fetch('/api/tasks/count'),
        ]);
        if (res.ok) { const data = await res.json(); setPendingCount(data.count || 0); }
        if (tasksRes.ok) { const data = await tasksRes.json(); setTasksCount(data.count || 0); }
      } catch { /* silent */ }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Lista interna de chaves que JA existiam quando o admin pode ter salvo
  // visible_menus pela ultima vez. Menus novos adicionados ao codigo depois
  // disso aparecem por padrao — so escondem se o admin marcar ativamente.
  // Isso evita a armadilha "feature nova some silenciosamente pra vendedor".
  const KNOWN_MENU_KEYS = new Set([
    'dashboard', 'contacts', 'kanban', 'suporte', 'pedidos', 'calendar',
    'ai', 'reports', 'requests', 'eventos', 'quiz-feira', 'settings',
  ]);

  const filteredNavItems = navItems.filter((item) => {
    if ('adminOnly' in item && item.adminOnly && userRole !== 'admin' && userRole !== 'gerente') return false;
    // Filtro por visible_menus — SO esconde menus "conhecidos" na epoca em
    // que o admin salvou. Menus novos (adicionados depois) passam livres.
    if (visibleMenus && visibleMenus.length > 0 && userRole !== 'admin' && !('adminOnly' in item)) {
      if (!('key' in item) || !item.key) return true;
      const isKnown = KNOWN_MENU_KEYS.has(item.key);
      if (isKnown && !visibleMenus.includes(item.key)) return false;
    }
    return true;
  });

  const navContent = (
    <>
      {/* Logo + Bell */}
      <div className="flex items-center justify-between py-5 px-4">
        <Link href="/dashboard" className="flex items-center">
          <Image src="/logo.png" alt="Controlei CRM" width={180} height={52} priority />
        </Link>
        <div data-tour="notifications">
          <NotificationBell />
        </div>
      </div>

      {/* Quick Search Hint */}
      <div className="px-4 pb-2">
        <button
          onClick={() => { const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }); document.dispatchEvent(e); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-purple-300/40 bg-purple-800/10 border border-purple-800/15 rounded-lg hover:bg-purple-800/20 hover:text-purple-300/60 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="flex-1 text-left">Busca rapida...</span>
          <kbd className="text-[10px] px-1.5 py-0.5 bg-purple-800/20 rounded text-purple-300/30 font-mono">Ctrl+K</kbd>
        </button>
      </div>

      {/* Offline status banner — aparece quando está offline OU quando há itens na fila */}
      {(!online || offlineQueueCount > 0) && (
        <div className="px-4 pb-2">
          <button
            onClick={() => { if (online) processQueue().catch(() => {}); }}
            disabled={!online && offlineQueueCount === 0}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-colors ${
              !online
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15'
                : 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/15 animate-pulse'
            }`}
            title={!online ? 'Sem conexão — dados ficam na fila local' : 'Clique para forçar sincronização'}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {!online ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a3 3 0 010-4.243M12 12h.01M5.636 18.364a9 9 0 010-12.728m3.536 3.536a3 3 0 000 4.243M3 3l18 18" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              )}
            </svg>
            <span className="flex-1 text-left font-semibold">
              {!online ? 'Offline' : `${offlineQueueCount} pendente${offlineQueueCount > 1 ? 's' : ''}`}
            </span>
            {offlineQueueCount > 0 && (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full min-w-[18px] text-center ${
                !online ? 'bg-amber-500/30 text-amber-200' : 'bg-red-500/30 text-red-200'
              }`}>
                {offlineQueueCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1" aria-label="Menu principal">
        {filteredNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              isActive(item.href)
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-md shadow-emerald-500/15'
                : 'text-purple-200/60 hover:bg-purple-500/10 hover:text-emerald-300 hover:translate-x-1 border border-transparent'
            }`}
          >
            {item.icon}
            {item.label}
            {'badge' in item && item.badge && pendingCount > 0 && (
              <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 text-white rounded-full min-w-[18px] text-center animate-pulse">
                {pendingCount}
              </span>
            )}
            {item.href === '/quiz-feira' && quizDia && (
              <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-purple-600/50 text-purple-200 rounded-full min-w-[18px] text-center">
                Dia {quizDia.dia}/{quizDia.total}
              </span>
            )}
            {item.href === '/dashboard' && tasksCount > 0 && (
              <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center animate-pulse badge-glow">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {tasksCount}
              </span>
            )}
            {item.href === '/eventos' && offlineQueueCount > 0 && (
              <span
                className="ml-auto flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center animate-pulse"
                title={`${offlineQueueCount} check-in(s) pendente(s) de sincronização`}
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {offlineQueueCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Pipeline Selector (global) */}
      <div data-tour="pipeline-selector">
        <PipelineSelectorGlobal />
      </div>

      {/* Work Front Selector — hidden */}
      {/* <WorkFrontSelector /> */}

      {/* User area */}
      <div className="border-t border-purple-500/15 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="avatar-orbit-sm shrink-0 w-12 h-12 rounded-full overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={profileName || ''} className="w-12 h-12 object-cover rounded-full" />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-purple-600 rounded-full flex items-center justify-center text-base font-bold text-white">
                  {profileName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <span className="text-sm text-white font-medium truncate block">{profileName}</span>
              <span className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wider">
                {{ admin: 'Admin', gerente: 'Gerente', sdr: 'SDR', closer: 'Closer', suporte: 'Suporte', user: 'Vendedor' }[userRole] || userRole}
              </span>
            </div>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="text-xs text-purple-300/50 hover:text-emerald-400 font-medium transition-colors" aria-label="Sair da conta">
              Sair
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-14 bg-[#120826] px-4 border-b border-purple-500/10">
        <div className="flex items-center">
          <button onClick={() => setMobileOpen(true)} className="text-purple-300/60 hover:text-emerald-400" aria-label="Abrir menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Image src="/logo.png" alt="Controlei CRM" width={180} height={50} className="ml-3" priority />
        </div>
        <NotificationBell />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar — overflow-y-auto + overscroll-contain pra menu longo
          em telas curtas (iPhone SE, landscape). Sem isso, os ultimos itens
          (Configuracoes, Admin) somem embaixo sem jeito de rolar. */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[#120826] flex flex-col overflow-y-auto overscroll-contain transform transition-transform duration-200 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {navContent}
      </aside>

      {/* Desktop sidebar — mesmo motivo: laptop 13" ou janela reduzida
          nao tem altura pra 13 menus + logo + search + banner + selectors. */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col bg-[#120826] overflow-y-auto overscroll-contain">
        {navContent}
      </aside>
    </>
  );
}
