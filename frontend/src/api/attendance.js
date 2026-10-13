import { useQuery } from '@tanstack/react-query';
import api from './client';

export function useAttendance(params) {
  return useQuery({
    queryKey: ['attendance', params],
    queryFn: async () => (await api.get('/attendance/', { params })).data,
  });
}

export function useAttendanceUser(userId) {
  return useQuery({
    queryKey: ['attendance', 'user', userId],
    queryFn: async () => (await api.get(`/attendance/user/${userId}`)).data,
    enabled: !!userId,
  });
}

export function useAttendanceStats() {
  return useQuery({
    queryKey: ['attendance', 'stats'],
    queryFn: async () => (await api.get('/attendance/stats')).data,
  });
}

export function useAttendanceRange(range) {
  return useQuery({
    queryKey: ['attendance', 'range', range],
    queryFn: async () => (await api.get('/attendance/range', { params: range })).data,
    enabled: !!(range?.desde && range?.hasta),
  });
}

export function useLateArrivals(fichaId) {
  return useQuery({
    queryKey: ['attendance', 'llegadas-tarde', fichaId ?? null],
    queryFn: async () =>
      (
        await api.get(
          '/attendance/llegadas-tarde',
          fichaId ? { params: { ficha_id: fichaId } } : {},
        )
      ).data,
  });
}

export function useAbsences(fichaId) {
  return useQuery({
    queryKey: ['attendance', 'inasistencias', fichaId ?? null],
    queryFn: async () =>
      (
        await api.get(
          '/attendance/inasistencias',
          fichaId ? { params: { ficha_id: fichaId } } : {},
        )
      ).data,
  });
}
