import cn from '../../lib/cn';

const FIELD_BASE =
  'w-full rounded-lg border bg-white text-sm text-sena-ink placeholder:text-slate-400 transition-colors duration-150 focus:outline-none focus:ring-2';
const FIELD_DEFAULT = 'border-slate-300 focus:border-sena-green focus:ring-sena-green/25';
const FIELD_ERROR = 'border-red-400 focus:border-red-500 focus:ring-red-500/25';
const FIELD_DISABLED = 'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

export function fieldClass({ size = 'md' } = {}) {
  const pad = size === 'sm' ? 'py-2 px-3 text-sm' : 'py-2.5 px-3.5 text-sm';
  return cn(FIELD_BASE, FIELD_DEFAULT, FIELD_ERROR, FIELD_DISABLED, pad);
}