import { useState } from 'react';
import {
  BarChart3,
  Users,
  CreditCard,
  CalendarCheck,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useReporteEstadisticas,
  useReporteUsuarios,
  useReporteCarnets,
  useReporteAsistencias,
  exportReporte,
} from '../api/reports';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Table from '../components/ui/Table';
import StatusBadge from '../components/ui/StatusBadge';
import Badge from '../components/ui/Badge';
import ErrorState from '../components/ui/ErrorState';
import cn from '../lib/cn';
import { getErr } from '../lib/errors';

const TABS = [
  { id: 'resumen', label: 'Resumen', icon: BarChart3 },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'carnets', label: 'Carnets', icon: CreditCard },
  { id: 'asistencias', label: 'Asistencias', icon: CalendarCheck },
];

const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

export default function Reportes() {
  const [tab, setTab] = useState('resumen');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [exporting, setExporting] = useState(null);

  const estadisticas = useReporteEstadisticas();
  const usuarios = useReporteUsuarios();
  const carnets = useReporteCarnets({ estado: estadoFilter || undefined });
  const asistencias = useReporteAsistencias();

  const st = estadisticas.data || {};

  const onExport = async (formato) => {
    if (tab === 'resumen') return;
    setExporting(formato);
    try {
      await exportReporte(tab, formato);
      toast.success('Reporte exportado correctamente');
    } catch {
      toast.error('No se pudo exportar el reporte. Verifica que el backend soporte la exportación.');
    } finally {
      setExporting(null);
    }
  };

  const usrColumns = [
    { key: 'nombres', label: 'Usuario', render: (r) => <span className="font-medium text-sena-ink">{`${r.nombres || ''} ${r.apellidos || ''}`.trim() || r.email || '—'}</span> },
    { key: 'email', label: 'Correo', render: (r) => <span className="text-slate-600">{r.email || '—'}</span> },
    { key: 'documento', label: 'Documento', render: (r) => <span className="text-slate-600">{`${r.tipo_documento || ''} ${r.numero_documento || ''}`.trim() || '—'}</span> },
    { key: 'rol', label: 'Rol', render: (r) => <Badge variant="green">{r.rol || '—'}</Badge> },
    {
      key: 'is_active',
      label: 'Estado',
      render: (r) =>
        r.is_active === 1 || r.is_active === true ? <Badge variant="green">Activo</Badge> : <Badge variant="slate">Inactivo</Badge>,
    },
    { key: 'created_at', label: 'Registrado', render: (r) => <span className="text-slate-600">{fmt(r.created_at)}</span> },
  ];

  const carnetColumns = [
    { key: 'uuid', label: 'Código', render: (r) => <span className="font-mono text-xs text-slate-500">{r.uuid ? `${r.uuid.slice(0, 12)}…` : '—'}</span> },
    { key: 'nombres', label: 'Titular', render: (r) => <span className="font-medium text-sena-ink">{`${r.nombres || ''} ${r.apellidos || ''}`.trim() || '—'}</span> },
    { key: 'numero_documento', label: 'Documento', render: (r) => <span className="text-slate-600">{r.numero_documento || '—'}</span> },
    { key: 'estado', label: 'Estado', render: (r) => <StatusBadge estado={r.estado} /> },
    { key: 'fecha_emision', label: 'Emitido', render: (r) => <span className="text-slate-600">{fmt(r.fecha_emision)}</span> },
    { key: 'fecha_vencimiento', label: 'Vence', render: (r) => <span className="text-slate-600">{fmt(r.fecha_vencimiento)}</span> },
  ];

  const astColumns = [
    { key: 'fecha_hora', label: 'Fecha y hora', render: (r) => <span className="text-slate-600">{fmt(r.fecha_hora)}</span> },
    { key: 'nombres', label: 'Usuario', render: (r) => <span className="font-medium text-sena-ink">{`${r.nombres || ''} ${r.apellidos || ''}`.trim() || '—'}</span> },
    { key: 'numero_documento', label: 'Documento', render: (r) => <span className="text-slate-600">{r.numero_documento || '—'}</span> },
    { key: 'ubicacion', label: 'Sesión / Ubicación', render: (r) => <span className="text-slate-600">{r.ubicacion || '—'}</span> },
  ];

  const dataMap = {
    usuarios: { query: usuarios, columns: usrColumns, empty: 'Sin usuarios para reportar' },
    carnets: { query: carnets, columns: carnetColumns, empty: 'Sin carnets para reportar' },
    asistencias: { query: asistencias, columns: astColumns, empty: 'Sin asistencias para reportar' },
  };

  const active = tab === 'resumen' ? null : dataMap[tab];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coordinación"
        title="Reportes"
        description="Indicadores y exportaciones con datos reales del sistema."
        icon={BarChart3}
        breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'Reportes' }]}
        actions={
          tab !== 'resumen' ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={FileText}
                loading={exporting === 'pdf'}
                disabled={exporting === 'xlsx'}
                onClick={() => onExport('pdf')}
              >
                Exportar PDF
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={FileSpreadsheet}
                loading={exporting === 'xlsx'}
                disabled={exporting === 'pdf'}
                onClick={() => onExport('xlsx')}
              >
                Exportar Excel
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-1.5 rounded-xl bg-white p-1 shadow-soft">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition',
              tab === t.id ? 'bg-sena-green text-white shadow-glow' : 'text-slate-500 hover:bg-sena-tint-50 hover:text-sena-ink'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' ? (
        <>
          {estadisticas.isError ? (
            <ErrorState
              title="No se pudieron cargar las estadísticas"
              message={getErr(estadisticas.error)}
              onRetry={estadisticas.refetch}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
                <StatCard icon={Users} label="Usuarios registrados" value={st.usuarios_registrados ?? '—'} accent="dark" />
                <StatCard icon={Users} label="Usuarios activos" value={st.usuarios_activos ?? '—'} accent="green" />
                <StatCard icon={CreditCard} label="Carnets emitidos" value={st.carnets_emitidos ?? '—'} accent="blue" />
                <StatCard icon={CreditCard} label="Carnets activos" value={st.carnets_activos ?? '—'} accent="green" />
                <StatCard icon={CreditCard} label="Carnets vencidos" value={st.carnets_vencidos ?? '—'} accent="yellow" />
                <StatCard icon={CreditCard} label="Carnets inactivos" value={st.carnets_inactivos ?? '—'} accent="slate" />
                <StatCard icon={CalendarCheck} label="Asistencias totales" value={st.total_asistencias ?? '—'} accent="red" />
              </div>
              <p className="text-xs text-slate-400">
                Los indicadores se calculan en tiempo real contra la base de datos.
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {tab === 'carnets' && (
              <div className="w-full sm:w-56">
                <Select
                  options={[
                    { value: '', label: 'Todos los estados' },
                    { value: 'Activo', label: 'Activo' },
                    { value: 'Suspendido', label: 'Suspendido' },
                    { value: 'Vencido', label: 'Vencido' },
                    { value: 'Inactivo', label: 'Inactivo' },
                  ]}
                  value={estadoFilter}
                  onChange={(e) => setEstadoFilter(e.target.value)}
                  allowEmpty={false}
                  placeholder="Filtrar por estado"
                />
              </div>
            )}
            {tab !== 'carnets' && <div />}
            <p className="text-xs text-slate-400">
              Mostrando {active.query.data?.length || 0} registros
            </p>
          </div>

          {active.query.isError ? (
            <ErrorState
              title="No se pudieron cargar los datos"
              message={getErr(active.query.error)}
              onRetry={active.query.refetch}
            />
          ) : (
            <Table
              columns={active.columns}
              rows={active.query.data || []}
              loading={active.query.isLoading}
              emptyTitle={active.empty}
              emptyMessage="Los datos aparecerán aquí a medida que se registren."
              keyField="id"
            />
          )}
        </>
      )}
    </div>
  );
}