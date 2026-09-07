import cn from '../../lib/cn';

const VARIANTS = {
  green: 'bg-sena-tint-100 text-sena-green-dark border border-sena-tint-200',
  yellow: 'bg-sena-yellow/15 text-sena-ink border border-sena-yellow/40',
  red: 'bg-red-50 text-red-700 border border-red-200',
  blue: 'bg-blue-50 text-blue-700 border border-blue-200',
  slate: 'bg-slate-100 text-slate-600 border border-slate-200',
  outline: 'bg-white text-sena-ink border border-slate-200',
  solid: '',
};

export default function Badge({ children, variant = 'slate', icon: Icon, className = '' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        VARIANTS[variant],
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}