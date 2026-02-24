'use client';

interface BarData {
  label: string;
  value: number;
  color: string;
}

interface ChartWidgetProps {
  bars: BarData[];
}

export function ChartWidget({ bars }: ChartWidgetProps) {
  const maxVal = Math.max(...bars.map(b => b.value), 1);

  return (
    <div className="space-y-2 h-full overflow-y-auto">
      {bars.map((bar, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] text-purple-300/60 w-20 truncate shrink-0">{bar.label}</span>
          <div className="flex-1 bg-purple-800/20 rounded-full h-5 overflow-hidden">
            <div
              className="h-full rounded-full flex items-center justify-end pr-1.5 transition-all duration-500"
              style={{
                width: `${Math.max((bar.value / maxVal) * 100, 8)}%`,
                backgroundColor: bar.color,
              }}
            >
              <span className="text-[9px] font-bold text-white/90">{bar.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
