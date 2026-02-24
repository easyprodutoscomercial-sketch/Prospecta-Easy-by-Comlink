import { PipelineStage } from '@/lib/types';

interface ContactMiniPipelineProps {
  stages: PipelineStage[];
  currentStageId: string | null;
}

export default function ContactMiniPipeline({
  stages,
  currentStageId,
}: ContactMiniPipelineProps) {
  const currentIndex = stages.findIndex((s) => s.id === currentStageId);
  const currentStage = currentIndex >= 0 ? stages[currentIndex] : null;

  if (stages.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mt-2.5">
      {/* Tracker dots + line */}
      <div className="relative flex items-center flex-1 min-w-0 max-w-[200px]">
        {/* Background line */}
        <div className="absolute top-1/2 left-0 right-0 h-[2px] -translate-y-1/2 bg-purple-800/40" />
        {/* Filled line up to current */}
        {currentIndex >= 0 && (
          <div
            className="absolute top-1/2 left-0 h-[2px] -translate-y-1/2 bg-emerald-500/60"
            style={{
              width:
                stages.length > 1
                  ? `${(currentIndex / (stages.length - 1)) * 100}%`
                  : '0%',
            }}
          />
        )}
        {/* Dots */}
        <div className="relative flex justify-between w-full">
          {stages.map((stage, idx) => {
            const isCurrent = stage.id === currentStageId;
            const isPast = currentIndex >= 0 && idx < currentIndex;
            const isFuture = currentIndex >= 0 && idx > currentIndex;
            const isTerminal = stage.is_terminal;
            const isWon = stage.terminal_type === 'won';
            const isLost = stage.terminal_type === 'lost';

            let dotClass = '';
            if (isCurrent) {
              if (isTerminal && isLost) {
                dotClass = 'w-2.5 h-2.5 bg-red-500 ring-2 ring-red-400/50 ring-offset-1 ring-offset-[#1e0f35]';
              } else {
                dotClass = 'w-2.5 h-2.5 bg-emerald-500 ring-2 ring-emerald-400/50 ring-offset-1 ring-offset-[#1e0f35]';
              }
            } else if (isPast) {
              dotClass = 'w-1.5 h-1.5 bg-emerald-500/70';
            } else if (isFuture) {
              if (isTerminal) {
                dotClass = isWon
                  ? 'w-1.5 h-1.5 bg-emerald-500/20 border border-emerald-500/30'
                  : 'w-1.5 h-1.5 bg-red-500/20 border border-red-500/30';
              } else {
                dotClass = 'w-1.5 h-1.5 bg-purple-700/40 border border-purple-600/30';
              }
            } else {
              dotClass = 'w-1.5 h-1.5 bg-purple-700/40 border border-purple-600/30';
            }

            return (
              <div
                key={stage.id}
                className={`rounded-full shrink-0 ${dotClass}`}
                title={stage.name}
              />
            );
          })}
        </div>
      </div>

      {/* Current stage name */}
      {currentStage && (
        <span
          className={`text-[10px] font-medium truncate ${
            currentStage.is_terminal && currentStage.terminal_type === 'lost'
              ? 'text-red-400'
              : 'text-emerald-400/80'
          }`}
        >
          {currentStage.name}
        </span>
      )}
    </div>
  );
}
