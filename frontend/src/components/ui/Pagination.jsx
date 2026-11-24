import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';
import { PAGE_SIZE } from '../../hooks/usePagination';

export default function Pagination({ page, totalPages, total, onChange }) {
  const desde = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const hasta = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
      <p className="text-xs text-slate-500">
        Mostrando {desde}–{hasta} de {total} registros
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon={ChevronLeft}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Anterior
        </Button>
        <span className="px-1 text-xs font-semibold text-sena-ink">
          Página {page} de {totalPages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          icon={ChevronRight}
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
