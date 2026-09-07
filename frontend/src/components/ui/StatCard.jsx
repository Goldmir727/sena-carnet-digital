import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react';
import Card from './Card';
import cn from '../../lib/cn';

const ACCENTS = {
  green: 'bg-sena-tint-100 text-sena-green',
  yellow: 'bg-sena-yellow/15 text-sena-ink',
  blue: 'bg-blue-50 text-blue-600',
  red: 'bg-red-50 text-red-600',
  dark: 'bg-sena-green-dark text-sena-tint-200',
  slate: 'bg-slate-100 text-slate-600',
};

const TRENDS = {
  up: { icon: ArrowUpRight, cls: 'text-sena-green' },
  down: { icon: ArrowDownRight, cls: 'text-red-500' },
  neutral: { icon: null, cls: 'text-slate-400' },
};

/**
 * StatCard — superficie de estadística.
 * - `featured`: variante grande/acompañada por un bloque de contexto (rompe el grid uniforme).
 * - por defecto: compacto, se alterna con otros acentos.
 */
export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = 'green',
  trend,
  delta,
  featured = false,
  className = '',
}) {
  const trendCfg = TRENDS[trend] || TRENDS.neutral;
  const TrendIcon = trendCfg.icon;

  if (featured) {
    return (
      <Card variant="dark" className={cn('relative overflow-hidden', className)} padding={false}>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, currentColor 1px, transparent 1.5px)', backgroundSize: '22px 22px' }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-sena-green-light/15 blur-2xl animate-float-soft" aria-hidden="true" />
        <div className={cn('relative z-10 flex items-center justify-between gap-4 p-6')}>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sena-tint-200">{label}</p>
            <p className="mt-2 text-5xl font-extrabold tracking-tight text-white tabular-nums">{value ?? '—'}</p>
            {hint && <p className="mt-1.5 text-sm text-sena-tint-200/80">{hint}</p>}
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-sena-yellow backdrop-blur-sm">
            {Icon ? <Icon className="h-6 w-6" strokeWidth={2} /> : <TrendingUp className="h-6 w-6" strokeWidth={2} />}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('group relative overflow-hidden transition-all duration-200 hover:shadow-card', className)} padding={false}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', ACCENTS[accent])}>
            {Icon && <Icon className="h-5 w-5" strokeWidth={2} />}
          </div>
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold',
                trendCfg.cls
              )}
            >
              {TrendIcon && <TrendIcon className="h-3.5 w-3.5" />}
              {delta}
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold tracking-tight text-sena-ink tabular-nums">{value ?? '—'}</p>
          <p className="mt-0.5 text-sm font-medium text-slate-500">{label}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
      </div>
      <div className="h-0.5 w-0 bg-sena-green transition-all duration-500 group-hover:w-full" />
    </Card>
  );
}