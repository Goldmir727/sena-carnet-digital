import Card from './Card';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import cn from '../../lib/cn';

export default function Table({
  columns,
  rows,
  loading = false,
  emptyTitle,
  emptyMessage,
  emptyIcon,
  keyField = 'id',
  footer,
  hover = true,
  onRowClick,
}) {
  if (loading) {
    return <LoadingState label="Cargando información…" />;
  }

  if (!rows || rows.length === 0) {
    return (
      <Card padding={false}>
        <EmptyState compact title={emptyTitle || 'Sin resultados'} message={emptyMessage} icon={emptyIcon} />
      </Card>
    );
  }

  return (
    <Card padding={false} className="overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500',
                    col.align && `text-${col.align}`
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr
                key={row[keyField] ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'transition-colors duration-150',
                  hover && 'hover:bg-sena-tint-50',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3.5', col.align && `text-${col.align}`)}>
                    {col.render ? col.render(row, i) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
    </Card>
  );
}