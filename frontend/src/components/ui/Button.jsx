import { Loader2 } from 'lucide-react';
import cn from '../../lib/cn';

const VARIANTS = {
  primary:
    'bg-sena-green text-white shadow-glow hover:bg-sena-green-dark hover:shadow-glow/80 active:scale-[0.98]',
  secondary:
    'bg-white text-sena-ink border border-slate-200 shadow-soft hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]',
  ghost: 'bg-transparent text-sena-ink hover:bg-sena-tint-100 hover:text-sena-green-dark',
  outline:
    'bg-transparent text-sena-green border border-sena-green/40 hover:bg-sena-tint-100 hover:border-sena-green active:scale-[0.98]',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]',
  dangerGhost: 'bg-transparent text-red-600 hover:bg-red-50',
  success: 'bg-sena-green-dark text-white hover:bg-sena-green active:scale-[0.98]',
};

const SIZES = {
  xs: 'h-8 px-3 text-xs gap-1.5',
  sm: 'h-9 px-3.5 text-sm gap-2',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2.5',
  icon: 'h-10 w-10 p-0 justify-center',
  iconSm: 'h-9 w-9 p-0 justify-center',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled = false,
  icon: Icon,
  fullWidth = false,
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={loading || disabled}
      className={cn(
        'relative inline-flex select-none items-center justify-center rounded-lg font-semibold transition-all duration-200',
        'disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100',
        'focus-visible:ring-2 focus-visible:ring-sena-green/40 focus-visible:ring-offset-2 focus-visible:outline-none',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        Icon && <Icon className={cn('shrink-0', size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4')} strokeWidth={2} />
      )}
      {children}
    </button>
  );
}
