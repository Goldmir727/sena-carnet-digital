import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';

export function useProgramas() {
  return useQuery({
    queryKey: ['programas'],
    queryFn: async () => (await api.get('/programas/')).data,
  });
}

export function useCreatePrograma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/programas/', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programas'] }),
  });
}

export function useUpdatePrograma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => api.put(`/programas/${id}`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programas'] }),
  });
}
