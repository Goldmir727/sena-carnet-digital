import { useQuery } from '@tanstack/react-query';
import api from './client';
import { getAccessToken } from '../utils/session';

export function useReporteEstadisticas() {
  return useQuery({
    queryKey: ['reports', 'estadisticas'],
    queryFn: async () => (await api.get('/reports/estadisticas')).data,
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

async function downloadBlob(url, fallbackName) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error('No se pudo descargar el archivo');
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export function exportReporte(tipo, formato) {
  return downloadBlob(`${BASE}/reports/export/${formato}?tipo=${encodeURIComponent(tipo)}`, `reporte_${tipo}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`);
}
