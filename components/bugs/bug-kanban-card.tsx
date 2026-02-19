'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import type { BugReport } from '@/lib/types';
import { BUG_SEVERITY_LABELS, BUG_SEVERITY_COLORS, BUG_PRIORITY_LABELS, BUG_PRIORITY_COLORS } from '@/lib/utils/labels';
import { getUserInitials } from '@/lib/utils/user-colors';

interface BugKanbanCardProps {
  bug: BugReport;
  overlay?: boolean;
}

export function BugKanbanCard({ bug, overlay }: BugKanbanCardProps) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: bug.id,
    data: { bug },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const days = Math.floor((Date.now() - new Date(bug.created_at).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => { if (!isDragging) router.push(`/bugs/${bug.id}`); }}
      className={`bg-[#1e0f35] rounded-xl p-3 border cursor-grab select-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg border-purple-800/20 hover:border-purple-600/40 hover:bg-[#241540] hover:shadow-purple-900/20 ${
        overlay ? 'shadow-2xl ring-2 ring-emerald-500/30 rotate-2 scale-105 bg-[#241540]' : ''
      }`}
    >
      {/* Title */}
      <p className="text-sm font-medium text-neutral-100 line-clamp-2">{bug.title}</p>

      {/* Badges */}
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BUG_SEVERITY_COLORS[bug.severity] || ''}`}>
          {BUG_SEVERITY_LABELS[bug.severity] || bug.severity}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BUG_PRIORITY_COLORS[bug.priority] || ''}`}>
          {BUG_PRIORITY_LABELS[bug.priority] || bug.priority}
        </span>
        {bug.work_front_name && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-800/30 text-purple-300/60">
            {bug.work_front_name}
          </span>
        )}
      </div>

      {/* Tags */}
      {bug.tags && bug.tags.length > 0 && (
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          {bug.tags.map((tag) => (
            <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer: assignee + age */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-800/15">
        <div className="flex items-center gap-1.5">
          {bug.assigned_to_name ? (
            <div className="w-5 h-5 rounded-full bg-purple-700 flex items-center justify-center text-[8px] font-bold text-white" title={bug.assigned_to_name}>
              {getUserInitials(bug.assigned_to_name)}
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border border-dashed border-purple-500/30 flex items-center justify-center text-[8px] text-purple-300/30">?</div>
          )}
          <span className="text-[10px] text-neutral-500 truncate max-w-[80px]">
            {bug.assigned_to_name || 'Sem responsavel'}
          </span>
        </div>
        {days > 0 && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${days > 7 ? 'text-amber-400 bg-amber-500/10' : 'text-purple-300/30 bg-purple-800/20'}`}>
            {days}d
          </span>
        )}
      </div>
    </div>
  );
}
