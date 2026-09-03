import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';

export function useGrupos() {
  return useQuery({
    queryKey: ['grupos'],
    queryFn: async () => (await api.get('/grupos/')).data,
  });
}

export function useMisGrupos() {
  return useQuery({
    queryKey: ['grupos', 'mios'],
    queryFn: async () => (await api.get('/grupos/mis-grupos')).data,
  });
}

export function useGrupo(id) {
  return useQuery({
    queryKey: ['grupos', id],
    queryFn: async () => (await api.get(`/grupos/${id}`)).data,
    enabled: !!id,
  });
}

export function useGrupoEstudiantes(id) {
  return useQuery({
    queryKey: ['grupos', id, 'estudiantes'],
    queryFn: async () => (await api.get(`/grupos/${id}/estudiantes`)).data,
    enabled: !!id,
  });
}

export function useGrupoDocentes(id) {
  return useQuery({
    queryKey: ['grupos', id, 'docentes'],
    queryFn: async () => (await api.get(`/grupos/${id}/docentes`)).data,
    enabled: !!id,
  });
}

export function useCreateGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/grupos/', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grupos'] }),
  });
}

export function useUpdateGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => api.put(`/grupos/${id}`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grupos'] }),
  });
}

export function useDeleteGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/grupos/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grupos'] }),
  });
}

export function useAsignarEstudiantes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, user_ids }) => api.post(`/grupos/${id}/estudiantes`, { user_ids }).then((r) => r.data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['grupos', vars.id, 'estudiantes'] }),
  });
}

export function useQuitarEstudiante() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ grupo_id, user_id }) => api.delete(`/grupos/${grupo_id}/estudiantes/${user_id}`).then((r) => r.data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['grupos', vars.grupo_id, 'estudiantes'] }),
  });
}

export function useAsignarDocentes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, user_ids }) => api.post(`/grupos/${id}/docentes`, { user_ids }).then((r) => r.data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['grupos', vars.id, 'docentes'] }),
  });
}

export function useQuitarDocente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ grupo_id, user_id }) => api.delete(`/grupos/${grupo_id}/docentes/${user_id}`).then((r) => r.data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['grupos', vars.grupo_id, 'docentes'] }),
  });
}
