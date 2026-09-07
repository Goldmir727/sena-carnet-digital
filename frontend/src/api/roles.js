import { useQuery } from '@tanstack/react-query';
import api from './client';

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get('/roles/')).data,
  });
}
