import { Loader2 } from 'lucide-react';
import cn from '../../lib/cn';

export default function LoadingState({
  label = 'Cargando…',
  fullScreen = false,
  size = 'md',
  className = '',
}) {
  const sizes = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12' };

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 animate-fade-in',
        fullScreen ? 'min-h-[60vh]' : 'py-14',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={cn('animate-spin text-sena-green', sizes[size])} strokeWidth={2.5} />
      <span className="text-sm font-medium text-slate-500">{label}</span>
    </div>
  );
}