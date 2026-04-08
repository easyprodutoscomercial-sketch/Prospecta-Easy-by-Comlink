'use client';

import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Navegacao" className="flex items-center gap-1.5 text-xs text-purple-300/50 mb-4">
      <Link href="/dashboard" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span className="hidden sm:inline">Inicio</span>
      </Link>
      {items.map((item, idx) => (
        <span key={idx} className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-purple-500/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {item.href && idx < items.length - 1 ? (
            <Link href={item.href} className="hover:text-emerald-400 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-purple-200/70 font-medium truncate max-w-[200px]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
