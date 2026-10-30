import { getAccessToken } from '../utils/session';
import API_BASE from '../api/base';

const BASE = API_BASE;

const C_GREEN = '#0F7A4D';
const C_GREEN_DARK = '#0A5A39';
const C_GREEN_TINT = '#E4F3EC';
const C_GREEN_TINT_50 = '#F1FAF6';
const C_YELLOW = '#F2B43A';
const C_INK = '#17212B';
const C_MUTED = '#8A99A6';
const C_BORDER = '#CDE8DA';
const C_PAGE = '#F6FAF7';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function fetchCarnetQrUrl(id) {
  const res = await fetch(`${BASE}/carnets/${id}/qr`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error('No se pudo cargar el código QR');
  return URL.createObjectURL(await res.blob());
}

async function fetchQrDataUrl(id) {
  const res = await fetch(`${BASE}/carnets/${id}/qr`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error('No se pudo cargar el código QR');
  return blobToDataUrl(await res.blob());
}

function photoUrl(foto) {
  if (!foto) return null;
  if (/^https?:\/\//i.test(foto)) return foto;
  const clean = String(foto).replace(/\\/g, '/').replace(/^\/+/, '');
  return `${BASE}/${clean}`;
}

async function loadImageDataUrl(foto) {
  const src = photoUrl(foto);
  if (!src) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    const type = blob.type || 'image/png';
    return { dataUrl: await blobToDataUrl(blob), format: type.includes('png') ? 'PNG' : 'JPEG' };
  } catch {
    return null;
  }
}

function fmtLarga(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function estadoColor(estado) {
  switch (String(estado || '').toLowerCase()) {
    case 'activo':
      return { bg: [15, 122, 77], fg: '#FFFFFF' };
    case 'suspendido':
      return { bg: [217, 119, 6], fg: '#FFFFFF' };
    case 'vencido':
      return { bg: [220, 38, 38], fg: '#FFFFFF' };
    default:
      return { bg: [100, 116, 139], fg: '#FFFFFF' };
  }
}

export async function downloadCarnetPdf(carnet) {
  const { jsPDF, GState } = await import('jspdf');

  const nombre = `${carnet.nombres || carnet.name || ''} ${carnet.apellidos || carnet.last_name || ''}`
    .replace(/\s+/g, ' ')
    .trim() || '—';
  const documento = carnet.numero_documento || carnet.document || '—';
  const tipoDoc = carnet.tipo_documento || carnet.document_type || 'CC';
  const email = carnet.email || carnet.usuario_email || '—';
  const tipoSangre = carnet.tipo_sangre || carnet.blood_type || '—';
  const centro = carnet.centro_nombre || carnet.centro || '—';
  const uuid = carnet.uuid || carnet.codigo_qr || '—';
  const estado = carnet.estado || '—';

  const [qr, foto] = await Promise.all([
    fetchQrDataUrl(carnet.id).catch(() => null),
    carnet.foto_perfil ? loadImageDataUrl(carnet.foto_perfil) : Promise.resolve(null),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // ===== Fondo de página =====
  doc.setFillColor(C_PAGE);
  doc.rect(0, 0, W, H, 'F');

  // ===== Encabezado institucional =====
  doc.setFillColor(C_GREEN);
  doc.rect(0, 0, W, 50, 'F');
  doc.setFillColor(C_GREEN_DARK);
  doc.rect(0, 0, W, 8, 'F');
  doc.setFillColor(C_YELLOW);
  doc.rect(0, 47.5, W, 2.5, 'F');

  // Cresta / emblema
  doc.setFillColor(C_GREEN_DARK);
  doc.circle(26, 25, 12.8, 'F');
  doc.setDrawColor(C_YELLOW);
  doc.setLineWidth(1.1);
  doc.circle(26, 25, 9.4, 'S');
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('SENA', 26, 24.6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.4);
  doc.text('COLOMBIA', 26, 29, { align: 'center' });

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor('#FFFFFF');
  doc.text('SENA', 48, 21);
  doc.setFontSize(9.5);
  doc.setTextColor(C_YELLOW);
  doc.text('CARNET DIGITAL INSTITUCIONAL', 48, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor('#CFE8DC');
  doc.text('Servicio Nacional de Aprendizaje — Colombia', 48, 34.5);

  // Chip de estado
  const ec = estadoColor(estado);
  const estadoLabel = String(estado).toUpperCase() || '—';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const textW = doc.getTextWidth(estadoLabel);
  const pillW = textW + 13;
  const pillLeft = 196 - pillW;
  doc.setFillColor('#FFFFFF');
  doc.roundedRect(pillLeft, 15, pillW, 11, 5.5, 5.5, 'F');
  doc.setFillColor(ec.bg[0], ec.bg[1], ec.bg[2]);
  doc.circle(pillLeft + 5, 20.5, 1.7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(C_GREEN_DARK);
  doc.text(estadoLabel, pillLeft + 9.5, 21.5);

  // ===== Tarjeta =====
  const cardX = 14;
  const cardY = 62;
  const cardW = W - 28;
  const cardH = 184;

  // sombra
  doc.setFillColor('#E3EBE6');
  doc.roundedRect(cardX + 1.5, cardY + 1.5, cardW, cardH, 4, 4, 'F');
  // cuerpo
  doc.setFillColor('#FFFFFF');
  doc.setDrawColor(C_BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(cardX, cardY, cardW, cardH, 4, 4, 'FD');

  // Marca de agua
  doc.setGState(new GState({ opacity: 0.05 }));
  doc.setTextColor(C_GREEN_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(72);
  doc.text('SENA', cardX + cardW / 2, cardY + cardH / 2 + 20, { align: 'center', angle: 32 });
  doc.setGState(new GState({ opacity: 1 }));

  // Banda superior de la tarjeta
  doc.setFillColor(C_GREEN);
  doc.roundedRect(cardX, cardY, cardW, 22, 4, 4, 'F');
  doc.setFillColor(C_GREEN);
  doc.rect(cardX, cardY + 16, cardW, 6, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('IDENTIFICACIÓN INSTITUCIONAL', cardX + 8, cardY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor('#D6EDE2');
  doc.text('SENA · COLOMBIA', cardX + cardW - 8, cardY + 14, { align: 'right' });

  // ===== Foto =====
  const plateX = cardX + 10;
  const plateY = cardY + 34;
  doc.setFillColor(C_GREEN_TINT);
  doc.setDrawColor(C_BORDER);
  doc.setLineWidth(0.5);
  doc.roundedRect(plateX, plateY, 52, 66, 3, 3, 'FD');

  if (foto) {
    doc.setFillColor('#FFFFFF');
    doc.roundedRect(plateX + 3, plateY + 3, 46, 57, 2, 2, 'F');
    doc.addImage(foto.dataUrl, foto.format, plateX + 4, plateY + 4, 44, 55);
    doc.setDrawColor(C_BORDER);
    doc.setLineWidth(0.4);
    doc.roundedRect(plateX + 3, plateY + 3, 46, 57, 2, 2, 'S');
  } else {
    const iniciales =
      nombre
        .split(' ')
        .filter((p) => p && p[0])
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'SD';
    doc.setTextColor(C_GREEN);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(30);
    doc.text(iniciales, plateX + 26, plateY + 34, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor('#B7C7BC');
    doc.text('SIN FOTO', plateX + 26, plateY + 42, { align: 'center' });
  }

  doc.setTextColor(C_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.text('FOTO DEL TITULAR', plateX + 26, plateY + 73, { align: 'center' });

  // ===== Nombre / datos =====
  const nameX = cardX + 74;
  const nameW = cardW - 84;

  const nameLines = doc.splitTextToSize(nombre, nameW);
  doc.setTextColor(C_INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(nameLines, nameX, cardY + 50);

  const nameLast = cardY + 50 + (nameLines.length - 1) * 6.5;
  doc.setFillColor(C_YELLOW);
  doc.roundedRect(nameX, nameLast + 3.5, 44, 1.1, 0.55, 0.55, 'F');

  const rows = [
    { label: 'Documento', value: `${tipoDoc} ${documento}` },
    { label: 'Tipo de sangre', value: tipoSangre },
    { label: 'Centro de formación', value: centro },
    { label: 'Correo electrónico', value: email },
    { label: 'Válido hasta', value: fmtLarga(carnet.fecha_vencimiento) },
    { label: 'Código único (UUID)', value: uuid, mono: true },
  ];

  let fY = Math.max(cardY + 68, nameLast + 10);
  doc.setDrawColor('#E8EFEA');
  doc.setLineWidth(0.25);
  const valW = cardX + cardW - 8 - nameX;
  rows.forEach((row, i) => {
    const valLines = doc.splitTextToSize(String(row.value), valW).slice(0, 2);
    if (i > 0) {
      doc.setLineDashPattern([1.2, 1.6], 0);
      doc.line(nameX, fY - 2.5, cardX + cardW - 8, fY - 2.5);
      doc.setLineDashPattern([], 0);
    }
    doc.setTextColor(C_MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(row.label.toUpperCase(), nameX, fY);
    doc.setTextColor(C_INK);
    doc.setFont(row.mono ? 'courier' : 'helvetica', 'normal');
    doc.setFontSize(row.mono ? 8 : 10);
    doc.text(valLines, nameX, fY + 4);
    fY += 7 + valLines.length * 4.5;
  });

  // ===== Panel de validación =====
  const panelTop = 198;
  const panelH = 44;
  doc.setFillColor(C_GREEN_TINT_50);
  doc.setDrawColor(C_BORDER);
  doc.setLineWidth(0.5);
  doc.roundedRect(cardX + 6, panelTop, cardW - 12, panelH, 4, 4, 'FD');

  // QR
  doc.setFillColor('#FFFFFF');
  doc.setDrawColor(C_BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(cardX + 13, panelTop + 5, 36, 36, 2, 2, 'FD');
  if (qr) {
    doc.addImage(qr, 'PNG', cardX + 16, panelTop + 8, 30, 30);
  } else {
    doc.setTextColor(C_MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('QR no disponible', cardX + 31, panelTop + 22, { align: 'center' });
  }

  // Texto de validación
  const tx = cardX + 58;
  doc.setTextColor(C_GREEN_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('VALIDACIÓN DEL CÓDIGO', tx, panelTop + 11);
  doc.setTextColor(C_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const msg = doc.splitTextToSize(
    'Escanea el código QR o digita el UUID en el punto de validación del SENA.',
    cardX + cardW - 14 - tx
  );
  doc.text(msg, tx, panelTop + 17.5);
  const genLine = doc.splitTextToSize(`Generado el ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}`, cardX + cardW - 14 - tx);
  doc.setTextColor('#AABBAA');
  doc.setFontSize(6);
  doc.text(genLine, tx, panelTop + 37);

  // ===== Pie de página =====
  doc.setDrawColor(C_BORDER);
  doc.setLineWidth(0.4);
  doc.line(16, 250, W - 16, 250);
  doc.setTextColor(C_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('SENA — Sistema de Gestión de Carnets', 16, 256);
  doc.text('Documento generado electrónicamente · sin firma manuscrita', W - 16, 256, { align: 'right' });

  const filename = uuid && uuid !== '—' ? `carnet_${uuid.slice(0, 12)}.pdf` : `carnet_${carnet.id}.pdf`;
  doc.save(filename);
}