import { useState } from 'react';
import { CalendarCheck, Users, Clock, CalendarRange } from 'lucide-react';
import { useAttendance, useAttendanceStats, useAttendanceRange } from '../api/attendance';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import ErrorState from '../components/ui/ErrorState';
import { fieldClass } from '../components/ui/fields';

const getErr = (err) => err.response?.data?.detail || err.message || 'Error de conexión con el servidor';

const fmt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function Asistencia() {
  const statsQuery = useAttendanceStats();
  const attendanceQuery = useAttendance();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const rangeActive = Boolean(desde && hasta);
  const rangeQuery = useAttendanceRange(rangeActive ? { desde, hasta } : null);

  const rows = rangeActive ? rangeQuery.data || [] : attendanceQuery.data || [];
  const loading = rangeActive ? rangeQuery.isLoading : attendanceQuery.isLoading;
  const isError = rangeActive ? rangeQuery.isError : attendanceQuery.isError;
  const error = rangeActive ? rangeQuery.error : attendanceQuery.error;
  const refetch = rangeActive ? rangeQuery.refetch : attendanceQuery.refetch;

  const stats = statsQuery.data || {};

  const columns = [
    {
      key: 'id',
      label: 'Registro',
      render: (r) => <span className="font-mono text-xs text-slate-400">#{r.id}</span>,
    },
    {
      key: 'usuario',
      label: 'Usuario',
      render: (r) => {
        const nombre = r.usuario_nombre || r.nombres || r.username || '—';
        return <span className="font-medium text-sena-ink">{nombre}</span>;
      },
    },
    {
      key: 'documento',
      label: 'Documento',
      render: (r) => <span className="text-slate-600">{r.usuario_documento || r.numero_documento || '—'}</span>,
    },
    {
      key: 'fecha_hora',
      label: 'Fecha y hora',
      render: (r) => <span className="text-slate-600">{fmt(r.fecha_hora || r.time)}</span>,
    },
    {
      key: 'ubicacion',
      label: 'Ubicación / Sesión',
      render: (r) => <span className="text-slate-600">{r.ubicacion || r.observations || '—'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coordinación"
        title="Asistencia"
        description="Consulta los registros de asistencia capturados por el sistema."
        icon={CalendarCheck}
        breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'Asistencia' }]}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarCheck} label="Total de registros" value={stats.total_asistencias ?? '—'} accent="dark" />
        <StatCard icon={Clock} label="Registros de hoy" value={stats.hoy ?? '—'} accent="green" />
        <StatCard icon={Users} label="Usuarios únicos" value={stats.usuarios_unicos ?? '—'} accent="blue" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:w-44">
            <label className="mb-1.5 block text-sm font-medium text-sena-ink">Desde</label>
            <input type="date" className={fieldClass()} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="w-full sm:w-44">
            <label className="mb-1.5 block text-sm font-medium text-sena-ink">Hasta</label>
            <input type="date" className={fieldClass()} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          {rangeActive && (
            <Button
              variant="ghost"
              icon={CalendarRange}
              onClick={() => {
                setDesde('');
                setHasta('');
              }}
            >
              Limpiar rango
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-400">
          {rows.length} registros {rangeActive ? 'en el rango seleccionado' : 'recientes'}
        </p>
      </div>

      {isError ? (
        <ErrorState title="No se pudieron cargar las asistencias" message={getErr(error)} onRetry={refetch} />
      ) : (
        <Table
          columns={columns}
          rows={rows}
          loading={loading}
          emptyTitle={rangeActive ? 'Sin registros en el rango' : 'Aún no hay asistencias'}
          emptyMessage={
            rangeActive
              ? 'No hay asistencias entre las fechas indicadas.'
              : 'Cuando los aprendices escaneen su carnet o QR de clase, aquí aparecerán los registros.'
          }
          keyField="id"
        />
      )}
    </div>
  );
}