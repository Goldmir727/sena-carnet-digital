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
      return api
        .post(`/users/${id}/foto`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then((r) => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useImportUsersExcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, grupo_id }) => {
      const form = new FormData();
      if (grupo_id !== undefined && grupo_id !== null) {
        form.append('grupo_id', grupo_id);
      }
      form.append('file', file);
      return api
        .post('/users/import-excel', form, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then((r) => r.data);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      if (vars?.grupo_id !== undefined && vars?.grupo_id !== null) {
        qc.invalidateQueries({ queryKey: ['grupos', vars.grupo_id, 'estudiantes'] });
      }
    },
  });
}

export async function downloadImportTemplate(ficha) {
  const params = ficha ? { ficha } : {};
  const res = await api.get('/users/import-template', { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = ficha ? `Plantilla aprendices - Ficha ${ficha}.xlsx` : 'plantilla_aprendices.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
