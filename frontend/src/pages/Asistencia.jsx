import { useState } from 'react';
import {
  CalendarCheck,
  Users,
  Clock,
  CalendarRange,
  FileSpreadsheet,
  Upload,
  UserX2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useAttendance, useAttendanceStats, useAttendanceRange, useLateArrivals, useAbsences } from '../api/attendance';
import { useMisGrupos, useGrupos } from '../api/grupos';
import { useAsistenciaGrupo, useAsistenciaStats, useSubirExcel } from '../api/asistencia';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import { fieldClass } from '../components/ui/fields';
import { getErr } from '../lib/errors';

const fmt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const fmtFecha = (iso) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtHora = (t) => (t ? String(t).slice(0, 5) : '—');

function DocenteView() {
  const grupos = useMisGrupos();
  const [grupoId, setGrupoId] = useState('');
  const [fecha, setFecha] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [resumen, setResumen] = useState(null);

  const data = grupos.data || [];
  const grupoSeleccionado = grupoId || (data.length === 1 ? data[0].id : '');
  const listQuery = useAsistenciaGrupo(grupoSeleccionado, fecha ? { fecha } : undefined);
  const statsQuery = useAsistenciaStats(grupoSeleccionado);
  const subir = useSubirExcel();

  const rows = listQuery.data || [];
  const pag = usePagination(rows, `${grupoSeleccionado}|${fecha}`);
  const stats = statsQuery.data || {};

  const onSubir = async () => {
    if (!grupoSeleccionado) {
      toast.error('Selecciona primero el grupo');
      return;
    }
    if (!archivo) {
      toast.error('Selecciona el archivo .xlsx');
      return;
    }
    setResumen(null);
    try {
      const r = await subir.mutateAsync({ grupo_id: Number(grupoSeleccionado), file: archivo });
      setResumen(r);
      toast.success('Excel procesado');
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const columns = [
    {
      key: 'id',
      label: 'Registro',
      render: (r) => <span className="font-mono text-xs text-slate-400">#{r.id}</span>,
    },
    {
      key: 'aprendiz',
      label: 'Aprendiz',
      render: (r) => (
        <span className="font-medium text-sena-ink">
          {[r.name || r.nombres, r.last_name || r.apellidos].filter(Boolean).join(' ') || '—'}
        </span>
      ),
    },
    {
      key: 'documento',
      label: 'Documento',
      render: (r) => <span className="text-slate-600">{r.document || r.numero_documento || '—'}</span>,
    },
    {
      key: 'fecha_hora',
      label: 'Fecha y hora',
      render: (r) => <span className="text-slate-600">{fmt(r.fecha_hora)}</span>,
    },
  ];

  if (grupos.isLoading) {
    return <EmptyState icon={Users} title="Cargando tus grupos…" message="Consultando la información de tus fichas." />;
  }

  if (grupos.isError) {
    return <ErrorState title="No se pudieron cargar tus grupos" message={getErr(grupos.error)} onRetry={grupos.refetch} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No tienes grupos asignados"
        message="Solo puedes consultar asistencia y subir Excel de los grupos donde estás asignado como docente."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-4">
          <Select
            label="Mi grupo / ficha"
            options={data.map((g) => ({ value: g.id, label: g.nombre }))}
            value={grupoSeleccionado}
            onChange={(e) => setGrupoId(e.target.value)}
            placeholder="Selecciona el grupo"
            hint="Solo aparecen los grupos donde estás asignado como docente."
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-44">
              <label className="mb-1.5 block text-sm font-medium text-sena-ink">Filtrar por fecha</label>
              <input type="date" className={fieldClass()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            {fecha && (
              <Button variant="ghost" icon={CalendarRange} onClick={() => setFecha('')}>
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Matriculados" value={stats.total ?? '—'} accent="dark" />
        <StatCard icon={CheckCircle2} label="Presentes hoy" value={stats.presentes_hoy ?? '—'} accent="green" />
        <StatCard icon={UserX2} label="Ausentes hoy" value={stats.ausentes ?? '—'} accent="red" />
      </div>

      <div className="flex justify-end">
        <p className="text-xs text-slate-400">{rows.length} asistencias{stats.presentes_hoy ? ' en el día' : ''}</p>
      </div>

      {listQuery.isError ? (
        <ErrorState title="No se pudieron cargar las asistencias" message={getErr(listQuery.error)} onRetry={listQuery.refetch} />
      ) : (
        <Table
          columns={columns}
          rows={pag.pageRows}
          loading={listQuery.isLoading}
          emptyTitle="Sin asistencias registradas"
          emptyMessage="Cuando los aprendices escaneen tu QR de clase, aquí aparecerán los registros."
          keyField="id"
        />
      )}
      <Pagination page={pag.page} totalPages={pag.totalPages} total={pag.total} onChange={pag.setPage} />

      <Card>
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <FileSpreadsheet className="h-5 w-5 text-sena-green" />
          <div>
            <h2 className="text-base font-semibold text-sena-ink">Subir Excel de asistencias</h2>
            <p className="text-xs text-slate-400">
              Columnas requeridas: <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">numero_documento</code>,{' '}
              <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">fecha_hora</code>,{' '}
              <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">observacion</code> (opcional).
            </p>
          </div>
        </div>
        <div className="space-y-4 pt-4">
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-sena-tint-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sena-green-dark hover:file:bg-sena-tint-200"
          />
          <Button icon={Upload} onClick={onSubir} loading={subir.isPending} disabled={!archivo}>
            Procesar Excel
          </Button>
        </div>

        {resumen && (
          <div className="mt-4 grid gap-3 rounded-xl border border-sena-tint-200 bg-sena-tint-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-sm">
              <p className="text-xs text-slate-400">Procesados</p>
              <p className="font-semibold text-sena-ink">{resumen.procesados ?? '—'}</p>
            </div>
            <div className="text-sm">
              <p className="text-xs text-slate-400">Insertados</p>
              <p className="font-semibold text-sena-green-dark">{resumen.insertados ?? '—'}</p>
            </div>
            <div className="text-sm">
              <p className="text-xs text-slate-400">Duplicados</p>
              <p className="font-semibold text-sena-ink">{resumen.duplicados ?? '—'}</p>
            </div>
            <div className="text-sm">
              <p className="text-xs text-slate-400">Errores</p>
              <p className="font-semibold text-red-600">{resumen.errores ?? '—'}</p>
            </div>
          </div>
        )}

        {archivo && !archivo.name.toLowerCase().endsWith('.xlsx') && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" /> El backend solo acepta archivos .xlsx
          </p>
        )}
      </Card>
    </div>
  );
}

function CoordinadorView() {
  const statsQuery = useAttendanceStats();
  const attendanceQuery = useAttendance();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const rangeActive = Boolean(desde && hasta);
  const rangeQuery = useAttendanceRange(rangeActive ? { desde, hasta } : null);

  const rows = rangeActive ? rangeQuery.data || [] : attendanceQuery.data || [];
  const pag = usePagination(rows, `${desde}|${hasta}`);
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
      render: (r) => <span className="font-medium text-sena-ink">{r.usuario_nombre || r.nombres || r.username || '—'}</span>,
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
            <Button variant="ghost" icon={CalendarRange} onClick={() => { setDesde(''); setHasta(''); }}>
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
          rows={pag.pageRows}
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
      <Pagination page={pag.page} totalPages={pag.totalPages} total={pag.total} onChange={pag.setPage} />
    </div>
  );
}

function useFiltroFicha() {
  const { user } = useAuth();
  const esDocente = user?.role_name === 'Docente';
  // Docente: solo sus fichas (mis-grupos). Coordinador: todas (/grupos/).
  const misGrupos = useMisGrupos(esDocente);
  const todosGrupos = useGrupos(!esDocente);
  const gruposQuery = esDocente ? misGrupos : todosGrupos;
  const [fichaId, setFichaId] = useState('');
  return { esDocente, gruposQuery, fichaId, setFichaId };
}

function FiltroFicha({ esDocente, gruposQuery, fichaId, setFichaId }) {
  return (
    <Card>
      <Select
        label="Filtrar por ficha"
        options={[
          { value: '', label: 'Todas las fichas' },
          ...(gruposQuery.data || []).map((g) => ({ value: g.id, label: g.nombre })),
        ]}
        value={fichaId}
        onChange={(e) => setFichaId(e.target.value)}
        allowEmpty={false}
        hint={
          esDocente
            ? 'Solo aparecen las fichas asignadas a ti.'
            : 'Todas las fichas del sistema.'
        }
      />
    </Card>
  );
}

function LlegadasTardeView() {
  const filtro = useFiltroFicha();
  const query = useLateArrivals(filtro.fichaId ? Number(filtro.fichaId) : undefined);
  const rows = query.data || [];
  const pag = usePagination(rows, filtro.fichaId);
  const peor = rows.reduce((m, r) => Math.max(m, r.minutos_tarde || 0), 0);
  const promedio = rows.length
    ? Math.round(rows.reduce((acc, r) => acc + (r.minutos_tarde || 0), 0) / rows.length)
    : 0;

  const columns = [
    {
      key: 'aprendiz',
      label: 'Aprendiz',
      render: (r) => (
        <span className="font-medium text-sena-ink">
          {[r.nombres, r.apellidos].filter(Boolean).join(' ') || r.usuario_nombre || '—'}
        </span>
      ),
    },
    {
      key: 'documento',
      label: 'Documento',
      render: (r) => <span className="text-slate-600">{r.usuario_documento || '—'}</span>,
    },
    {
      key: 'grupo',
      label: 'Grupo / Ficha',
      render: (r) => (
        <span className="text-slate-600">{r.grupo_nombre ? `Ficha ${r.grupo_nombre}` : '—'}</span>
      ),
    },
    {
      key: 'fecha',
      label: 'Fecha de clase',
      render: (r) => <span className="text-slate-600">{fmtFecha(r.fecha_sesion)}</span>,
    },
    {
      key: 'inicio',
      label: 'Inicio programado',
      render: (r) => <span className="text-slate-600">{fmtHora(r.inicio_programado)}</span>,
    },
    {
      key: 'llegada',
      label: 'Hora de llegada',
      render: (r) => <span className="text-slate-600">{fmt(r.fecha_hora)}</span>,
    },
    {
      key: 'minutos',
      label: 'Minutos tarde',
      render: (r) => (
        <Badge variant={(r.minutos_tarde || 0) >= 15 ? 'red' : 'yellow'}>
          {r.minutos_tarde ?? '—'} min
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <FiltroFicha {...filtro} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Clock} label="Llegadas tarde" value={rows.length} accent="yellow" />
        <StatCard
          icon={AlertTriangle}
          label="Peor retraso"
          value={rows.length ? `${peor} min` : '—'}
          accent="red"
        />
        <StatCard
          icon={CalendarCheck}
          label="Promedio de retraso"
          value={rows.length ? `${promedio} min` : '—'}
          accent="dark"
        />
      </div>

      <p className="text-xs text-slate-400">
        {rows.length} registro{rows.length === 1 ? '' : 's'} con llegada posterior al inicio programado
      </p>

      {query.isError ? (
        <ErrorState
          title="No se pudieron cargar las llegadas tarde"
          message={getErr(query.error)}
          onRetry={query.refetch}
        />
      ) : (
        <Table
          columns={columns}
          rows={pag.pageRows}
          loading={query.isLoading}
          emptyTitle="Sin llegadas tarde"
          emptyMessage="Cuando un aprendiz registre su llegada después del inicio programado de una clase, aparecerá aquí."
          emptyIcon={Clock}
          keyField="id"
        />
      )}
      <Pagination page={pag.page} totalPages={pag.totalPages} total={pag.total} onChange={pag.setPage} />
    </div>
  );
}

function InasistenciasView() {
  const filtro = useFiltroFicha();
  const query = useAbsences(filtro.fichaId ? Number(filtro.fichaId) : undefined);
  const rows = query.data || [];
  const pag = usePagination(rows, filtro.fichaId);

  const columns = [
    {
      key: 'aprendiz',
      label: 'Aprendiz',
      render: (r) => (
        <span className="font-medium text-sena-ink">
          {[r.nombres, r.apellidos].filter(Boolean).join(' ') || '—'}
        </span>
      ),
    },
    {
      key: 'documento',
      label: 'Documento',
      render: (r) => <span className="text-slate-600">{r.usuario_documento || '—'}</span>,
    },
    {
      key: 'grupo',
      label: 'Grupo / Programa',
      render: (r) => (
        <span className="text-slate-600">
          {r.grupo_nombre ? `Ficha ${r.grupo_nombre}` : '—'}
          {r.programa_nombre ? (
            <span className="block text-xs text-slate-400">{r.programa_nombre}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'fecha',
      label: 'Fecha de sesión',
      render: (r) => <span className="text-slate-600">{fmtFecha(r.fecha_sesion)}</span>,
    },
    {
      key: 'horario',
      label: 'Horario',
      render: (r) => (
        <span className="text-slate-600">
          {fmtHora(r.inicio)} – {fmtHora(r.fin)}
        </span>
      ),
    },
    {
      key: 'estado',
      label: 'Estado de sesión',
      render: (r) => (
        <Badge variant={r.estado_sesion === 'realizada' ? 'green' : 'slate'}>
          {r.estado_sesion || '—'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <FiltroFicha {...filtro} />

      <Card>
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-sena-green" />
          <div>
            <h2 className="text-base font-semibold text-sena-ink">¿Cómo se calcula una inasistencia?</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Se muestra un aprendiz solo cuando tiene matrícula activa en la ficha, la sesión ya
              finalizó (de una fecha anterior, o la de hoy marcada como «realizada») y no existe
              ningún registro de asistencia para esa sesión. Las sesiones programadas para hoy o
              futuras no cuentan como inasistencia. Docente ve solo sus fichas; Coordinador ve todas.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <p className="text-xs text-slate-400">{rows.length} inasistencia{rows.length === 1 ? '' : 's'} detectada{rows.length === 1 ? '' : 's'}</p>
      </div>

      {query.isError ? (
        <ErrorState
          title="No se pudieron cargar las inasistencias"
          message={getErr(query.error)}
          onRetry={query.refetch}
        />
      ) : (
        <Table
          columns={columns}
          rows={pag.pageRows}
          loading={query.isLoading}
          emptyTitle="Sin inasistencias"
          emptyMessage="No hay ausencias confirmadas en sesiones finalizadas de tus grupos."
          emptyIcon={UserX2}
          keyField="id"
        />
      )}
      <Pagination page={pag.page} totalPages={pag.totalPages} total={pag.total} onChange={pag.setPage} />
    </div>
  );
}

export default function Asistencia() {
  const { user } = useAuth();
  const esDocente = user?.role_name === 'Docente';
  const [pestaña, setPestaña] = useState('asistencias');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Asistencia"
        title="Asistencia"
        description={
          esDocente
            ? 'Consulta la asistencia de tus grupos y sincroniza asistencias desde Excel.'
            : 'Consulta los registros de asistencia capturados por el sistema.'
        }
        icon={CalendarCheck}
        breadcrumb={[{ label: 'Inicio', to: '/panel' }, { label: 'Asistencia' }]}
      />

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'asistencias', label: 'Asistencias' },
          { id: 'llegadas-tarde', label: 'Llegadas tarde' },
          { id: 'inasistencias', label: 'Inasistencias' },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPestaña(p.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              pestaña === p.id
                ? 'border-sena-green bg-sena-green text-white shadow-soft'
                : 'border-slate-200 bg-white text-slate-600 hover:border-sena-green hover:text-sena-green-dark'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {pestaña === 'llegadas-tarde' ? (
        <LlegadasTardeView />
      ) : pestaña === 'inasistencias' ? (
        <InasistenciasView />
      ) : esDocente ? (
        <DocenteView />
      ) : (
        <CoordinadorView />
      )}
    </div>
  );
}
