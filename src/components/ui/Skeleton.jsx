import { cn } from '@/utils/cn';

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/80', className)} />;
}

export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, cIdx) => (
            <Skeleton key={cIdx} className="h-5 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
