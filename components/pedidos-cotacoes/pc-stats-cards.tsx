'use client';

import { PcStats } from '@/lib/types';
import { ReactNode } from 'react';

interface PcStatsCardsProps {
  stats: PcStats | null;
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

const cards: {
  key: 'total_clients' | 'total_cotacoes' | 'total_pedidos' | 'pedidos_finalizados';
  label: string;
  icon: (props: { className?: string }) => ReactNode;
  iconColor: string;
  bgColor: string;
}[] = [
  {
    key: 'total_clients',
    label: 'Total Clientes',
    icon: UsersIcon,
    iconColor: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  {
    key: 'total_cotacoes',
    label: 'Total Cotacoes',
    icon: FileTextIcon,
    iconColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  {
    key: 'total_pedidos',
    label: 'Total Pedidos',
    icon: PackageIcon,
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  {
    key: 'pedidos_finalizados',
    label: 'Finalizados',
    icon: CheckCircleIcon,
    iconColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
];

export default function PcStatsCards({ stats }: PcStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className={`${card.bgColor} rounded-xl p-4 flex items-center gap-3`}
          >
            <div className={`${card.iconColor} shrink-0`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-neutral-400">{card.label}</p>
              {stats ? (
                <p className="text-2xl font-bold text-white">
                  {stats[card.key]}
                </p>
              ) : (
                <div className="h-8 w-16 bg-purple-800/30 rounded animate-pulse mt-1" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
