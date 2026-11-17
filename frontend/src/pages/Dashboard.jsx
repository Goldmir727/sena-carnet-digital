import { Link } from 'react-router-dom';
import {
  Users,
  IdCard,
  Network,
  ClipboardCheck,
  QrCode,
  CreditCard,
  FileBarChart2,
  ScanLine,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  LockKeyhole,
  Fingerprint,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../constants/permissions';
import { ROLE_BADGE_STYLES } from '../constants/roles';
import { useReporteEstadisticas } from '../api/reports';
import { useMiCarnet } from '../api/carnets';
import Zone from '../components/ui/Zone';
import StatusBadge from '../components/ui/StatusBadge';
import ErrorState from '../components/ui/ErrorState';
import ApkDownloadLink from '../components/ui/ApkDownloadLink';
import cn from '../lib/cn';

const SHORTCUTS = [
  { to: '/mi-carnet', label: 'Mi carnet', icon: IdCard, permission: 'carnet.view', desc: 'Tu identificación digital', tone: 'green' },
  { to: '/usuarios', label: 'Usuarios', icon: Users, permission: 'users.read', desc: 'Directorios y roles', tone: 'slate' },
  { to: '/grupos', label: 'Grupos', icon: Network, permission: 'grupos.read', desc: 'Organización y equipos', tone: 'slate' },
  { to: '/carnets', label: 'Carnets', icon: CreditCard, permission: 'carnet.write', desc: 'Emisión y control', tone: 'green' },
  { to: '/asistencia', label: 'Asistencia', icon: ClipboardCheck, permission: 'asistencia.grupo.read', desc: 'Registro de clases', tone: 'slate' },
  { to: '/qr-clase', label: 'QR de clase', icon: QrCode, permission: 'qr.clase', desc: 'Código de tu clase', tone: 'yellow' },
  { to: '/escanear-clase', label: 'Registrar asistencia', icon: ScanLine, permission: 'asistencia.escanear', desc: 'Marca tu presencia', tone: 'green' },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart2, permission: 'reports.view', desc: 'Indicadores e informes', tone: 'slate' },
  { to: '/validar', label: 'Validar acceso', icon: ScanLine, permission: 'validar.qr', desc: 'Verifica un carné digital', tone: 'yellow' },
];

