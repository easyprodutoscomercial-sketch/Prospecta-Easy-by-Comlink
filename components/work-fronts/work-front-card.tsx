'use client';

import Link from 'next/link';
import type { WorkFrontWithMembers } from '@/lib/types';
import { SPRINT_STATUS_COLORS, SPRINT_STATUS_LABELS } from '@/lib/utils/labels';

interface WorkFrontCardProps {
  workFront: WorkFrontWithMembers;
}

export default function WorkFrontCard({ workFront }: WorkFrontCardProps) {
  const memberCount = workFront.members?.length || 0;
  const bugCount = workFront.bug_count || 0;
  const sprint = workFront.active_sprint;

  return (
    <Link
      href={`/work-fronts/${workFront.id}`}
      className="block bg-[#1e0f35] rounded-xl border border-purple-800/20 hover:border-purple-600/40 hover:bg-[#241540] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-900/20 p-4"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${workFront.color}20` }}
        >
          <svg className="w-5 h-5" style={{ color: workFront.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-neutral-100 truncate">{workFront.name}</h3>
          {workFront.description && (
            <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{workFront.description}</p>
          )}
        </div>
        {!workFront.is_active && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700/30 text-neutral-500 font-medium">Inativa</span>
        )}
      </div>

      {/* Sprint ativo */}
      {sprint && (
        <div className="mt-3 px-2.5 py-1.5 rounded-lg bg-[#160b2e] border border-purple-800/10">
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-purple-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-[10px] font-medium text-neutral-400 truncate">{sprint.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto ${SPRINT_STATUS_COLORS[sprint.status] || ''}`}>
              {SPRINT_STATUS_LABELS[sprint.status] || sprint.status}
            </span>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-purple-800/15">
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          {bugCount} {bugCount === 1 ? 'bug' : 'bugs'}
        </div>

        {/* Member avatars */}
        <div className="flex -space-x-1.5 ml-auto">
          {workFront.members?.slice(0, 4).map((m) => (
            <div
              key={m.user_id}
              className="w-6 h-6 rounded-full border-2 border-[#1e0f35] flex items-center justify-center text-[8px] font-bold bg-purple-700 text-white"
              title={m.user_name || ''}
            >
              {(m.user_name || '?').charAt(0).toUpperCase()}
            </div>
          ))}
          {memberCount > 4 && (
            <div className="w-6 h-6 rounded-full border-2 border-[#1e0f35] flex items-center justify-center text-[8px] font-bold bg-purple-900 text-purple-300">
              +{memberCount - 4}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
