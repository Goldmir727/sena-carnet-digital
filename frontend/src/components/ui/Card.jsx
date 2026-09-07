import cn from '../../lib/cn';

const VARIANTS = {
  default: 'bg-white border border-slate-200/70 shadow-xs',
  elevated: 'bg-white border border-slate-200/60 shadow-card',
  interactive:
    'bg-white border border-slate-200 shadow-xs hover:border-sena-green/40 hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 cursor-pointer',
  accent: 'bg-sena-green-dark text-white bg-sena-hero border-0 shadow-glow',
  tint: 'bg-sena-tint-50 border border-sena-tint-200',
  flat: 'bg-slate-50 border border-slate-100',
  canvas: 'bg-canvas border border-white/60',
  overlay: 'bg-white/95 backdrop-blur border border-white/60 shadow-overlay',
};

export default function Card({
  children,
  className = '',
  variant = 'default',
  title,
  description,
  icon: Icon,
  actions,
  padding = true,
  ...props
}) {
  return (
    <div className={cn('rounded-2xl transition-colors', VARIANTS[variant], padding && 'p-5', className)} {...props}>
      {(title || Icon || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sena-tint-100 text-sena-green">
                <Icon className="h-4 w-4" strokeWidth={2} />
              </div>
            )}
            <div>
              {title && (
                <h3 className={cn('text-sm font-semibold', variant === 'accent' ? 'text-white' : 'text-sena-ink')}>
                  {title}
                </h3>
              )}
              {description && (
                <p className={cn('mt-0.5 text-sm', variant === 'accent' ? 'text-sena-tint-200' : 'text-slate-500')}>
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
