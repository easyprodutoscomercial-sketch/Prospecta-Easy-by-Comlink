'use client';

import { useMemo } from 'react';
import { DashboardLayoutProvider } from '@/lib/dashboard-layout-context';
import { DashboardGrid } from './dashboard-grid';
import { usePipeline } from '@/lib/pipeline-context';

interface DashboardGridWrapperProps {
  contacts: any[];
  interactions: any[];
  meetings: any[];
  recentContacts: any[];
  allProfiles: any[];
}

export default function DashboardGridWrapper({ contacts, interactions, meetings, recentContacts, allProfiles }: DashboardGridWrapperProps) {
  const { currentPipeline } = usePipeline();

  const pipelineContacts = useMemo(() => {
    if (!currentPipeline) return contacts;
    return contacts.filter(c => c.pipeline_id === currentPipeline.id);
  }, [contacts, currentPipeline]);

  const teamData = useMemo(() => {
    const map = new Map<string, { name: string; score: number }>();
    for (const p of allProfiles) {
      map.set(p.user_id, { name: p.name || p.email || 'Sem nome', score: 0 });
    }
    for (const c of pipelineContacts) {
      const entry = map.get(c.created_by_user_id);
      if (entry) entry.score++;
    }
    return Array.from(map.values()).filter(e => e.score > 0).sort((a, b) => b.score - a.score);
  }, [pipelineContacts, allProfiles]);

  return (
    <DashboardLayoutProvider>
      <div className="mb-8">
        <DashboardGrid
          contacts={pipelineContacts}
          interactions={interactions}
          meetings={meetings}
          recentContacts={recentContacts}
          teamData={teamData}
        />
      </div>
    </DashboardLayoutProvider>
  );
}
