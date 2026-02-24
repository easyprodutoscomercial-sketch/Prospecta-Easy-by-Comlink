'use client';

import { useRouter } from 'next/navigation';

const ACTIONS = [
  { label: 'Novo Contato', href: '/contacts/new', icon: '👤', color: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' },
  { label: 'Kanban', href: '/kanban', icon: '📋', color: 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/25' },
  { label: 'Modo Foco', href: '/focus', icon: '⚡', color: 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25' },
  { label: 'Contatos', href: '/contacts', icon: '📇', color: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25' },
];

export function QuickActionsWidget() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 gap-2 h-full">
      {ACTIONS.map(action => (
        <button
          key={action.href}
          onClick={() => router.push(action.href)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${action.color}`}
        >
          <span className="text-lg">{action.icon}</span>
          <span className="text-xs font-medium">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
