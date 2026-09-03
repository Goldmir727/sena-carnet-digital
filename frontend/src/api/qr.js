import { useMutation } from '@tanstack/react-query';
import api from './client';
import { getAccessToken } from '../utils/session';

export function useGenerarQrCarnet() {
  return useMutation({
    mutationFn: () => api.post('/qr/carnet').then((r) => r.data),
  });
}

export function useGenerarQrClase() {
  return useMutation({
    mutationFn: (grupo_id) => api.post('/qr/clase', { grupo_id }).then((r) => r.data),
  });
}

export function qrImageUrl(token) {
  return `/qr/carnet/image?token=${encodeURIComponent(token)}`;
}

export async function fetchQrImageBlob(token) {
  const res = await fetch(qrImageUrl(token), {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error('No se pudo cargar la imagen del QR');
  return res.blob();
}
