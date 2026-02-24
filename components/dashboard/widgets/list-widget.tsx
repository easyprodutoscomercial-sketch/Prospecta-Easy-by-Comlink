'use client';

interface ListItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
}

interface ListWidgetProps {
  items: ListItem[];
  emptyMessage?: string;
}

export function ListWidget({ items, emptyMessage = 'Nenhum item' }: ListWidgetProps) {
  if (items.length === 0) {
    return <p className="text-xs text-purple-300/30 text-center py-4">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-1 h-full overflow-y-auto">
      {items.slice(0, 8).map(item => (
        <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-purple-800/10 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-neutral-200 truncate">{item.title}</p>
            {item.subtitle && <p className="text-[10px] text-purple-300/40 truncate">{item.subtitle}</p>}
          </div>
          {item.badge && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${item.badgeColor || 'bg-purple-800/30 text-purple-300/60'}`}>
              {item.badge}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
