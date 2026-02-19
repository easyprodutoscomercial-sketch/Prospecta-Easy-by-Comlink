'use client';

import { useState } from 'react';
import type { WorkFront, WorkFrontMember, WorkFrontSprint } from '@/lib/types';
import Tabs from '@/components/ui/tabs';
import WorkFrontMembers from './work-front-members';
import WorkFrontSprints from './work-front-sprints';
import WorkFrontTagManager from './work-front-tag-manager';

interface WorkFrontDetailProps {
  workFront: WorkFront;
  members: WorkFrontMember[];
  sprints: WorkFrontSprint[];
  bugCount: number;
}

export default function WorkFrontDetail({ workFront, members: initialMembers, sprints: initialSprints, bugCount }: WorkFrontDetailProps) {
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState(initialMembers);
  const [sprints, setSprints] = useState(initialSprints);

  const tabs = [
    { key: 'members', label: 'Membros', count: members.length },
    { key: 'sprints', label: 'Sprints', count: sprints.length },
    { key: 'bugs', label: 'Bugs', count: bugCount },
    { key: 'tags', label: 'Tags' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${workFront.color}20` }}
        >
          <svg className="w-6 h-6" style={{ color: workFront.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-neutral-100">{workFront.name}</h1>
          {workFront.description && (
            <p className="text-sm text-neutral-400 mt-1">{workFront.description}</p>
          )}
        </div>
        {!workFront.is_active && (
          <span className="text-xs px-2 py-1 rounded bg-neutral-700/30 text-neutral-500 font-medium">Inativa</span>
        )}
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-4">
        {activeTab === 'members' && (
          <WorkFrontMembers workFrontId={workFront.id} members={members} setMembers={setMembers} />
        )}
        {activeTab === 'sprints' && (
          <WorkFrontSprints workFrontId={workFront.id} sprints={sprints} setSprints={setSprints} />
        )}
        {activeTab === 'bugs' && (
          <div className="text-center py-8">
            <p className="text-sm text-neutral-400">
              {bugCount > 0
                ? `${bugCount} bug${bugCount > 1 ? 's' : ''} nesta frente.`
                : 'Nenhum bug nesta frente.'}
            </p>
            <a href={`/bugs?work_front_id=${workFront.id}`} className="text-xs text-emerald-400 hover:underline mt-1 inline-block">
              Ver no painel de bugs
            </a>
          </div>
        )}
        {activeTab === 'tags' && (
          <WorkFrontTagManager />
        )}
      </div>
    </div>
  );
}
