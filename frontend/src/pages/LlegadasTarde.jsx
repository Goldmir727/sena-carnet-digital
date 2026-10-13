import { useState } from 'react';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { useLlegadasTarde } from '../api/attendance';
import Table from '../components/common/Table';
import Button from '../components/common/Button';

const TOLERANCIAS = [0, 5, 10, 15];

function formatHora(value) {
  if (!value) return '—';
  if (/^\d{2}:\d{2}:\d{2}/.test(value)) return value.slice(0, 8);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  });
}

function formatFecha(value) {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function formatTardanza(minutos, segundos) {
  if (minutos >= 1) return `${minutos} min tarde`;
  return `${segundos} s tarde`;
}

const COLUMNS = [
  {
    key: 'aprendiz',
    label: 'Aprendiz',
    render: (row) => (
      <div>
        <p className="font-semibold text-sena-ink">
          {`${row.nombres || ''} ${row.apellidos || ''}`.trim() || 'Sin nombre'}
        </p>
        <p className="text-xs text-slate-500">Doc. {row.numero_documento || '—'}</p>
      </div>
    ),
  },
  {
    key: 'ficha',
    label: 'Ficha / Programa',
    render: (row) => (
      <div>
        <p className="font-medium text-sena-ink">{row.ficha || '—'}</p>
        <p className="text-xs text-slate-500">{row.programa || 'Sin programa'}</p>
      </div>
    ),
  },
  {
    key: 'fecha',
    label: 'Fecha de clase',
    render: (row) => formatFecha(row.fecha),
  },
  {
    key: 'hora_inicio',
    label: 'Inicio programado',
    render: (row) => formatHora(row.hora_inicio),
  },
  {
    key: 'hora_llegada',
    label: 'Hora de llegada',
    render: (row) => formatHora(row.hora_llegada),
  },
  {
    key: 'tardanza',
    label: 'Tardanza',
    render: (row) => (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
        <Clock className="h-3.5 w-3.5" />
        {formatTardanza(row.minutos_tardanza, row.segundos_tardanza)}
      </span>
    ),
  },
];

export default function LlegadasTarde() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tolerancia, setTolerancia] = useState(0);

  const params = {};
  if (desde) params.desde = desde;
  if (hasta) params.hasta = hasta;
  if (tolerancia) params.tolerancia_minutos = tolerancia;

  const { data, isLoading, isError, error, refetch, isFetching } = useLlegadasTarde(params);

  const errorMessage =
    error?.response?.data?.detail ||
    (error?.response?.status === 403
      ? 'No tienes permiso para consultar las llegadas tarde.'
      : null) ||
    'No se pudo conectar con el servidor. Intenta de nuevo más tarde.';

  const limpiar = () => {
    setDesde('');
    setHasta('');
    setTolerancia(0);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Asistencia</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-sena-ink">Llegadas tarde</h1>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            {(data?.length ?? 0)} registro{(data?.length ?? 0) === 1 ? '' : 's'}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Aprendices que escanearon su asistencia después de la hora de inicio programada de la
          sesión. Las tardanzas se calculan con la hora real de registro y el inicio programado;
          los registros sin hora de inicio conocida no se clasifican.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="desde" className="mb-1 block text-xs font-semibold text-slate-500">
            Desde
          </label>
          <input
            id="desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-sena-ink focus:border-sena-green focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="hasta" className="mb-1 block text-xs font-semibold text-slate-500">
            Hasta
          </label>
          <input
            id="hasta"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-sena-ink focus:border-sena-green focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="tolerancia" className="mb-1 block text-xs font-semibold text-slate-500">
            Tolerancia
          </label>
          <select
            id="tolerancia"
            value={tolerancia}
            onChange={(e) => setTolerancia(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-sena-ink focus:border-sena-green focus:outline-none"
          >
            {TOLERANCIAS.map((t) => (
              <option key={t} value={t}>
                {t === 0 ? 'Sin tolerancia' : `${t} min`}
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" onClick={limpiar}>
          Limpiar filtros
        </Button>
        <Button variant="ghost" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <p className="font-semibold text-red-800">Error al cargar las llegadas tarde</p>
          <p className="mt-1 max-w-md text-sm text-red-600">{errorMessage}</p>
          <Button variant="danger" className="mt-4" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <Table
          columns={COLUMNS}
          rows={data || []}
          loading={isLoading}
          emptyMessage="No hay llegadas tarde registradas. Ningún aprendiz ha llegado después de la hora de inicio programada."
        />
      )}
    </div>
  );
}
