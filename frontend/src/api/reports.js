import { useQuery } from '@tanstack/react-query';
import api from './client';

export function useReporteEstadisticas({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['reports', 'estadisticas'],
    queryFn: async () => (await api.get('/reports/estadisticas')).data,
    enabled,
  });
}

export function useReporteUsuarios() {
  return useQuery({
    queryKey: ['reports', 'usuarios'],
    queryFn: async () => (await api.get('/reports/usuarios')).data,
  });
}

export function useReporteCarnets(filter) {
  return useQuery({
    queryKey: ['reports', 'carnets', filter],
    queryFn: async () => (await api.get('/reports/carnets', { params: { estado: filter?.estado } })).data,
  });
}

export function useReporteAsistencias() {
  return useQuery({
    queryKey: ['reports', 'asistencias'],
    queryFn: async () => (await api.get('/reports/asistencias')).data,
  });
}
