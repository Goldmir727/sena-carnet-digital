import { ChevronDown } from 'lucide-react';
import { fieldClass } from './fields';
import cn from '../../lib/cn';

export default function Select({
  label,
  options,
  placeholder = 'Selecciona una opción',
  error,
  hint,
  value,
  onChange,
  className = '',
  id,
  allowEmpty = true,
  ...props
}) {
  const selectId = id || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-sena-ink">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          value={value ?? ''}
          onChange={onChange}
          className={cn(fieldClass(), 'appearance-none pr-10 cursor-pointer', className)}
          {...props}
        >
          {allowEmpty && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => {
            if (typeof opt === 'string') {
              return (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              );
            }
            return (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            );
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : (
        hint && <p className="text-xs text-slate-400">{hint}</p>
      )}
    </div>
  );
}