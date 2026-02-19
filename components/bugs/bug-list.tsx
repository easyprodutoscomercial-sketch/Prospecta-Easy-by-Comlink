'use client';

import Link from 'next/link';
import type { BugReport } from '@/lib/types';
import { BUG_STATUS_LABELS, BUG_STATUS_COLORS, BUG_SEVERITY_LABELS, BUG_SEVERITY_COLORS, BUG_PRIORITY_LABELS, BUG_PRIORITY_COLORS } from '@/lib/utils/labels';
import { getUserInitials } from '@/lib/utils/user-colors';

interface BugListProps {
  bugs: BugReport[];
  loading?: boolean;
}

export default function BugList({ bugs, loading }: BugListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-[#1e0f35] rounded-lg border border-purple-800/20 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-4 bg-purple-800/30 rounded w-2/3" />
              <div className="h-4 bg-purple-800/20 rounded w-16 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (bugs.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto mb-4 text-purple-700/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-neutral-400 text-sm">Nenhum bug encontrado</p>
        <p className="text-neutral-600 text-xs mt-1">Tente ajustar os filtros ou crie um novo bug</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bugs.map((bug) => (
        <Link
          key={bug.id}
          href={`/bugs/${bug.id}`}
          className="flex items-center gap-3 p-3 bg-[#1e0f35] rounded-lg border border-purple-800/20 hover:border-purple-600/40 hover:bg-[#241540] transition-all"
        >
          {/* Severity indicator */}
          <div className={`w-2 h-8 rounded-full shrink-0 ${
            bug.severity === 'CRITICO' ? 'bg-red-500' :
            bug.severity === 'ALTO' ? 'bg-orange-500' :
            bug.severity === 'MEDIO' ? 'bg-amber-500' : 'bg-blue-500'
          }`} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-neutral-200 truncate">{bug.title}</p>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BUG_STATUS_COLORS[bug.status]}`}>
                {BUG_STATUS_LABELS[bug.status]}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BUG_SEVERITY_COLORS[bug.severity]}`}>
                {BUG_SEVERITY_LABELS[bug.severity]}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BUG_PRIORITY_COLORS[bug.priority]}`}>
                {BUG_PRIORITY_LABELS[bug.priority]}
              </span>
              {bug.work_front_name && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-800/30 text-purple-300/50">
                  {bug.work_front_name}
                </span>
              )}
              {bug.tags?.map((tag) => (
                <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>
                  {tag.name}
                </span>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div className="flex items-center gap-2 shrink-0">
            {bug.assigned_to_name ? (
              <div className="w-6 h-6 rounded-full bg-purple-700 flex items-center justify-center text-[9px] font-bold text-white" title={bug.assigned_to_name}>
                {getUserInitials(bug.assigned_to_name)}
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full border border-dashed border-purple-500/25 flex items-center justify-center text-[9px] text-purple-300/30">?</div>
            )}
            <span className="text-[10px] text-neutral-500">
              {new Date(bug.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
