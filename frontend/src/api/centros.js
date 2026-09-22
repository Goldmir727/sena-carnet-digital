import { useQuery } from '@tanstack/react-query';
import api from './client';

export function useCentros() {
  return useQuery({
    queryKey: ['centros'],
    queryFn: async () => (await api.get('/centros/')).data,
  });
}
