export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer rounded h-4"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 overflow-hidden">
      {/* Header */}
      <div className="bg-[#2a1245]/50 px-5 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton-shimmer rounded h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="px-5 py-3 border-t border-purple-800/20 flex gap-4">
          {Array.from({ length: cols }).map((_, col) => (
            <div key={col} className="skeleton-shimmer rounded h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[#1e0f35] rounded-xl border border-purple-800/30 p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="skeleton-shimmer rounded-full w-10 h-10 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton-shimmer rounded h-4 w-3/4" />
          <div className="skeleton-shimmer rounded h-3 w-1/2" />
        </div>
      </div>
      <div className="skeleton-shimmer rounded h-3 w-full" />
      <div className="skeleton-shimmer rounded h-3 w-2/3" />
    </div>
  );
}

export function SkeletonKanban({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: columns }).map((_, col) => (
        <div key={col} className="flex-1 min-w-[220px] space-y-2">
          <div className="skeleton-shimmer rounded-lg h-8 w-full" />
          {Array.from({ length: 3 - (col % 2) }).map((_, card) => (
            <div key={card} className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-3 space-y-2">
              <div className="skeleton-shimmer rounded h-4 w-3/4" />
              <div className="skeleton-shimmer rounded h-3 w-1/2" />
              <div className="flex gap-2">
                <div className="skeleton-shimmer rounded-full h-5 w-14" />
                <div className="skeleton-shimmer rounded-full h-5 w-10" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonForm({ fields = 6 }: { fields?: number }) {
  return (
    <div className="bg-[#1e0f35] rounded-xl border border-purple-800/30 p-5 space-y-4">
      <div className="skeleton-shimmer rounded h-4 w-40" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="skeleton-shimmer rounded h-3 w-20" />
            <div className="skeleton-shimmer rounded-lg h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
