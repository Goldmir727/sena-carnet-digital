import { useQuery } from '@tanstack/react-query';
import api from './client';

export function useRegionales() {
  return useQuery({
    queryKey: ['regionales'],
    queryFn: async () => (await api.get('/regionales/')).data,
  });
}

export function useCentrosByRegional(regional) {
  return useQuery({
    queryKey: ['centros', { regional }],
    queryFn: async () =>
      (await api.get('/centros/', { params: regional ? { regional } : {} })).data,
    enabled: !!regional,
  });
}
