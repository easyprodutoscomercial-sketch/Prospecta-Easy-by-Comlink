'use client';

import { useMemo } from 'react';
import { usePipeline } from '@/lib/pipeline-context';
import { FunnelChart } from './funnel-chart';
import { FunnelStatsTable } from './funnel-stats-table';

interface FunnelViewProps {
  allContacts: any[];
}

export function FunnelView({ allContacts }: FunnelViewProps) {
  const { currentPipeline, selectedPipelineId } = usePipeline();

  const funnelData = useMemo(() => {
    if (!currentPipeline) return [];

    const stages = currentPipeline.stages
      .filter(s => !s.is_terminal)
      .sort((a, b) => a.position - b.position);

    // Filter contacts for the selected pipeline
    const pipelineContacts = selectedPipelineId
      ? allContacts.filter(c => c.pipeline_id === selectedPipelineId)
      : allContacts;

    const total = pipelineContacts.length || 1;

    return stages.map(stage => {
      const stageContacts = pipelineContacts.filter(c => c.stage_id === stage.id);
      const count = stageContacts.length;
      const percentage = Math.round((count / total) * 100);

      // Average days in stage: mean of (now - updated_at) for contacts in this stage
      let avgDaysInStage = 0;
      if (stageContacts.length > 0) {
        const totalDays = stageContacts.reduce((sum, c) => {
          const days = Math.floor((Date.now() - new Date(c.updated_at || c.created_at).getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0);
        avgDaysInStage = Math.round(totalDays / stageContacts.length);
      }

      return {
        id: stage.id,
        name: stage.name,
        color: stage.color || '#a3a3a3',
        count,
        percentage,
        avgDaysInStage,
      };
    });
  }, [currentPipeline, allContacts, selectedPipelineId]);

  // Also compute terminal stage stats
  const terminalStats = useMemo(() => {
    if (!currentPipeline) return { won: 0, lost: 0 };
    const pipelineContacts = selectedPipelineId
      ? allContacts.filter(c => c.pipeline_id === selectedPipelineId)
      : allContacts;

    const wonStages = new Set(currentPipeline.stages.filter(s => s.terminal_type === 'won').map(s => s.id));
    const lostStages = new Set(currentPipeline.stages.filter(s => s.terminal_type === 'lost').map(s => s.id));

    return {
      won: pipelineContacts.filter(c => c.stage_id && wonStages.has(c.stage_id)).length,
      lost: pipelineContacts.filter(c => c.stage_id && lostStages.has(c.stage_id)).length,
    };
  }, [currentPipeline, allContacts, selectedPipelineId]);

  if (!currentPipeline) {
    return (
      <div className="text-center py-16 text-purple-300/40 text-sm">
        Selecione um pipeline para ver o funil
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Funnel chart */}
      <div className="bg-[#1e0f35] border border-purple-800/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-emerald-400">Funil do Pipeline</h3>
          <span className="text-xs text-purple-300/40">{currentPipeline.name}</span>
        </div>
        <FunnelChart stages={funnelData} />

        {/* Terminal stats */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-purple-800/20">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-xs text-neutral-200 font-medium">Convertidos</span>
            <span className="text-lg font-bold text-emerald-400">{terminalStats.won}</span>
          </div>
          <div className="w-px h-6 bg-purple-800/30" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-neutral-200 font-medium">Perdidos</span>
            <span className="text-lg font-bold text-red-400">{terminalStats.lost}</span>
          </div>
          {(terminalStats.won + terminalStats.lost) > 0 && (
            <>
              <div className="w-px h-6 bg-purple-800/30" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-200 font-medium">Taxa Total</span>
                <span className="text-lg font-bold text-white">
                  {Math.round((terminalStats.won / (terminalStats.won + terminalStats.lost)) * 100)}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats table */}
      <FunnelStatsTable stages={funnelData} />
    </div>
  );
}
