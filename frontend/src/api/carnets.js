import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';

export function useMiCarnet() {
  return useQuery({
    queryKey: ['carnet', 'me'],
    queryFn: async () => (await api.get('/carnets/me')).data,
    retry: false,
  });
}

export function useCarnets(filter) {
  return useQuery({
    queryKey: ['carnets', filter],
    queryFn: async () => (await api.get('/carnets/', { params: { estado: filter?.estado } })).data,
  });
}

export function useCarnet(id) {
  return useQuery({
    queryKey: ['carnets', id],
    queryFn: async () => (await api.get(`/carnets/${id}`)).data,
    enabled: !!id,
  });
}

export function useGenerarCarnet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (user_id) => api.post(`/carnets/generate/${user_id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carnets'] }),
  });
}

export function useRegenerarCarnet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (user_id) => api.post(`/carnets/regenerate/${user_id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carnets'] }),
  });
}

export function useCambiarEstadoCarnet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }) => api.patch(`/carnets/${id}/estado`, { estado }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carnets'] }),
  });
}

const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export function carnetQrUrl(id) {
  return `${BASE}/carnets/${id}/qr`;
}

export function carnetPdfUrl(id) {
  return `${BASE}/carnets/${id}/pdf`;
}
