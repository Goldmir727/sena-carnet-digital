import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';

// Submódulo de Centros de Formación (Coordinador).
// Contrato esperado del backend: GET /centros/ y POST /centros/
// (ver ticket B1 para el equipo Backend).

export function useCentros() {
  return useQuery({
    queryKey: ['centros'],
    queryFn: async () => (await api.get('/centros/')).data,
  });
}

export function useCreateCentro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/centros/', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['centros'] }),
  });
}
