import { Inbox } from 'lucide-react';
import cn from '../../lib/cn';

export default function EmptyState({
  title = 'Sin resultados',
  message,
  icon: Icon,
  action,
  className = '',
  compact = false,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 text-center animate-fade-in',
        compact ? 'py-12' : 'py-16',
        className
      )}
    >
      <div className="relative">
        <div className="absolute -inset-3 rounded-2xl bg-sena-tint-100 opacity-60 blur-md" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-sena-green shadow-soft">
          {Icon ? <Icon className="h-7 w-7" strokeWidth={1.5} /> : <Inbox className="h-7 w-7" strokeWidth={1.5} />}
        </div>
      </div>
      <h3 className="mt-5 text-base font-semibold text-sena-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}