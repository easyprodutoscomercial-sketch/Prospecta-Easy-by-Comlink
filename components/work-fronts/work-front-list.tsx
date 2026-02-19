'use client';

import type { WorkFrontWithMembers } from '@/lib/types';
import WorkFrontCard from './work-front-card';

interface WorkFrontListProps {
  workFronts: WorkFrontWithMembers[];
  loading?: boolean;
}

export default function WorkFrontList({ workFronts, loading }: WorkFrontListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#1e0f35] rounded-xl border border-purple-800/20 p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-800/30" />
              <div className="flex-1">
                <div className="h-4 bg-purple-800/30 rounded w-3/4 mb-2" />
                <div className="h-3 bg-purple-800/20 rounded w-1/2" />
              </div>
            </div>
            <div className="h-8 bg-purple-800/10 rounded mt-3" />
            <div className="flex gap-3 mt-3 pt-3 border-t border-purple-800/15">
              <div className="h-3 bg-purple-800/20 rounded w-20" />
              <div className="h-3 bg-purple-800/20 rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (workFronts.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto mb-4 text-purple-700/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <p className="text-neutral-400 text-sm">Nenhuma frente de trabalho criada</p>
        <p className="text-neutral-600 text-xs mt-1">Crie uma frente para organizar sua equipe</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {workFronts.map((wf) => (
        <WorkFrontCard key={wf.id} workFront={wf} />
      ))}
    </div>
  );
}
