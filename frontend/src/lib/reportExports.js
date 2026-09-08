const C_GREEN = '#0F7A4D';
const C_GREEN_DARK = '#0A5A39';
const C_YELLOW = '#F2B43A';

const TITULOS = {
  usuarios: 'Reporte de Usuarios',
  carnets: 'Reporte de Carnets',
  asistencias: 'Reporte de Asistencias',
};

const HOJAS = {
  usuarios: 'Usuarios',
  carnets: 'Carnets',
  asistencias: 'Asistencias',
};

const DATE_KEYS = ['created_at', 'fecha_emision', 'fecha_vencimiento', 'fecha_hora'];

function nowLabel() {
  return new Date().toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function limiteLongitud(value, max) {
  const s = String(value ?? '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function buildColumns(tipo) {
  switch (tipo) {
    case 'usuarios':
      return [
        { key: 'idx', header: 'N°', pdfWidth: 14, value: (r, i) => i + 1 },
        {
          key: 'nombre',
          header: 'Nombre',
          value: (r) => `${r.nombres || ''} ${r.apellidos || ''}`.replace(/\s+/g, ' ').trim() || r.email || '—',
        },
        { key: 'email', header: 'Correo', value: (r) => r.email || '—' },
        {
          key: 'numero_documento',
          header: 'Documento',
          value: (r) => `${r.tipo_documento || ''} ${r.numero_documento || ''}`.trim() || '—',
        },
        { key: 'rol', header: 'Rol', value: (r) => r.rol || '—' },
        { key: 'is_active', header: 'Estado', value: (r) => (r.is_active === true || r.is_active === 1 ? 'Activo' : 'Inactivo') },
        { key: 'created_at', header: 'Registrado', value: (r) => fmtFecha(r.created_at) },
      ];
    case 'carnets':
      return [
        {
          key: 'uuid',
          header: 'Código',
          value: (r) => limiteLongitud(r.uuid, 14),
          excelValue: (r) => r.uuid || '—',
          pdfWidth: 34,
        },
        {
          key: 'nombre',
          header: 'Titular',
          value: (r) => `${r.nombres || ''} ${r.apellidos || ''}`.replace(/\s+/g, ' ').trim() || '—',
        },
        { key: 'numero_documento', header: 'Documento', value: (r) => r.numero_documento || '—' },
        { key: 'estado', header: 'Estado', value: (r) => r.estado || '—' },
        { key: 'fecha_emision', header: 'Emitido', value: (r) => fmtFecha(r.fecha_emision) },
        { key: 'fecha_vencimiento', header: 'Vence', value: (r) => fmtFecha(r.fecha_vencimiento) },
      ];
    case 'asistencias':
      return [
        { key: 'fecha_hora', header: 'Fecha y hora', value: (r) => fmtHora(r.fecha_hora) },
        {
          key: 'nombre',
          header: 'Usuario',
          value: (r) => `${r.nombres || ''} ${r.apellidos || ''}`.replace(/\s+/g, ' ').trim() || '—',
        },
        { key: 'numero_documento', header: 'Documento', value: (r) => r.numero_documento || '—' },
        { key: 'ubicacion', header: 'Sesión / Ubicación', value: (r) => r.ubicacion || '—' },
      ];
    default:
      return [];
  }
}

function triggerDownload(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// ==============================
//  PDF
// ==============================

export async function exportReportePdf(tipo, rows) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const titulo = TITULOS[tipo] || 'Reporte';
  const cols = buildColumns(tipo);

  // Encabezado institucional
  doc.setFillColor(C_GREEN);
  doc.rect(0, 0, W, 36, 'F');
  doc.setFillColor(C_GREEN_DARK);
  doc.rect(0, 0, W, 5, 'F');
  doc.setFillColor(C_YELLOW);
  doc.rect(0, 33.5, W, 2.5, 'F');

  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(titulo, 16, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor('#D6EDE2');
  doc.text('SENA — Sistema de Gestión de Carnets Digitales', 16, 23.5);

  doc.setTextColor('#BFE3D0');
  doc.text(`Generado el ${nowLabel()}`, W - 16, 23.5, { align: 'right' });

  // Resumen + subtítulo
  doc.setTextColor(C_GREEN_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`${rows.length} registro${rows.length === 1 ? '' : 's'}`, 16, 46);

  // Tabla
  const body = rows.map((r, i) => cols.map((c) => c.value(r, i)));

  autoTable(doc, {
    startY: 51,
    head: [cols.map((c) => c.header)],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.4,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      textColor: [23, 33, 43],
    },
    headStyles: {
      fillColor: [15, 122, 77],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    alternateRowStyles: { fillColor: [241, 250, 246] },
    columnStyles:
      cols.map((c) => c.pdfWidth).some((w) => w)
        ? cols.reduce((acc, c, idx) => {
            if (c.pdfWidth) acc[idx] = { cellWidth: c.pdfWidth };
            return acc;
          }, {})
        : undefined,
    margin: { left: 16, right: 16, top: 40, bottom: 18 },
    didDrawPage: () => {
      doc.setDrawColor(205, 232, 218);
      doc.setLineWidth(0.4);
      doc.line(16, H - 14, W - 16, H - 14);
      doc.setTextColor(138, 153, 166);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('SENA — Sistema de Gestión de Carnets', 16, H - 8.5);
      doc.text(`Página ${doc.internal.getNumberOfPages()}`, W - 16, H - 8.5, { align: 'right' });
    },
  });

  doc.save(`reporte_${tipo}.pdf`);
}

// ==============================
//  Excel
// ==============================

function widthFor(header, rows, valueFn) {
  let max = header.length;
  rows.forEach((r, i) => {
    const len = String(valueFn(r, i) ?? '').length;
    if (len > max) max = len;
  });
  return Math.min(Math.max(max + 3, 9), 46);
}

export async function exportReporteExcel(tipo, rows) {
  const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js');
  const wb = new ExcelJS.Workbook();
  wsSetup(wb);
  const ws = wb.addWorksheet(HOJAS[tipo] || 'Reporte');
  const cols = buildColumns(tipo);
  const nCols = cols.length;
  const titulo = TITULOS[tipo] || 'Reporte';

  const headerRow = cols.map((c) => c.header);

  // Fila título
  ws.mergeCells(1, 1, 1, nCols);
  const title = ws.getCell(1, 1);
  title.value = titulo;
  title.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F7A4D' } };
  title.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 26;

  // Fila subtítulo
  ws.mergeCells(2, 1, 2, nCols);
  const sub = ws.getCell(2, 1);
  sub.value = `Generado el ${nowLabel()} — Sistema de Gestión de Carnets SENA`;
  sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF5B6B7A' } };
  sub.alignment = { vertical: 'middle' };
  ws.getRow(2).height = 18;

  // Fila de encabezados (fila 3)
  const header = ws.getRow(3);
  header.height = 20;
  headerRow.forEach((h, i) => {
    const cell = header.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F7A4D' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF9FD6BA' } },
      left: { style: 'thin', color: { argb: 'FF9FD6BA' } },
      bottom: { style: 'medium', color: { argb: 'FF0A5A39' } },
      right: { style: 'thin', color: { argb: 'FF9FD6BA' } },
    };
  });

  // Filas de datos
  rows.forEach((r, idx) => {
    const row = ws.addRow(cols.map((c) => (c.excelValue ? c.excelValue(r, idx) : c.value(r, idx))));
    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF17212B' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCDE8DA' } },
        left: { style: 'thin', color: { argb: 'FFCDE8DA' } },
        bottom: { style: 'thin', color: { argb: 'FFCDE8DA' } },
        right: { style: 'thin', color: { argb: 'FFCDE8DA' } },
      };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1FAF6' } };
      }
    });
    row.height = 18;
  });

  // Fechas como fechas reales cuando sea posible
  cols.forEach((c, i) => {
    if (!c.key || !DATE_KEYS.includes(c.key)) return;
    rows.forEach((r, idx) => {
      const v = r[c.key];
      if (!v) return;
      const cell = ws.getCell(idx + 4, i + 1);
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return;
      cell.value = d;
      cell.numFmt = c.key === 'fecha_hora' ? 'dd-mmm-yyyy hh:mm' : 'dd-mmm-yyyy';
    });
  });

  // Anchos de columna
  ws.columns.forEach((col, i) => {
    col.width = widthFor(cols[i].header, rows, cols[i].value);
  });

  // Congelar encabezados + autofiltro
  ws.views = [{ state: 'frozen', ySplit: 3, topLeftCell: 'A4' }];
  if (rows.length) {
    ws.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3 + rows.length, column: nCols },
    };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `reporte_${tipo}.xlsx`);
}

function wsSetup(wb) {
  wb.creator = 'SENA — Sistema de Gestión de Carnets';
  wb.created = new Date();
  wb.modified = new Date();
}