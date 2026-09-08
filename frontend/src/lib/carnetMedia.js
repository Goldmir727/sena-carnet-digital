import { getAccessToken } from '../utils/session';

const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001';

export async function fetchCarnetQrUrl(id) {
  const res = await fetch(`${BASE}/carnets/${id}/qr`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error('No se pudo cargar el código QR');
  return URL.createObjectURL(await res.blob());
}

export async function downloadCarnetPdf(id) {
  const res = await fetch(`${BASE}/carnets/${id}/pdf`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error('No se pudo descargar el carnet');
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i);
  const name = match ? decodeURIComponent(match[1]) : `carnet_${id}.pdf`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}