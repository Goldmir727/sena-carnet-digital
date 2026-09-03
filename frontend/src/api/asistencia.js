import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';

export function useEscanearAsistencia() {
  return useMutation({
    mutationFn: (qr_token) => api.post('/asistencia/escanear', { qr_token }).then((r) => r.data),
  });
}

export function useAsistenciaGrupo(grupoId, range) {
  return useQuery({
    queryKey: ['asistencia', 'grupo', grupoId, range],
    queryFn: async () =>
      (await api.get(`/asistencia/grupo/${grupoId}`, { params: range })).data,
    enabled: !!grupoId,
  });
}

export function useAsistenciaStats(grupoId) {
  return useQuery({
    queryKey: ['asistencia', 'grupo', grupoId, 'stats'],
    queryFn: async () => (await api.get(`/asistencia/grupo/${grupoId}/stats`)).data,
    enabled: !!grupoId,
  });
}

export function useSubirExcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ grupo_id, file }) => {
      const form = new FormData();
      form.append('file', file);
      return api
        .post('/asistencia/excel', form, { params: { grupo_id } })
        .then((r) => r.data);
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['asistencia', 'grupo', vars.grupo_id] }),
  });
}
