import cn from '../../lib/cn';

export default function Skeleton({ className = '', rows = 1 }) {
  return (
    <div className={cn('space-y-3', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 w-full animate-pulse rounded-md bg-slate-200/70" />
      ))}
    </div>
  );
}