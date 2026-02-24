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

  if (stages.length === 0) return null;

  return (
    <div className="flex items-center gap-0 mt-2.5 pt-5 overflow-x-auto overflow-y-visible scrollbar-hide">
      {stages.map((stage, idx) => {
        const isCurrent = stage.id === currentStageId;
        const isPast = currentIndex >= 0 && idx < currentIndex;
        const isTerminal = stage.is_terminal;
        const isWon = stage.terminal_type === 'won';
        const isLost = stage.terminal_type === 'lost';

        let boxClass = '';
        let textClass = '';
        if (isCurrent) {
          if (isTerminal && isLost) {
            boxClass = 'bg-red-500/20 border-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.3)]';
            textClass = 'text-red-300 font-semibold';
          } else if (isTerminal && isWon) {
            boxClass = 'bg-emerald-500/20 border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.3)]';
            textClass = 'text-emerald-300 font-semibold';
          } else {
            boxClass = 'bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.25)]';
            textClass = 'text-emerald-300 font-semibold';
          }
        } else if (isPast) {
          boxClass = 'bg-emerald-500/10 border-emerald-500/30';
          textClass = 'text-emerald-400/60';
        } else {
          if (isTerminal) {
            boxClass = isWon
              ? 'bg-emerald-900/10 border-emerald-800/20'
              : 'bg-red-900/10 border-red-800/20';
            textClass = isWon ? 'text-emerald-500/30' : 'text-red-500/30';
          } else {
            boxClass = 'bg-purple-900/20 border-purple-700/20';
            textClass = 'text-purple-400/40';
          }
        }

        return (
          <div key={stage.id} className="flex items-center shrink-0">
            {/* Stage box */}
            <div className="relative">
              <div
                className={`px-2 py-0.5 rounded border text-[9px] leading-tight whitespace-nowrap transition-all ${boxClass}`}
                title={stage.name}
              >
                <span className={textClass}>{stage.name}</span>
              </div>
              {/* Pulsating arrow indicator */}
              {isCurrent && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 animate-bounce">
                  <svg
                    className={`w-3 h-3 ${
                      isTerminal && isLost ? 'text-red-400' : 'text-emerald-400'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
            {/* Arrow connector between stages */}
            {idx < stages.length - 1 && (
              <svg
                className={`w-3 h-3 shrink-0 mx-0.5 ${
                  isPast ? 'text-emerald-500/50' : 'text-purple-700/30'
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
