'use client';

import Link from 'next/link';

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  icon?: React.ReactNode;
}

interface EmptyStateProps {
  icon?: 'contacts' | 'pipeline' | 'interactions' | 'meetings' | 'search' | 'tasks';
  title: string;
  description: string;
  actions?: EmptyStateAction[];
}

const ICONS: Record<string, React.ReactNode> = {
  contacts: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="30" className="stroke-purple-500/20" strokeWidth="2" strokeDasharray="4 4" />
      <circle cx="32" cy="24" r="8" className="fill-purple-500/10 stroke-purple-400/30" strokeWidth="1.5" />
      <path d="M18 44c0-7.732 6.268-14 14-14s14 6.268 14 14" className="stroke-purple-400/30" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="48" cy="20" r="5" className="fill-emerald-500/10 stroke-emerald-400/30" strokeWidth="1.5" />
      <path d="M40 32c2.5-1.5 5.5-2 8-1" className="stroke-emerald-400/20" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <line x1="44" y1="18" x2="52" y2="18" className="stroke-emerald-400/40" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="48" y1="14" x2="48" y2="22" className="stroke-emerald-400/40" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  pipeline: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64">
      <rect x="4" y="16" width="14" height="32" rx="3" className="fill-purple-500/10 stroke-purple-400/30" strokeWidth="1.5" />
      <rect x="25" y="22" width="14" height="26" rx="3" className="fill-emerald-500/10 stroke-emerald-400/30" strokeWidth="1.5" />
      <rect x="46" y="28" width="14" height="20" rx="3" className="fill-blue-500/10 stroke-blue-400/30" strokeWidth="1.5" />
      <path d="M18 32h7M39 35h7" className="stroke-purple-400/20" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
    </svg>
  ),
  interactions: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="30" className="stroke-purple-500/20" strokeWidth="2" strokeDasharray="4 4" />
      <rect x="14" y="20" width="24" height="16" rx="4" className="fill-purple-500/10 stroke-purple-400/30" strokeWidth="1.5" />
      <rect x="26" y="28" width="24" height="16" rx="4" className="fill-emerald-500/10 stroke-emerald-400/30" strokeWidth="1.5" />
      <line x1="18" y1="26" x2="30" y2="26" className="stroke-purple-300/20" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="30" x2="26" y2="30" className="stroke-purple-300/15" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="30" y1="34" x2="42" y2="34" className="stroke-emerald-300/20" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="30" y1="38" x2="38" y2="38" className="stroke-emerald-300/15" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  meetings: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64">
      <rect x="10" y="14" width="44" height="36" rx="4" className="fill-purple-500/10 stroke-purple-400/30" strokeWidth="1.5" />
      <line x1="10" y1="24" x2="54" y2="24" className="stroke-purple-400/20" strokeWidth="1.5" />
      <line x1="20" y1="14" x2="20" y2="10" className="stroke-purple-400/30" strokeWidth="2" strokeLinecap="round" />
      <line x1="44" y1="14" x2="44" y2="10" className="stroke-purple-400/30" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="36" r="6" className="fill-emerald-500/10 stroke-emerald-400/30" strokeWidth="1.5" />
      <path d="M32 33v4l2.5 1.5" className="stroke-emerald-400/50" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  search: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64">
      <circle cx="28" cy="28" r="16" className="fill-purple-500/10 stroke-purple-400/30" strokeWidth="1.5" />
      <line x1="40" y1="40" x2="54" y2="54" className="stroke-purple-400/30" strokeWidth="3" strokeLinecap="round" />
      <line x1="22" y1="28" x2="34" y2="28" className="stroke-purple-300/20" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="22" x2="30" y2="22" className="stroke-purple-300/15" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="34" x2="28" y2="34" className="stroke-purple-300/15" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  tasks: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64">
      <rect x="12" y="10" width="40" height="44" rx="4" className="fill-purple-500/10 stroke-purple-400/30" strokeWidth="1.5" />
      <path d="M22 24l3 3 7-7" className="stroke-emerald-400/50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="38" y1="22" x2="46" y2="22" className="stroke-purple-300/20" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="20" y="34" width="8" height="8" rx="2" className="stroke-purple-400/20" strokeWidth="1.5" />
      <line x1="38" y1="38" x2="46" y2="38" className="stroke-purple-300/15" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

export default function EmptyState({ icon = 'contacts', title, description, actions }: EmptyStateProps) {
  return (
    <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 text-center py-12 px-6">
      <div className="flex justify-center mb-4 opacity-60">
        {ICONS[icon]}
      </div>
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-purple-300/50 max-w-sm mx-auto mb-5">{description}</p>
      {actions && actions.length > 0 && (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {actions.map((action, idx) => {
            const cls = action.variant === 'primary'
              ? 'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 btn-press'
              : 'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-neutral-300 bg-[#2a1245] border border-purple-700/30 rounded-lg hover:bg-purple-800/30 hover:text-white transition-all btn-press';

            if (action.href) {
              return (
                <Link key={idx} href={action.href} className={cls}>
                  {action.icon}
                  {action.label}
                </Link>
              );
            }
            return (
              <button key={idx} onClick={action.onClick} className={cls}>
                {action.icon}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
