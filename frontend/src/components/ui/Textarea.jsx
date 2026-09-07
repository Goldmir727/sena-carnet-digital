import { fieldClass } from './fields';
import cn from '../../lib/cn';

export default function Textarea({ label, error, hint, className = '', id, ...props }) {
  const textareaId = id || (label ? `textarea-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-sena-ink">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={cn(fieldClass(), 'resize-y', className)}
        aria-invalid={!!error}
        {...props}
      />
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : (
        hint && <p className="text-xs text-slate-400">{hint}</p>
      )}
    </div>
  );
}