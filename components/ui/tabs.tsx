'use client';

interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
}

export default function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide border-b border-purple-800/30">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative ${
            activeTab === tab.key
              ? 'text-emerald-400'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
              activeTab === tab.key
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-purple-800/30 text-neutral-500'
            }`}>
              {tab.count}
            </span>
          )}
          {activeTab === tab.key && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
