import { Search, X } from 'lucide-react';
import cn from '../../lib/cn';

export default function SearchInput({ value, onChange, placeholder = 'Buscar…', className = '' }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-9 text-sm text-sena-ink placeholder:text-slate-400 transition focus:border-sena-green focus:outline-none focus:ring-2 focus:ring-sena-green/25"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-sena-ink"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}