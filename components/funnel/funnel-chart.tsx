'use client';

interface FunnelStageData {
  id: string;
  name: string;
  color: string;
  count: number;
  percentage: number;
}

interface FunnelChartProps {
  stages: FunnelStageData[];
}

export function FunnelChart({ stages }: FunnelChartProps) {
  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-purple-300/40 text-sm">
        Nenhum dado de funil disponivel
      </div>
    );
  }

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="flex flex-col items-center gap-1 py-4">
      {stages.map((stage, i) => {
        const total = stages.length;
        // Width tapers from 100% at top to 40% at bottom
        const widthPct = 100 - (i / Math.max(total - 1, 1)) * 60;
        const barWidthPct = stage.count > 0 ? Math.max((stage.count / maxCount) * widthPct, 15) : 15;

        return (
          <div
            key={stage.id}
            className="relative flex items-center justify-center transition-all duration-500"
            style={{
              width: `${widthPct}%`,
              minHeight: '48px',
            }}
          >
            {/* Trapezoid background */}
            <div
              className="absolute inset-0 rounded-lg transition-all duration-500"
              style={{
                backgroundColor: `${stage.color}20`,
                borderLeft: `3px solid ${stage.color}60`,
                borderRight: `3px solid ${stage.color}60`,
                borderTop: i === 0 ? `3px solid ${stage.color}60` : 'none',
                borderBottom: i === total - 1 ? `3px solid ${stage.color}60` : 'none',
                borderRadius: i === 0 ? '12px 12px 4px 4px' : i === total - 1 ? '4px 4px 12px 12px' : '4px',
              }}
            />
            {/* Content */}
            <div className="relative z-10 flex items-center justify-between w-full px-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="text-xs font-semibold text-white">{stage.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold" style={{ color: stage.color }}>{stage.count}</span>
                <span className="text-[10px] font-medium text-purple-300/50">{stage.percentage}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
