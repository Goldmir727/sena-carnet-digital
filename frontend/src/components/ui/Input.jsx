import cn from '../../lib/cn';
import { fieldClass } from './fields';

export default function Input({
  label,
  icon: Icon,
  error,
  hint,
  size = 'md',
  className = '',
  id,
  ...props
}) {
  const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-sena-ink">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={2}
          />
        )}
        <input
          id={inputId}
          className={cn(fieldClass({ size }), Icon && 'pl-10', className)}
          aria-invalid={!!error}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}