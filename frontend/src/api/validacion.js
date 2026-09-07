import { useMutation } from '@tanstack/react-query';
import api from './client';

export function useValidarQr() {
  return useMutation({
    mutationFn: ({ qr_token, ubicacion }) =>
      api
        .post('/validate/qr', { qr_token }, { headers: ubicacion ? { 'X-Ubicacion': ubicacion } : {} })
        .then((r) => r.data),
  });
}

export function useValidarUuid() {
  return useMutation({
    mutationFn: ({ uuid, ubicacion }) =>
      api
        .get(`/validate/check/${uuid}`, { headers: ubicacion ? { 'X-Ubicacion': ubicacion } : {} })
        .then((r) => r.data),
  });
}
