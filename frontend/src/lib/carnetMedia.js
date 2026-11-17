import { getAccessToken } from '../utils/session';
import API_BASE from '../api/base';
import {
  CARNET,
  CARNET_COLORS,
  CARNET_LAYOUT,
  LOGO_URL,
  buildCarnetData,
  documentLine,
  hexToRgb,
  photoUrl,
  ptToMm,
  regionalLabel,
  roleLabel,
} from './carnetDesign';

const BASE = API_BASE;

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

async function fetchLogoDataUrl() {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    return await blobToDataUrl(await res.blob());
  } catch {
    return null;
  }
}

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la fotografía'));
    img.src = dataUrl;
  });
}

// Recorta la fotografía al centro en un cuadrado y la exporta como JPEG.
// Se hace en canvas para que jsPDF no deforme imágenes rectangulares.
async function squarePhotoDataUrl(foto) {
  const src = photoUrl(foto);
  if (!src) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const dataUrl = await blobToDataUrl(await res.blob());
    const img = await loadImageElement(dataUrl);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const side = Math.min(width, height);
    if (!side) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 600, 600);
    ctx.drawImage(
      img,
      (width - side) / 2,
      (height - side) / 2,
      side,
      side,
      0,
      0,
      600,
      600,
    );
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return null;
  }
}

function baseline(topMm, sizePt) {
  return topMm + ptToMm(sizePt) * 0.8;
}

function fitOneLine(doc, text, maxWidth, font, style, size, charSpace = 0) {
  doc.setFont(font, style);
  doc.setFontSize(size);
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const measure = (value) =>
    doc.getTextWidth(value) + (charSpace > 0 ? charSpace * Math.max(0, value.length - 1) : 0);
  if (measure(clean) <= maxWidth) return clean;
  let cut = clean;
  while (cut.length > 0 && measure(`${cut}…`) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return cut ? `${cut}…` : '';
}

function wrapLines(doc, text, maxWidth, font, style, size, maxLines) {
  doc.setFont(font, style);
  doc.setFontSize(size);
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (doc.getTextWidth(candidate) <= maxWidth) {
      line = candidate;
    } else if (line) {
      lines.push(line);
      line = word;
    } else {
      // Una sola palabra más ancha que la tarjeta: se recorta con elipsis
      // para que nunca desborde el área de contenido.
      lines.push(fitOneLine(doc, word, maxWidth, font, style, size));
      line = '';
    }
  }
  if (line) lines.push(line);

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 0 && doc.getTextWidth(`${last}…`) > maxWidth) {
      last = last.slice(0, -1);
    }
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

function drawPhotoPlaceholder(doc, photo) {
  const cx = photo.x + photo.size / 2;
  doc.setFillColor(...hexToRgb(CARNET_COLORS.photoInk));
  doc.circle(cx, photo.y + photo.size * 0.38, photo.size * 0.11, 'F');
  doc.ellipse(cx, photo.y + photo.size * 0.76, photo.size * 0.21, photo.size * 0.14, 'F');

  doc.setTextColor(...hexToRgb(CARNET_COLORS.photoInk));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.6);
  doc.text('SIN FOTO', cx, photo.y + photo.size * 0.94, { align: 'center' });
}

