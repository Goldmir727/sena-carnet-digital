import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users/')).data,
  });
}

export function useUser(id) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: async () => (await api.get(`/users/${id}`)).data,
    enabled: !!id,
  });
}

export function useUsersSearch(q) {
  return useQuery({
    queryKey: ['users', 'search', q],
    queryFn: async () => (await api.get('/users/search', { params: { q } })).data,
    enabled: !!q,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/users/', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => api.put(`/users/${id}`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }) => {
      const form = new FormData();
      form.append('file', file);
      return api.post(`/users/${id}/foto`, form).then((r) => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
