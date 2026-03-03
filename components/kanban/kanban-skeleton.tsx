const COLUMNS = 6;
const CARDS_PER_COLUMN = [4, 5, 3, 4, 2, 1];

export function KanbanSkeleton() {
  return (
    <div className="space-y-3">
      {/* KPI micro-bar skeleton */}
      <div className="flex items-center gap-4 px-2 py-2">
        <div className="h-4 w-24 skeleton-shimmer rounded" />
        <div className="w-px h-4 bg-purple-800/30" />
        <div className="h-4 w-16 skeleton-shimmer rounded" />
        <div className="w-px h-4 bg-purple-800/30" />
        <div className="h-4 w-14 skeleton-shimmer rounded" />
      </div>

      {/* Board skeleton */}
      <div className="kanban-board-container flex gap-3 overflow-x-auto pb-4 scrollbar-hide" style={{ display: 'grid', gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}>
        {Array.from({ length: COLUMNS }).map((_, colIdx) => (
          <div key={colIdx} className="bg-[#160b2e] border border-purple-800/15 rounded-xl overflow-hidden">
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <div className="h-6 w-6 skeleton-shimmer rounded-md" />
              <div className="h-4 w-20 skeleton-shimmer rounded" />
              <div className="ml-auto h-5 w-6 skeleton-shimmer rounded-full" />
            </div>

            {/* Search bar skeleton */}
            <div className="px-2 pb-2">
              <div className="h-6 w-full skeleton-shimmer rounded-md" />
            </div>

            <div className="h-[2px] mx-3 skeleton-shimmer" />

            {/* Compact card skeletons */}
            <div className="p-2 space-y-2">
              {Array.from({ length: CARDS_PER_COLUMN[colIdx] }).map((_, cardIdx) => (
                <div key={cardIdx} className="bg-[#1e0f35] rounded-xl p-2 border-l-[3px] border-purple-800/20">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 skeleton-shimmer rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="h-3.5 w-3/4 skeleton-shimmer rounded" />
                      <div className="h-2.5 w-1/2 skeleton-shimmer rounded mt-1" />
                    </div>
                    <div className="h-4 w-10 skeleton-shimmer rounded shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