export async function downloadCarnetPdf(carnet) {
  const data = buildCarnetData(carnet || {});
  if (!carnet?.id) {
    throw new Error('El carnet no tiene identificador para cargar el código QR.');
  }
  const [qr, photo, logo] = await Promise.all([
    // El QR permanente es obligatorio en el PDF: si no se puede cargar,
    // es mejor informar el error que generar un carnet incompleto.
    fetchQrDataUrl(carnet.id).catch(() => {
      throw new Error('No se pudo cargar el código QR permanente del carnet.');
    }),
    squarePhotoDataUrl(data.foto_perfil),
    fetchLogoDataUrl(),
  ]);

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    unit: 'mm',
    format: [CARNET.width, CARNET.height],
    orientation: 'portrait',
    compress: true,
  });

  const W = CARNET.width;
  const H = CARNET.height;
  const L = CARNET_LAYOUT;

  // Fondo completamente blanco.
  doc.setFillColor(...hexToRgb(CARNET_COLORS.white));
  doc.rect(0, 0, W, H, 'F');

  // Franja verde superior.
  doc.setFillColor(...hexToRgb(CARNET_COLORS.greenBand));
  doc.rect(0, 0, W, L.topBand.h, 'F');

  // Logotipo institucional transparente.
  if (logo) {
    doc.addImage(logo, 'PNG', L.logo.x, L.logo.y, L.logo.w, L.logo.h);
  } else {
    doc.setTextColor(...hexToRgb(CARNET_COLORS.greenLogo));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('SENA', L.logo.x, L.logo.y + L.logo.h / 2 + 2);
  }

  // Fotografía cuadrada con recorte central.
  doc.setFillColor(...hexToRgb(CARNET_COLORS.photoBg));
  doc.rect(L.photo.x, L.photo.y, L.photo.size, L.photo.size, 'F');
  if (photo) {
    doc.addImage(photo, 'JPEG', L.photo.x, L.photo.y, L.photo.size, L.photo.size);
  } else {
    drawPhotoPlaceholder(doc, L.photo);
  }
  doc.setDrawColor(...hexToRgb(CARNET_COLORS.line));
  doc.setLineWidth(0.2);
  doc.rect(L.photo.x, L.photo.y, L.photo.size, L.photo.size, 'S');

  // Línea divisoria verde.
  doc.setFillColor(...hexToRgb(CARNET_COLORS.green));
  doc.rect(0, L.divider.y, W, L.divider.h, 'F');

  // Nombre y apellidos.
  doc.setTextColor(...hexToRgb(CARNET_COLORS.green));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(L.name1.size);
  doc.text(
    fitOneLine(doc, data.nombres, L.contentW, 'helvetica', 'bold', L.name1.size),
    L.contentX,
    baseline(L.name1.y, L.name1.size),
  );

  doc.setTextColor(...hexToRgb(CARNET_COLORS.ink));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(L.name2.size);
  doc.text(
    fitOneLine(doc, data.apellidos, L.contentW, 'helvetica', 'bold', L.name2.size),
    L.contentX,
    baseline(L.name2.y, L.name2.size),
  );

  // Documento y tipo de sangre.
  doc.setTextColor(...hexToRgb(CARNET_COLORS.muted));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(L.doc.size);
  doc.setCharSpace(0.12);
  doc.text(
    fitOneLine(doc, documentLine(data), L.contentW - 1, 'helvetica', 'bold', L.doc.size, 0.12),
    L.contentX,
    baseline(L.doc.y, L.doc.size),
  );
  doc.setCharSpace(0);

  // Identificación del rol (Aprendiz, Docente, etc.).
  const badgeText = fitOneLine(
    doc,
    roleLabel(data),
    L.contentW - 5,
    'helvetica',
    'bold',
    L.badge.size,
  );
  const badgeWidth = Math.min(
    Math.max(doc.getTextWidth(badgeText) + 7, 14),
    L.contentW,
  );
  doc.setDrawColor(...hexToRgb(CARNET_COLORS.green));
  doc.setLineWidth(0.25);
  doc.roundedRect(
    L.contentX,
    L.badge.y,
    badgeWidth,
    L.badge.h,
    L.badge.radius,
    L.badge.radius,
    'S',
  );
  doc.setTextColor(...hexToRgb(CARNET_COLORS.green));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(L.badge.size);
  doc.text(
    badgeText,
    L.contentX + badgeWidth / 2,
    L.badge.y + L.badge.h / 2 + ptToMm(L.badge.size) * 0.35,
    { align: 'center' },
  );

  // Panel y QR permanente real.
  doc.setDrawColor(...hexToRgb(CARNET_COLORS.line));
  doc.setLineWidth(0.25);
  doc.roundedRect(
    L.qrPanel.x,
    L.qrPanel.y,
    L.qrPanel.w,
    L.qrPanel.h,
    L.qrPanel.radius,
    L.qrPanel.radius,
    'S',
  );

  if (qr) {
    const qs = L.qr.size;
    doc.addImage(qr, 'PNG', (W - qs) / 2, L.qrPanel.y + (L.qrPanel.h - qs) / 2, qs, qs);
  } else {
    doc.setTextColor(...hexToRgb(CARNET_COLORS.muted));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.6);
    doc.text('QR NO DISPONIBLE', W / 2, L.qrPanel.y + L.qrPanel.h / 2, { align: 'center' });
  }

  // Centro de formación.
  doc.setTextColor(...hexToRgb(CARNET_COLORS.muted));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(L.centro.size);
  doc.text(
    fitOneLine(
      doc,
      data.centro_nombre || 'Centro de formación no disponible',
      L.contentW,
      'helvetica',
      'normal',
      L.centro.size,
    ),
    L.contentX,
    baseline(L.centro.y, L.centro.size),
  );

  // Programa de formación (máximo dos líneas).
  const programa = wrapLines(
    doc,
    data.programa_nombre || 'Programa de formación no disponible',
    L.contentW,
    'helvetica',
    'bold',
    L.programa.size,
    2,
  );
  doc.setTextColor(...hexToRgb(CARNET_COLORS.ink));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(L.programa.size);
  programa.forEach((line, index) => {
    doc.text(
      line,
      L.contentX,
      baseline(L.programa.y + index * L.programa.line, L.programa.size),
    );
  });

  // Franja inferior gris con la regional del centro de formación.
  doc.setFillColor(...hexToRgb(CARNET_COLORS.bottomBand));
  doc.rect(0, L.bottomBand.y, W, L.bottomBand.h, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(L.bottomBand.size);
  doc.setCharSpace(0.32);
  doc.text(
    fitOneLine(doc, regionalLabel(data.regional), W - 6, 'helvetica', 'bold', L.bottomBand.size, 0.32),
    W / 2,
    L.bottomBand.y + L.bottomBand.h / 2 + ptToMm(L.bottomBand.size) * 0.34,
    { align: 'center' },
  );
  doc.setCharSpace(0);

  const rawUuid = String(data.uuid || data.codigo_qr || data.id || 'carnet');
  const safeName = rawUuid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || String(data.id || 'carnet');
  doc.save(`carnet_${safeName}.pdf`);
}
