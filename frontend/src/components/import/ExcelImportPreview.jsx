import { useEffect, useState } from 'react';
import Table from '../ui/Table';
import Badge from '../ui/Badge';
import { mapHeaders, validatePreviewRows, COLUMNAS_TODAS } from '../../lib/importSchema';

// Vista previa local de un .xlsx de importación (exceljs en el navegador).
// Extraída de Grupos.jsx para reutilizarla también en Usuarios.
// El envío real siempre es el archivo original; el backend revalida
// autoritativamente al importar.
export default function ExcelImportPreview({ onReady }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (onReady) onReady({ file, preview, previewLoading });
  }, [file, preview, previewLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = async (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(null);
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) {
      setPreview({ error: 'El archivo debe tener extensión .xlsx' });
      return;
    }
    setPreviewLoading(true);
    try {
      const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await f.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) {
        setPreview({ error: 'El archivo no tiene hojas.' });
        return;
      }
      const all = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        all.push((row.values || []).slice(1).map((v) => (v === null || v === undefined ? '' : String(v).trim())));
      });
      if (!all.length) {
        setPreview({ error: 'El archivo está vacío.' });
        return;
      }
      const { idx, faltantes } = mapHeaders(all[0]);
      const data = [];
      all.slice(1).forEach((cells, i) => {
        if (cells.every((c) => !c)) return;
        const r = { _key: i, _fila: i + 2 };
        for (const [canonica, j] of Object.entries(idx)) r[canonica] = cells[j] || '';
        data.push(r);
      });
      setPreview({ rows: validatePreviewRows(data), faltantes, total: data.length });
    } catch {
      setPreview({ error: 'No se pudo leer el archivo. Debe ser un .xlsx válido.' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const validas = (preview?.rows || []).filter((r) => r._ok).length;
  const invalidas = (preview?.rows || []).filter((r) => !r._ok).length;
  const duplicadas = (preview?.rows || []).filter(
    (r) => !r._ok && /duplicado/i.test(r._error || ''),
  ).length;

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".xlsx"
        onChange={onPick}
        className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-sena-tint-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sena-green-dark hover:file:bg-sena-tint-200"
      />
      {previewLoading && <p className="text-xs text-slate-400">Leyendo archivo para la vista previa…</p>}
      {preview?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{preview.error}</p>
      )}
      {(preview?.faltantes || []).length > 0 && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          Faltan columnas obligatorias: {preview.faltantes.join(', ')}. Columnas esperadas: {COLUMNAS_TODAS.join(', ')}.
        </p>
      )}
      {preview?.rows && (preview.faltantes || []).length === 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xl font-bold text-sena-ink">{preview.total}</p>
              <p className="text-xs text-slate-400">Filas</p>
            </div>
            <div className="rounded-xl bg-sena-tint-50 p-3 text-center">
              <p className="text-xl font-bold text-sena-green-dark">{validas}</p>
              <p className="text-xs text-slate-400">Válidas</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3 text-center">
              <p className="text-xl font-bold text-red-600">{invalidas}</p>
              <p className="text-xs text-slate-400">Con error</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3 text-center">
              <p className="text-xl font-bold text-red-600">{duplicadas}</p>
              <p className="text-xs text-slate-400">Duplicadas en el archivo</p>
            </div>
          </div>
          {invalidas > 0 && (
            <p className="text-xs text-slate-500">
              Las filas con error se omitirán al importar.
            </p>
          )}
          <Table
            columns={[
              { key: '_fila', label: 'Fila', render: (r) => <span className="text-slate-500">{r._fila}</span> },
              { key: 'numero_documento', label: 'Documento', render: (r) => <span className="font-mono text-xs text-sena-ink">{r.numero_documento || '—'}</span> },
              { key: 'nombre', label: 'Nombre', render: (r) => <span className="text-slate-600">{`${r.nombres || ''} ${r.apellidos || ''}`.trim() || '—'}</span> },
              { key: 'email', label: 'Correo', render: (r) => <span className="text-slate-600">{r.email || '—'}</span> },
              ...(preview?.rows?.some((r) => r.ficha)
                ? [{ key: 'ficha', label: 'Ficha', render: (r) => <span className="font-mono text-xs text-slate-600">{r.ficha || '—'}</span> }]
                : []),
              {
                key: 'estado',
                label: 'Estado',
                align: 'right',
                render: (r) => (r._ok ? <Badge variant="green">Válida</Badge> : <Badge variant="red" title={r._error}>Error</Badge>),
              },
            ]}
            rows={preview.rows.slice(0, 8)}
            loading={false}
            emptyTitle="Sin filas"
            emptyMessage="El archivo no tiene filas con datos."
            keyField="_key"
          />
          {preview.total > 8 && (
            <p className="text-xs text-slate-400">…y {preview.total - 8} fila(s) más. Se validarán todas al importar.</p>
          )}
        </div>
      )}
    </div>
  );
}
