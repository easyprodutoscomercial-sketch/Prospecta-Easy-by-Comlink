'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import NotificationBell from '@/components/notifications/notification-bell';

interface SidebarProps {
  profileName: string | null;
  userRole: string;
  signOutAction: () => Promise<void>;
}

const navItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
  },
  {
    href: '/contacts',
    label: 'Contatos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/kanban',
    label: 'Pipeline',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2m0 10V7m6 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    href: '/import',
    label: 'Importar',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
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

export default function Sidebar({ profileName, userRole, signOutAction }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  useEffect(() => {
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

  const filteredNavItems = navItems.filter((item) => {
    if ('adminOnly' in item && item.adminOnly && userRole !== 'admin') return false;
    return true;
  });

  const navContent = (
    <>
      {/* Logo + Bell */}
      <div className="flex items-center justify-between py-5 px-4">
        <Link href="/dashboard" className="flex items-center">
          <Image src="/logo.png" alt="Prospecta Easy" width={180} height={52} className="brightness-0 invert" priority />
        </Link>
        <NotificationBell />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
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
            {item.href === '/dashboard' && tasksCount > 0 && (
              <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center animate-pulse badge-glow">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {tasksCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* User area */}
      <div className="border-t border-purple-500/15 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="avatar-orbit-sm shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={profileName || ''} className="w-12 h-12 object-cover" />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center text-base font-bold text-white">
                  {profileName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <span className="text-sm text-white font-medium truncate block">{profileName}</span>
              <span className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wider">
                {userRole === 'admin' ? 'Admin' : 'Vendedor'}
              </span>
            </div>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="text-xs text-purple-300/50 hover:text-emerald-400 font-medium transition-colors">
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
          <Image src="/logo.png" alt="Prospecta Easy" width={180} height={50} className="ml-3 brightness-0 invert" priority />
        </div>
        <NotificationBell />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[#120826] flex flex-col transform transition-transform duration-200 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col bg-[#120826]">
        {navContent}
      </aside>
    </>
  );
}
