'use client';

import { PipelineStage } from '@/lib/types';

interface ContactPipelineTrackerProps {
  pipelineName: string;
  stages: PipelineStage[];
  currentStageId: string | null;
  onStageClick: (stage: PipelineStage) => void;
  disabled?: boolean;
}

export default function ContactPipelineTracker({
  pipelineName,
  stages,
  currentStageId,
  onStageClick,
  disabled = false,
}: ContactPipelineTrackerProps) {
  const currentIndex = stages.findIndex((s) => s.id === currentStageId);

  return (
    <div className="space-y-3">
      {/* Pipeline name badge */}
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
          {pipelineName}
        </span>
      </div>

      {/* Stage tracker */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute top-3 left-3 right-3 h-0.5 bg-purple-800/40" />
        {/* Filled line up to current */}
        {currentIndex >= 0 && (
          <div
            className="absolute top-3 left-3 h-0.5 bg-emerald-500/60 transition-all duration-300"
            style={{
              width:
                stages.length > 1
                  ? `${(currentIndex / (stages.length - 1)) * 100}%`
                  : '0%',
              maxWidth: 'calc(100% - 24px)',
            }}
          />
        )}

        {/* Stage nodes */}
        <div className="relative flex justify-between">
          {stages.map((stage, idx) => {
            const isCurrent = stage.id === currentStageId;
            const isPast = currentIndex >= 0 && idx < currentIndex;
            const isFuture = currentIndex >= 0 && idx > currentIndex;
            const isTerminal = stage.is_terminal;
            const isWon = stage.terminal_type === 'won';
            const isLost = stage.terminal_type === 'lost';

            let nodeClass = '';
            if (isCurrent) {
              nodeClass = isTerminal
                ? isWon
                  ? 'bg-emerald-500 ring-2 ring-emerald-400/50 ring-offset-2 ring-offset-[#1e0f35]'
                  : 'bg-red-500 ring-2 ring-red-400/50 ring-offset-2 ring-offset-[#1e0f35]'
                : 'bg-emerald-500 ring-2 ring-emerald-400/50 ring-offset-2 ring-offset-[#1e0f35]';
            } else if (isPast) {
              nodeClass = 'bg-emerald-500/70';
            } else if (isFuture) {
              nodeClass = isTerminal
                ? isWon
                  ? 'bg-emerald-500/20 border border-emerald-500/30'
                  : 'bg-red-500/20 border border-red-500/30'
                : 'bg-purple-700/40 border border-purple-600/30';
            } else {
              nodeClass = 'bg-purple-700/40 border border-purple-600/30';
            }

            return (
              <div
                key={stage.id}
                className="flex flex-col items-center"
                style={{ width: `${100 / stages.length}%` }}
              >
                <button
                  type="button"
                  onClick={() => !disabled && onStageClick(stage)}
                  disabled={disabled}
                  className={`relative w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white transition-all duration-200 ${nodeClass} ${
                    disabled
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer hover:scale-110'
                  }`}
                  title={`${stage.name}${isTerminal ? (isWon ? ' (Ganho)' : ' (Perdido)') : ''}`}
                >
                  {isTerminal ? (
                    isWon ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2.5l1 4H5a2 2 0 00-2 2v1a1 1 0 001 1h12a1 1 0 001-1v-1a2 2 0 00-2-2h-3.5l1-4H15a2 2 0 002-2V5a2 2 0 00-2-2H5z" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )
                  ) : (
                    isPast && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )
                  )}
                </button>
                <span
                  className={`mt-1.5 text-[9px] leading-tight text-center max-w-[60px] truncate ${
                    isCurrent
                      ? 'text-emerald-400 font-semibold'
                      : isPast
                        ? 'text-emerald-400/60'
                        : 'text-purple-300/40'
                  }`}
                  title={stage.name}
                >
                  {stage.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
