import Card from './Card';

export default function Table({
  columns,
  rows,
  loading = false,
  emptyMessage,
  keyField = 'id',
  footer,
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-sena-green border-t-transparent" />
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <Card>
        <p className="py-10 text-center text-sm text-slate-500">{emptyMessage || 'No hay datos para mostrar.'}</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 font-semibold">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={row[keyField] ?? i} className="hover:bg-sena-green-light/40">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
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
