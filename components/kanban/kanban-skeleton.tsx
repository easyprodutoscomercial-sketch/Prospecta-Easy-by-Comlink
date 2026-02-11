const COLUMNS = 6;
const CARDS_PER_COLUMN = [3, 4, 2, 3, 2, 1];

export function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: COLUMNS }).map((_, colIdx) => (
        <div key={colIdx} className="flex-shrink-0 w-72 bg-[#1e0f35] border border-purple-800/30 rounded-lg p-3">
          {/* Column header */}
          <div className="flex items-center justify-between mb-3">
            <div className="h-5 w-28 bg-purple-800/40 rounded animate-pulse" />
            <div className="h-5 w-6 bg-purple-800/40 rounded-full animate-pulse" />
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {Array.from({ length: CARDS_PER_COLUMN[colIdx] }).map((_, cardIdx) => (
              <div key={cardIdx} className="bg-[#2a1245] rounded-lg p-3 shadow-sm space-y-2">
                <div className="h-4 w-3/4 bg-purple-800/40 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-purple-800/40 rounded animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-purple-800/40 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
