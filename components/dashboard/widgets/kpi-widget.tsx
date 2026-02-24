'use client';

interface KpiWidgetProps {
  value: number | string;
  subtitle?: string;
  color?: string;
  icon?: React.ReactNode;
}

export function KpiWidget({ value, subtitle, color = 'text-emerald-400', icon }: KpiWidgetProps) {
  return (
    <div className="flex items-center justify-between h-full">
      <div>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
        {subtitle && <p className="text-[11px] text-purple-300/50 mt-1">{subtitle}</p>}
      </div>
      {icon && <div className="text-purple-300/20">{icon}</div>}
    </div>
  );
}