const TONE_BG = {
  green: 'bg-sena-tint-100 text-sena-green',
  slate: 'bg-slate-100 text-slate-600',
  yellow: 'bg-sena-yellow/20 text-sena-ink',
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function Kpi({ label, value }) {
  return (
    <div className="sm:border-l sm:border-slate-100 sm:pl-6 sm:first:border-l-0 sm:first:pl-0">
      <p className="text-4xl font-extrabold tracking-tight text-sena-ink tabular-nums">{value ?? '—'}</p>
      <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role_name;

  const canStats = hasPermission(role, 'reports.view');
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: statsRefetch } =
    useReporteEstadisticas({ enabled: canStats });
  const miCarnet = useMiCarnet();

  const visible = SHORTCUTS.filter((s) => hasPermission(role, s.permission));
  const noCarnet = miCarnet.isError && miCarnet.error?.response?.status === 404;

  return (
    <div className="mx-auto max-w-7xl space-y-8 overflow-x-hidden">
      {/* =====================================================================
          HERO — bienvenida e identidad real del usuario
      ===================================================================== */}
      <Zone variant="dark" className="overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07] animate-drift"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 18%, currentColor 1.2px, transparent 1.5px)',
            backgroundSize: '22px 22px',
          }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-sena-green-light/15 blur-3xl animate-float-soft" aria-hidden="true" />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-sena-tint-200 backdrop-blur-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-sena-yellow" />
            Plataforma de identidad institucional
          </div>
          <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight text-white md:text-[2.6rem]">
            Hola, {user?.username}.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-sena-tint-200">
            Consulta tu credencial digital, administra usuarios y carnets, y valida accesos
            desde el panel de la comunidad SENA.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                ROLE_BADGE_STYLES[role] || 'bg-white/15 text-white'
              )}
            >
              <LockKeyhole className="h-3.5 w-3.5" />
              {role}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-sena-tint-100">
              <Fingerprint className="h-3.5 w-3.5 text-sena-yellow" />
              Verificación en dos pasos
            </span>
          </div>
        </div>
      </Zone>

      {/* =====================================================================
          SUPERFICIE DE TRABAJO — composición asimétrica, no grid de cards
      ===================================================================== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna principal (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Resumen del sistema — solo Coordinador (endpoint admin real) */}
          {canStats && (
            <Zone variant="raised" className="overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
                <BarChart3 className="h-4 w-4 text-sena-green" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-sena-green">
                  Resumen del sistema
                </span>
              </div>
              {statsLoading ? (
                <div className="grid gap-6 p-6 sm:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-9 w-20 rounded-md bg-slate-200/70 animate-pulse" />
                      <div className="h-3 w-32 rounded bg-slate-200/50" />
                    </div>
                  ))}
                </div>
              ) : statsError ? (
                <div className="p-6">
                  <ErrorState
                    title="No se pudieron cargar las estadísticas"
                    message="Intenta de nuevo en unos momentos."
                    onRetry={statsRefetch}
                  />
                </div>
              ) : (
                <div className="grid gap-6 p-6 sm:grid-cols-3">
                  <Kpi label="Usuarios registrados" value={stats?.usuarios_registrados} />
                  <Kpi label="Carnets emitidos" value={stats?.carnets_emitidos} />
                  <Kpi label="Asistencias registradas" value={stats?.total_asistencias} />
                </div>
              )}
              <div className="h-1 w-full bg-sena-hero" />
            </Zone>
          )}

          {/* Accesos rápidos — módulos con backend real */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight text-sena-ink">Módulos disponibles</h2>
              <span className="bg-sena-tint-100 text-sena-green rounded-full px-2.5 py-0.5 text-xs font-semibold">{visible.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {visible.map((s) => (
                <Link
                  key={s.to}
                  to={s.to}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 transition-all duration-200 hover:border-sena-green/40 hover:bg-white hover:shadow-card"
                >
                  <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200', TONE_BG[s.tone], 'group-hover:bg-sena-green group-hover:text-white')}>
                    <s.icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-sena-ink">{s.label}</p>
                    <p className="truncate text-sm text-slate-500">{s.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-sena-green" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Columna lateral (1/3): el carnet real del usuario */}
        <Zone variant="tint" className="h-fit">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sena-green text-white shadow-glow">
                <IdCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-sena-ink">Carnet digital</p>
                <p className="text-xs text-slate-500">Tu identificación</p>
              </div>
            </div>
            {miCarnet.data?.estado && <StatusBadge status={miCarnet.data.estado} />}
          </div>

          {miCarnet.isLoading ? (
            <div className="mt-4 space-y-2">
              <div className="h-4 w-3/4 rounded bg-slate-200/70 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-slate-200/50" />
            </div>
          ) : noCarnet ? (
            <p className="mt-4 rounded-xl border border-sena-tint-200 bg-white/60 p-3 text-sm text-slate-500">
              Todavía no tienes un carnet asignado. Un coordinador lo emitirá para ti.
            </p>
          ) : miCarnet.isError ? (
            <div className="mt-4">
              <ErrorState onRetry={miCarnet.refetch} />
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-sena-tint-200 bg-white/60 p-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Emisión</p>
                  <p className="mt-0.5 font-semibold text-sena-ink">{formatDate(miCarnet.data?.fecha_emision)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Vencimiento</p>
                  <p className="mt-0.5 font-semibold text-sena-ink">{formatDate(miCarnet.data?.fecha_vencimiento)}</p>
                </div>
              </div>
              <Link
                to="/mi-carnet"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-sena-green transition hover:text-sena-green-dark"
              >
                Ver mi carnet <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </Zone>
      </div>

      {/* Aplicación móvil — acceso discreto al APK institucional */}
      <div className="flex justify-center border-t border-slate-200/70 pt-6">
        <ApkDownloadLink />
      </div>
    </div>
  );
}