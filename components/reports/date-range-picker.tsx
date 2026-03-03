'use client';

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
];

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const setPreset = (days: number) => {
    const toDate = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    onChange(fromDate, toDate);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          onClick={() => setPreset(p.days)}
          className="px-2.5 py-1 text-xs font-medium rounded-md bg-purple-800/20 text-purple-300/60 hover:bg-purple-800/30 hover:text-purple-300 transition-colors"
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
          className="px-2 py-1 text-xs bg-[#2a1245] border border-purple-700/30 text-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        />
        <span className="text-purple-300/30 text-xs">ate</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
          className="px-2 py-1 text-xs bg-[#2a1245] border border-purple-700/30 text-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        />
      </div>
    </div>
  );
}
